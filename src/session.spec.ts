import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { HidIdentity } from './discover.js'
import { PID_KEYS, PID_KNOB, VID } from './hid/ids.js'
import { encodeButtonImage } from './hid/keys.js'
import { encodeLed, LED_KNOB } from './hid/m0.js'
import type { DaemonEvent } from './input.js'
import type { HidOpener, HidPort } from './session.js'
import { UsbLink } from './session.js'

const identity: HidIdentity = { vendorId: VID, productId: PID_KEYS, path: '/dev/fake-keys' }
/** Key input report with key 0 held: channel 0x34, then report id 0x02 with 15 key bytes. */
const PRESS_REPORT = Uint8Array.from([0x01, 0x34, 0x11, 0x00, 0x02, 0x0f, 0x01, ...new Uint8Array(14)])

interface WaitingRead {
	release: () => void
}

class FakePort implements HidPort {
	readonly writes: Uint8Array[] = []
	/** How many `read` calls have been made, including the one still blocked. */
	readCount = 0
	private readonly reads: WaitingRead[] = []
	private queuedReports = 0

	/** A real `node-hid` write hops to libuv's shared 4-thread pool and back. */
	async write(data: Uint8Array): Promise<void> {
		this.writes.push(data)
		await new Promise<void>((resolve) => setTimeout(resolve, 5))
	}

	async sendFeatureReport(_data: Uint8Array): Promise<void> {}

	/** Blocks like `hid_read_timeout` until a report is queued or the timeout fires. */
	async read(timeoutMs: number): Promise<Uint8Array | null> {
		this.readCount += 1
		return new Promise((resolve) => {
			const entry: WaitingRead = {
				release: (): void => {
					clearTimeout(timer)
					this.forget(entry)
					resolve(PRESS_REPORT)
				},
			}
			const timer = setTimeout(() => {
				this.forget(entry)
				resolve(null)
			}, timeoutMs)
			if (this.queuedReports > 0) {
				this.queuedReports -= 1
				entry.release()
				return
			}
			this.reads.push(entry)
		})
	}

	/** Delivers one report to the reader, now or as soon as the reader asks for one. */
	queueReport(): void {
		const [entry] = this.reads
		if (entry) {
			entry.release()
			return
		}
		this.queuedReports += 1
	}

	async close(): Promise<void> {
		for (const entry of [...this.reads]) {
			entry.release()
		}
	}

	private forget(entry: WaitingRead): void {
		const index = this.reads.indexOf(entry)
		if (index >= 0) {
			this.reads.splice(index, 1)
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
	void it('sends every report of a key image while a read is still blocked', { timeout: 5000 }, async () => {
		const port = new FakePort()
		const opener: HidOpener = { open: async () => port }
		const link = new UsbLink(opener, () => [PID_KEYS])
		const events: DaemonEvent[] = []
		let lost: Error | null = null
		link.setHandlers(
			(event) => events.push(event),
			(error) => {
				lost = error
			},
		)
		await link.open([identity])
		link.start()
		try {
			const jpeg = new Uint8Array(700).fill(7)
			const chunks = encodeButtonImage(3, jpeg).length
			link.setKeyImage(3, jpeg)
			await waitFor('key image reports', () => port.writes.length >= chunks, 100)

			// The writer drained every report even though no read had completed.
			assert.equal(port.writes.length, chunks)
			assert.equal(port.writes[0]?.[6], 3)
			assert.equal(lost, null)

			// Input still arrives once a read returns.
			port.queueReport()
			await waitFor('key press event', () => events.length > 0)
		} finally {
			await link.close()
		}
	})

	void it('keeps reads out of the way while reports are being written', { timeout: 5000 }, async () => {
		const knob: HidIdentity = { vendorId: VID, productId: PID_KNOB, path: '/dev/fake-knob' }
		const port = new FakePort()
		const opener: HidOpener = { open: async () => port }
		const link = new UsbLink(opener, () => [PID_KNOB])
		link.setHandlers(
			() => undefined,
			() => undefined,
		)
		await link.open([knob])
		link.start()
		// Let the read loop block in its first read, so no report is waiting to be delivered.
		await waitFor('first read', () => port.readCount === 1, 1000)

		const expected = [
			encodeLed(LED_KNOB, { kind: 'mode', index: 2, mode: 1, save: false }),
			encodeLed(LED_KNOB, { kind: 'color', index: 2, r: 9, g: 8, b: 7, save: false }),
		]
		try {
			link.setColor('knob/0', { r: 9, g: 8, b: 7 })
			await waitFor('knob LED reports', () => port.writes.length >= expected.length, 1000)
			// Snapshot right away: `close()` stops the writer but lets the blocked read end.
			const readCount = port.readCount
			const writes = [...port.writes]
			assert.equal(readCount, 1)
			assert.deepEqual(writes, expected)
		} finally {
			await link.close()
		}
	})
})
