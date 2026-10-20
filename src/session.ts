import { count, isDebugEnabled, now, time } from './debug.js'
import type { DaemonEvent } from './input.js'

import type { HidIdentity } from './discover.js'
import { dialInput, dialSoftwareModeFeature } from './hid/dial-report.js'
import { PID_BASE, PID_DIAL, PID_KEYS, PID_KNOB, PID_ROLLER, PID_SLIDER } from './hid/ids.js'
import { CHUNK_MAX, diffKeys, keySnapshotFromReport, releasedSnapshot, softwareModeFeature } from './hid/keys.js'
import {
	inputPayload,
	inputReport,
	knobControl,
	knobLedIndex,
	LED_BASE,
	looseRollerReport,
	LED_INDEX_ALL,
	LED_KNOB,
	LED_SLIDER,
} from './hid/m0.js'
import { BacklightQueue, KeyImageQueue, LedQueue, ScreenQueue } from './hid/queue.js'

/**
 * How long one read waits for input. Reads only run while a module has nothing to write, so
 * this timeout does not slow transfers; it bounds how long `close` waits and how stale a
 * module can be about new reports. Debug logging times each read, so it samples more finely.
 */
function readTimeoutMs(): number {
	return isDebugEnabled() ? 20 : 50
}
const WATCH_MS = 1000

export interface HidPort {
	write(data: Uint8Array): Promise<void>
	sendFeatureReport(data: Uint8Array): Promise<void>
	read(timeoutMs: number): Promise<Uint8Array | null>
	close(): Promise<void>
}

export interface HidOpener {
	open(path: string): Promise<HidPort>
}

interface OpenModule {
	productId: number
	port: HidPort
	/** Set while this module has reports to write. */
	writing: boolean
	/** Resolves the read loop's wait for `writing` to clear. */
	wake: (() => void) | null
}

function chunkCount(jpeg: Uint8Array): number {
	return Math.ceil(jpeg.length / CHUNK_MAX)
}

export class UsbLink {
	private readonly keys = new KeyImageQueue()
	private readonly screen = new ScreenQueue()
	private readonly backlight = new BacklightQueue()
	private readonly knobLeds = new LedQueue(LED_KNOB)
	private readonly sliderLeds = new LedQueue(LED_SLIDER)
	private readonly baseLeds = new LedQueue(LED_BASE)
	private readonly keyState = releasedSnapshot()
	private readonly knobPressed: [boolean, boolean, boolean] = [false, false, false]
	private readonly sliderValues: Array<number | null> = [null, null, null, null, null]
	private dialPressed = false
	private modules: OpenModule[] = []
	private openPids: number[] = []
	private stopping = false
	private closed = false
	private timer: ReturnType<typeof setInterval> | null = null
	private readonly opener: HidOpener
	private readonly listPids: () => number[]
	private onEvent: ((event: DaemonEvent) => void) | null = null
	private onLost: ((error: Error) => void) | null = null

	constructor(opener: HidOpener, listPids: () => number[]) {
		this.opener = opener
		this.listPids = listPids
	}

	setHandlers(onEvent: (event: DaemonEvent) => void, onLost: (error: Error) => void): void {
		this.onEvent = onEvent
		this.onLost = onLost
	}

	async open(devices: readonly HidIdentity[]): Promise<void> {
		const opened: OpenModule[] = []
		try {
			for (const device of devices) {
				const port = await this.opener.open(device.path)
				opened.push({ productId: device.productId, port, writing: false, wake: null })
				if (device.productId === PID_KEYS) {
					await port.sendFeatureReport(softwareModeFeature())
				}
				if (device.productId === PID_DIAL) {
					await port.sendFeatureReport(dialSoftwareModeFeature())
				}
			}
		} catch (error) {
			await Promise.all(opened.map(async (module) => module.port.close().catch(() => undefined)))
			const detail = error instanceof Error ? error.message : String(error)
			throw new Error(
				`Could not open MasterHub USB. Quit masterhubd and any other program using the device. ${detail}`,
				{ cause: error },
			)
		}
		if (opened.length === 0) {
			throw new Error('No MasterHub modules to open')
		}
		this.modules = opened
		this.openPids = opened.map((module) => module.productId).sort((left, right) => left - right)
	}

	start(): void {
		for (const module of this.modules) {
			void this.writeLoop(module)
			void this.readLoop(module)
		}
		this.timer = setInterval(() => this.watch(), WATCH_MS)
	}

