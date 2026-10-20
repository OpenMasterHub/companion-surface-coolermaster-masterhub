import { encodeScreen } from './dial-report.js'
import { backlightFeature, encodeButtonImage } from './keys.js'
import { encodeLed, LED_MODE_STATIC, type LedCommand } from './m0.js'

export class KeyImageQueue {
	private readonly pending = new Map<number, Uint8Array>()
	private active: { control: number; jpeg: Uint8Array; reports: Uint8Array[]; next: number } | null = null

	/** Replaces any JPEG that has not started transferring yet. */
	store(control: number, jpeg: Uint8Array): void {
		this.pending.set(control, jpeg)
	}

	/** The frame each key last showed, including one still transferring. */
	snapshot(): Array<[number, Uint8Array]> {
		const frames = [...this.pending.entries()]
		const active = this.active
		if (active && !this.pending.has(active.control)) {
			frames.push([active.control, active.jpeg])
		}
		return frames
	}

	/** One output report. A newer JPEG for the active key replaces the transfer. */
	nextChunk(): Uint8Array | null {
		if (this.active) {
			const latest = this.pending.get(this.active.control)
			if (latest && latest !== this.active.jpeg) {
				this.active = null
			}
		}
		if (!this.active) {
			const next = this.pending.entries().next()
			if (next.done) {
				return null
			}
			const [control, jpeg] = next.value
			this.pending.delete(control)
			const reports = encodeButtonImage(control, jpeg)
			if (reports.length === 0) {
				return this.nextChunk()
			}
			this.active = { control, jpeg, reports, next: 0 }
		}
		const chunk = this.active.reports[this.active.next]
		this.active.next += 1
		if (!chunk || this.active.next >= this.active.reports.length) {
			this.active = null
		}
		return chunk ?? null
	}
}

export class ScreenQueue {
	private pending: Uint8Array | null = null
	private shown: Uint8Array | null = null
	private active: { reports: Uint8Array[]; next: number } | null = null

	store(jpeg: Uint8Array): void {
		this.pending = jpeg
	}

	/** The frame the dial last showed, or is about to show. */
	shownFrame(): Uint8Array | null {
		return this.pending ?? this.shown
	}

	/** Finishes the current frame, then starts the newest JPEG when it differs. */
	nextChunk(): Uint8Array | null {
		if (!this.active) {
			const jpeg = this.pending
			this.pending = null
			if (!jpeg || (this.shown && sameBytes(this.shown, jpeg))) {
				return null
			}
			const reports = encodeScreen(jpeg)
			if (reports.length === 0) {
				return null
			}
			this.shown = jpeg
			this.active = { reports, next: 0 }
		}
		const chunk = this.active.reports[this.active.next]
		this.active.next += 1
		if (!chunk || this.active.next >= this.active.reports.length) {
			this.active = null
		}
		return chunk ?? null
	}
}

export class BacklightQueue {
	private latest: number | null = null
	/** The last brightness sent, so a reopened keypad can get it again. */
	private shown: number | null = null

	store(brightness: number): void {
		this.latest = brightness
	}

	take(): Uint8Array | null {
		if (this.latest === null) {
			return null
		}
		const brightness = this.latest
		this.latest = null
		this.shown = brightness
		return backlightFeature(brightness)
	}

	/** Queues the last brightness again, for a keypad that was reopened. */
	restore(): void {
		if (this.shown !== null) {
			this.latest = this.shown
		}
	}
}

interface PendingLed {
	kind: LedCommand['kind']
	index: number
	report: Uint8Array
}

export class LedQueue {
	private readonly pending: PendingLed[] = []
	private readonly module: number
	/** The newest command for each index and kind, so a reopened module can be redrawn. */
	private readonly latest = new Map<string, LedCommand>()

	constructor(module: number) {
		this.module = module
	}

	setStaticColor(index: number, color: { r: number; g: number; b: number }): void {
		this.store({ kind: 'mode', index, mode: LED_MODE_STATIC, save: false })
		this.store({ kind: 'color', index, r: color.r, g: color.g, b: color.b, save: false })
	}

	setBrightness(index: number, brightness: number): void {
		this.store({ kind: 'brightness', index, brightness })
	}

	next(): Uint8Array | null {
		return this.pending.shift()?.report ?? null
	}

	/** Queues the last command of every index again. */
	restore(): void {
		for (const command of this.latest.values()) {
			this.pending.push({ kind: command.kind, index: command.index, report: encodeLed(this.module, command) })
		}
	}

	private store(command: LedCommand): void {
		const report = encodeLed(this.module, command)
		this.latest.set(`${command.kind}:${command.index}`, command)
		const slot = this.pending.findIndex((item) => item.kind === command.kind && item.index === command.index)
		const pending = { kind: command.kind, index: command.index, report }
		if (slot >= 0) {
			this.pending[slot] = pending
			return
		}
		this.pending.push(pending)
	}
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
	if (left.length !== right.length) {
		return false
	}
	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) {
			return false
		}
	}
	return true
}
