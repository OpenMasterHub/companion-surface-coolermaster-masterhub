import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { HidIdentity } from './discover.js'
import { PID_KEYS, PID_KNOB, VID } from './hid/ids.js'
import { encodeButtonImage, softwareModeFeature } from './hid/keys.js'
import { encodeLed, LED_KNOB } from './hid/m0.js'
import type { DaemonEvent } from './input.js'
import type { HidOpener, HidPort } from './session.js'
import { UsbLink } from './session.js'

const identity: HidIdentity = { vendorId: VID, productId: PID_KEYS, path: '/dev/fake-keys' }
/** Key input report with key 0 held: channel 0x34, then report id 0x02 with 15 key bytes. */
const PRESS_REPORT = Uint8Array.from([0x01, 0x34, 0x11, 0x00, 0x02, 0x0f, 0x01, ...new Uint8Array(14)])

class FakePort implements HidPort {
	readonly writes: Uint8Array[] = []
	readonly features: Uint8Array[] = []
	/** Incremented by `readStart`. */
	starts = 0
	closed = false
	private deliver: ((report: Uint8Array) => void) | null = null

	/** A real `node-hid` write hops to libuv's shared thread pool and back. */
	async write(data: Uint8Array): Promise<void> {
		this.writes.push(data)
		await new Promise<void>((resolve) => setTimeout(resolve, 5))
	}

	async sendFeatureReport(data: Uint8Array): Promise<void> {
		this.features.push(data)
	}

	async readStart(onReport: (report: Uint8Array) => void): Promise<void> {
		this.starts += 1
		this.deliver = onReport
	}

	async pauseInput(): Promise<void> {
		this.deliver = null
	}

	/** Delivers one report to the reader, if one is running. */
	queueReport(): void {
		this.deliver?.(PRESS_REPORT)
	}

	async close(): Promise<void> {
		this.closed = true
		this.deliver = null
	}
}

/** A device list that reports whatever modules the test says are plugged in. */
class Devices {
	readonly ports: FakePort[] = []
	private present: HidIdentity[]

	constructor(present: HidIdentity[]) {
		this.present = present
	}

	list(): HidIdentity[] {
		return this.present
	}

	plug(device: HidIdentity): void {
		this.present = [...this.present, device]
	}

	unplug(device: HidIdentity): void {
		this.present = this.present.filter((item) => item.path !== device.path)
	}

	opener(): HidOpener {
		return {
			open: async (path: string) => {
				const port = new FakePort()
				this.ports.push(port)
				assert.ok(path)
				return port
			},
		}
	}
}

async function waitFor(what: string, predicate: () => boolean, timeoutMs = 2000): Promise<void> {
	return new Promise((resolve, reject) => {
		const startedAt = Date.now()
		const poll = (): void => {
			if (predicate()) {
				resolve()
				return
			}
			if (Date.now() - startedAt > timeoutMs) {
				reject(new Error(`timed out waiting for ${what}`))
				return
			}
			setTimeout(poll, 5)
		}
		poll()
	})
}

void describe('UsbLink output loop', () => {
	void it('starts input before writing, then sends every report of a key image', { timeout: 5000 }, async () => {
		const devices = new Devices([identity])
		const link = new UsbLink(devices.opener(), () => devices.list())
		const events: DaemonEvent[] = []
		let lost: Error | null = null
		link.setHandlers(
			(event) => events.push(event),
			(error) => {
				lost = error
			},
		)
		await link.open([identity])
		await link.start()
		const port = devices.ports[0]
		assert.ok(port)
		try {
			// Input is live straight away, and the keypad's software mode is on.
			assert.equal(port.starts, 1)
			assert.deepEqual(port.features[0], softwareModeFeature())

			const jpeg = new Uint8Array(700).fill(7)
			const chunks = encodeButtonImage(3, jpeg).length
			link.setKeyImage(3, jpeg)
			await waitFor('key image reports', () => port.writes.length >= chunks, 1000)

			assert.equal(port.writes.length, chunks)
			assert.equal(port.writes[0]?.[6], 3)
			assert.equal(lost, null)

			port.queueReport()
			await waitFor('key press event', () => events.length > 0)
		} finally {
			await link.close()
		}
	})

	void it('queues a knob colour and sends only its own reports', { timeout: 5000 }, async () => {
		const knob: HidIdentity = { vendorId: VID, productId: PID_KNOB, path: '/dev/fake-knob' }
		const devices = new Devices([knob])
		const link = new UsbLink(devices.opener(), () => devices.list())
		link.setHandlers(
			() => undefined,
			() => undefined,
		)
		await link.open([knob])
		await link.start()
		const port = devices.ports[0]
		assert.ok(port)

		const expected = [
			encodeLed(LED_KNOB, { kind: 'mode', index: 2, mode: 1, save: false }),
			encodeLed(LED_KNOB, { kind: 'color', index: 2, r: 9, g: 8, b: 7, save: false }),
		]
		try {
			link.setColor('knob/0', { r: 9, g: 8, b: 7 })
			await waitFor('knob LED reports', () => port.writes.length >= expected.length, 1000)
			assert.deepEqual([...port.writes], expected)
			assert.equal(port.starts, 1)
		} finally {
			await link.close()
		}
	})

	void it(
		'keeps the other modules working when one is unplugged, and reopens it in place',
		{ timeout: 8000 },
		async () => {
			const keyIdentity: HidIdentity = { vendorId: VID, productId: PID_KEYS, path: '/dev/fake-keys' }
			const knobIdentity: HidIdentity = { vendorId: VID, productId: PID_KNOB, path: '/dev/fake-knob' }
			const devices = new Devices([keyIdentity, knobIdentity])
			const link = new UsbLink(devices.opener(), () => devices.list())
			const events: DaemonEvent[] = []
			let lost: Error | null = null
			link.setHandlers(
				(event) => events.push(event),
				(error) => {
					lost = error
				},
			)
			await link.open([keyIdentity, knobIdentity])
			await link.start()
			const [keyPort, knobPort] = devices.ports
			assert.ok(keyPort && knobPort)

			try {
				// Unplug the knob: the surface stays up, the keypad keeps its reader and input.
				devices.unplug(knobIdentity)
				await waitFor('knob closed', () => knobPort.closed, 3000)
				assert.equal(lost, null)
				assert.equal(keyPort.closed, false)
				keyPort.queueReport()
				await waitFor('key press event', () => events.length > 0)
				assert.equal(events[0]?.action, 'key_state')

				// Plug it back in: it is reopened in place with input started.
				devices.plug({ ...knobIdentity, path: '/dev/fake-knob-2' })
				await waitFor('knob reopened', () => devices.ports.length === 3, 3000)
				const reopened = devices.ports[2]
				assert.ok(reopened)
				await waitFor('knob input started', () => reopened.starts === 1, 1000)
				assert.equal(lost, null)
			} finally {
				await link.close()
			}
		},
	)
})