	async close(): Promise<void> {
		if (this.closed) {
			return
		}
		this.stopping = true
		this.closed = true
		if (this.timer) {
			clearInterval(this.timer)
			this.timer = null
		}
		await Promise.all(this.modules.map(async (module) => module.port.close().catch(() => undefined)))
	}

	setBrightness(percent: number): void {
		const brightness = Math.min(100, Math.max(0, Math.round(percent)))
		if (this.has(PID_KEYS)) {
			this.backlight.store(brightness)
		}
		if (this.has(PID_KNOB)) {
			this.knobLeds.setBrightness(LED_INDEX_ALL, brightness)
		}
		if (this.has(PID_SLIDER)) {
			this.sliderLeds.setBrightness(LED_INDEX_ALL, brightness)
		}
		if (this.has(PID_BASE)) {
			this.baseLeds.setBrightness(0, brightness)
		}
	}

	setKeyImage(control: number, jpeg: Uint8Array): void {
		if (!this.has(PID_KEYS)) {
			return
		}
		count('jpeg chunks', chunkCount(jpeg))
		this.keys.store(control, jpeg)
	}

	setDialImage(jpeg: Uint8Array): void {
		if (!this.has(PID_DIAL)) {
			return
		}
		count('jpeg chunks', chunkCount(jpeg))
		this.screen.store(jpeg)
	}

	setColor(controlId: string, color: { r: number; g: number; b: number }): void {
		if (controlId.startsWith('knob/') && this.has(PID_KNOB)) {
			const control = Number(controlId.slice('knob/'.length))
			if (control >= 0 && control <= 2) {
				this.knobLeds.setStaticColor(knobLedIndex(control), color)
			}
			return
		}
		if (controlId.startsWith('slider/') && this.has(PID_SLIDER)) {
			const control = Number(controlId.slice('slider/'.length))
			if (control >= 0 && control <= 4) {
				this.sliderLeds.setStaticColor(control, color)
			}
			return
		}
		if ((controlId === 'dial' || controlId === 'base') && this.has(PID_BASE)) {
			this.baseLeds.setStaticColor(0, color)
		}
	}

	private has(productId: number): boolean {
		return this.modules.some((module) => module.productId === productId)
	}

	/**
	 * Drains every queued report back to back. A read outstanding on the same handle makes
	 * each write wait on libuv's thread pool: a full page took 250 ms per report with one
	 * read in flight and 1 ms per report with none. So the read loop stands down while
	 * `writing` is set; the module sends no input during a transfer anyway. The writer only
	 * yields when the queue is empty.
	 */
	private async writeLoop(module: OpenModule): Promise<void> {
		try {
			while (!this.stopping) {
				const output = this.nextOutput(module.productId)
				if (!output) {
					module.writing = false
					module.wake?.()
					await this.idle()
					continue
				}
				module.writing = true
				const startedAt = now()
				try {
					if (output.feature) {
						await module.port.sendFeatureReport(output.bytes)
					} else {
						await module.port.write(output.bytes)
					}
				} catch (error) {
					count('write errors')
					throw error
				}
				count('flush reports')
				time('flush ms', startedAt, 20)
			}
		} catch (error) {
			if (!this.stopping) {
				console.log(
					`[MasterHub] pid ${module.productId}: write loop failed: ${error instanceof Error ? error.message : String(error)}`,
				)
				this.fail(error)
			}
		}
	}

	private async readLoop(module: OpenModule): Promise<void> {
		try {
			while (!this.stopping) {
				if (module.writing) {
					await this.waitUntilIdle(module)
					continue
				}
				const startedAt = now()
				const report = await module.port.read(readTimeoutMs())
				if (report && report.length > 0) {
					time('read ms', startedAt, 5)
					this.onReport(module.productId, report)
				}
			}
		} catch (error) {
			if (!this.stopping) {
				console.log(
					`[MasterHub] pid ${module.productId}: read loop failed: ${error instanceof Error ? error.message : String(error)}`,
				)
				this.fail(error)
			}
		}
	}

	/** Yields to the event loop while there is nothing to write, so the loop cannot spin. */
	private async idle(): Promise<void> {
		await new Promise<void>((resolve) => setImmediate(resolve))
	}

	/** Blocks the read loop until the module's writer has drained its queue. */
	private async waitUntilIdle(module: OpenModule): Promise<void> {
		await new Promise<void>((resolve) => {
			module.wake = resolve
		})
	}

	private nextOutput(productId: number): { feature: boolean; bytes: Uint8Array } | null {
		if (productId === PID_KEYS) {
			const backlight = this.backlight.take()
			if (backlight) {
				return { feature: true, bytes: backlight }
			}
			const image = this.keys.nextChunk()
			return image ? { feature: false, bytes: image } : null
		}
		if (productId === PID_DIAL) {
			const image = this.screen.nextChunk()
			return image ? { feature: false, bytes: image } : null
		}
		const leds = productId === PID_KNOB ? this.knobLeds : productId === PID_SLIDER ? this.sliderLeds : this.baseLeds
		if (productId !== PID_KNOB && productId !== PID_SLIDER && productId !== PID_BASE) {
			return null
		}
		const report = leds.next()
		return report ? { feature: false, bytes: report } : null
	}

	private onReport(productId: number, report: Uint8Array): void {
		if (productId === PID_KEYS) {
			const next = keySnapshotFromReport(report)
			if (!next) {
				return
			}
			for (const [control, pressed] of diffKeys(this.keyState, next)) {
				this.keyState[control] = pressed
				this.emit({
					action: 'key_state',
					payload: { module: { model: 'M4315', id: 'keys' }, control, pressed },
				})
			}
			return
		}
		if (productId === PID_KNOB) {
			this.emitKnobs(report)
			return
		}
		if (productId === PID_ROLLER) {
			const input = inputPayload(report) ?? looseRollerReport(report)
			if (input?.type !== 'rollers') {
				return
			}
			for (const [control, up] of input.turns) {
				this.emit({
					action: 'roller_rotated',
					payload: {
						module: { model: 'M032LE', id: 'rollers' },
						control,
						direction: up ? 'up' : 'down',
					},
				})
			}
			return
		}
		if (productId === PID_SLIDER) {
			const input = inputReport(report)
			if (input?.type !== 'sliders') {
				return
			}
			input.values.forEach((value, control) => {
				if (this.sliderValues[control] === value) {
					return
				}
				this.sliderValues[control] = value
				this.emit({
					action: 'slider_moved',
					payload: { module: { model: 'M005S', id: 'faders' }, control, value },
				})
			})
			return
		}
		if (productId === PID_DIAL) {
			this.emitDial(report)
		}
	}

	private emitKnobs(report: Uint8Array): void {
		const input = inputReport(report)
		if (!input) {
			return
		}
		if (input.type === 'turns') {
			for (const [index, clockwise] of input.turns) {
				this.emit({
					action: 'knob_rotated',
					payload: {
						module: { model: 'M003K', id: 'knobs' },
						control: knobControl(index),
						direction: clockwise ? 'cw' : 'ccw',
					},
				})
			}
			return
		}
		if (input.type !== 'press') {
			return
		}
		const mapped: [boolean, boolean, boolean] = [false, false, false]
		input.pressed.forEach((pressed, index) => {
			mapped[knobControl(index)] = pressed
		})
		mapped.forEach((pressed, control) => {
			if (this.knobPressed[control] === pressed) {
				return
			}
			this.knobPressed[control] = pressed
			this.emit({
				action: 'knob_state',
				payload: { module: { model: 'M003K', id: 'knobs' }, control, pressed },
			})
		})
	}

	private emitDial(report: Uint8Array): void {
		const input = dialInput(report)
		if (input?.type === 'turn') {
			this.emit({
				action: 'knob_rotated',
				payload: {
					module: { model: 'M0064', id: 'base' },
					control: 0,
					direction: input.clockwise ? 'cw' : 'ccw',
				},
			})
			return
		}
		if (input?.type === 'press' && this.dialPressed !== input.pressed) {
			this.dialPressed = input.pressed
			this.emit({
				action: 'knob_state',
				payload: { module: { model: 'M0064', id: 'base' }, control: 0, pressed: input.pressed },
			})
		}
	}

	private emit(event: DaemonEvent): void {
		this.onEvent?.(event)
	}

	private watch(): void {
		if (this.stopping) {
			return
		}
		let present: number[]
		try {
			present = [...this.listPids()].sort((left, right) => left - right)
		} catch {
			return
		}
		if (present.join(',') !== this.openPids.join(',')) {
			this.fail(new Error('MasterHub modules changed'))
		}
	}

	private fail(error: unknown): void {
		if (this.stopping) {
			return
		}
		this.stopping = true
		const wrapped = error instanceof Error ? error : new Error(String(error))
		this.onLost?.(wrapped)
		void this.close()
	}
}
