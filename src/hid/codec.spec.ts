import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { dialInput, dialSoftwareModeFeature, encodeScreen } from './dial-report.js'
import {
	backlightFeature,
	diffKeys,
	encodeButtonImage,
	keySnapshotFromReport,
	releasedSnapshot,
	softwareModeFeature,
	KEY_COUNT,
} from './keys.js'
import { encodeLed, inputReport, knobControl, knobLedIndex, LED_BASE, LED_KNOB, LED_SLIDER } from './m0.js'
import { jpegDimensions } from '../jpeg-size.js'

function envelope(channel: number, payload: number[]): Uint8Array {
	const report = [0x01, channel, payload.length & 0xff, (payload.length >> 8) & 0xff, ...payload]
	return Uint8Array.from(report)
}

function keyPayload(states: number[]): number[] {
	return [0x02, 0x0f, ...states]
}

void describe('M4315 keys', () => {
	void it('treats a held key against a released baseline as a press', () => {
		const states = Array.from({ length: KEY_COUNT }, () => 0)
		states[0] = 0x01
		const next = keySnapshotFromReport(envelope(0x34, keyPayload(states)))
		assert.ok(next)
		assert.equal(next[0], true)
		assert.ok(next.slice(1).every((pressed) => !pressed))
		assert.deepEqual(diffKeys(releasedSnapshot(), next), [[0, true]])
	})

	void it('reports release and unchanged keys as edges', () => {
		const previous = releasedSnapshot()
		previous[14] = true
		previous[2] = true
		const next = releasedSnapshot()
		next[2] = true
		next[4] = true
		assert.deepEqual(diffKeys(previous, next), [
			[4, true],
			[14, false],
		])
		assert.deepEqual(diffKeys(next, next), [])
	})

	void it('ignores a non-press byte and the wrong channel', () => {
		const states = Array.from({ length: KEY_COUNT }, () => 0)
		states[3] = 0x02
		const snapshot = keySnapshotFromReport(envelope(0x34, keyPayload(states)))
		assert.ok(snapshot)
		assert.ok(snapshot.every((pressed) => !pressed))

		const report = envelope(0x34, keyPayload(Array.from({ length: KEY_COUNT }, () => 0x01)))
		report[1] = 0x35
		assert.equal(keySnapshotFromReport(report), null)
		assert.equal(keySnapshotFromReport(Uint8Array.from([0x01, 0x34, 0x02, 0x00, 0x02, 0x0f])), null)
	})

	void it('splits a JPEG longer than one chunk', () => {
		const jpeg = Uint8Array.from({ length: 313 }, (_, index) => index & 0xff)
		const reports = encodeButtonImage(4, jpeg)
		assert.equal(reports.length, 2)
		assert.equal(reports[0]?.[0], 0x02)
		assert.equal(reports[0]?.[1], 0x36)
		assert.equal((reports[0]?.[2] ?? 0) | ((reports[0]?.[3] ?? 0) << 8), 0)
		assert.equal((reports[0]?.[4] ?? 0) | ((reports[0]?.[5] ?? 0) << 8), 312)
		assert.equal(reports[0]?.[6], 4)
		assert.equal(reports[0]?.[7], 0)
		assert.deepEqual(reports[0]?.subarray(8), jpeg.subarray(0, 312))
		assert.equal((reports[1]?.[2] ?? 0) | ((reports[1]?.[3] ?? 0) << 8), 1)
		assert.equal((reports[1]?.[4] ?? 0) | ((reports[1]?.[5] ?? 0) << 8), 1)
		assert.equal(reports[1]?.[6], 4)
		assert.equal(reports[1]?.[7], 1)
		assert.equal(reports[1]?.[8], jpeg[312])
		assert.ok(reports[1]?.subarray(9).every((byte) => byte === 0))
	})

	void it('sends nothing for an empty JPEG', () => {
		assert.deepEqual(encodeButtonImage(0, Uint8Array.from([])), [])
	})

	void it('encodes the software-mode and backlight features', () => {
		const mode = softwareModeFeature()
		assert.deepEqual(Array.from(mode.subarray(0, 3)), [0x03, 0x3a, 0x01])
		assert.ok(mode.subarray(3).every((byte) => byte === 0))
		const backlight = backlightFeature(100)
		assert.deepEqual(Array.from(backlight.subarray(0, 3)), [0x03, 0x34, 100])
		assert.ok(backlight.subarray(3).every((byte) => byte === 0))
		assert.equal(backlightFeature(255)[2], 100)
	})
})

void describe('M0 modules', () => {
	void it('skips unchanged knobs', () => {
		assert.deepEqual(inputReport(envelope(0x2a, [0x00, 0x03, 0x01, 0xff, 0x00])), {
			type: 'turns',
			turns: [
				[0, true],
				[2, false],
			],
		})
	})

	void it('swaps knob report order between left, right, and top', () => {
		assert.equal(knobControl(0), 1)
		assert.equal(knobControl(1), 2)
		assert.equal(knobControl(2), 0)
		assert.equal(knobLedIndex(0), 2)
		assert.equal(knobLedIndex(1), 0)
		assert.equal(knobLedIndex(2), 1)
		assert.equal(knobLedIndex(0xff), 0xff)
	})

	void it('treats only 0x01 as a knob press', () => {
		assert.deepEqual(inputReport(envelope(0x2a, [0x03, 0x03, 0x01, 0x00, 0x02])), {
			type: 'press',
			pressed: [true, false, false],
		})
	})

	void it('parses roller and slider reports', () => {
		assert.deepEqual(inputReport(envelope(0x2a, [0x01, 0x02, 0x00, 0xff])), {
			type: 'rollers',
			turns: [[0, true]],
		})
		assert.deepEqual(inputReport(envelope(0x2a, [0x01, 0x02, 0xff, 0x01])), {
			type: 'rollers',
			turns: [[1, false]],
		})
		assert.deepEqual(inputReport(envelope(0x2a, [0xff, 0x01])), {
			type: 'rollers',
			turns: [[1, false]],
		})
		assert.deepEqual(inputReport(envelope(0x2a, [0x02, 0x05, 0x33, 0x00, 0x64, 0x19, 0x4b])), {
			type: 'sliders',
			values: [0x33, 0x00, 0x64, 0x19, 0x4b],
		})
		assert.deepEqual(inputReport(envelope(0x2a, [0x00, 0x05, 1, 2, 3, 4, 5])), {
			type: 'sliders',
			values: [1, 2, 3, 4, 5],
		})
	})

	void it('ignores the base heartbeat and an out-of-range slider', () => {
		const heartbeat = new Uint8Array(64)
		heartbeat.set([0x01, 0x2b, 0x01, 0x00, 0x00])
		assert.equal(inputReport(heartbeat), null)
		assert.equal(inputReport(envelope(0x2a, [0x02, 0x05, 0, 0, 101, 0, 0])), null)
	})

	void it('matches the documented LED examples', () => {
		const mode = encodeLed(LED_KNOB, { kind: 'mode', index: 0xff, mode: 0x09, save: true })
		assert.deepEqual(Array.from(mode.subarray(0, 6)), [0x02, 0x2c, 0x02, 0xff, 0x09, 0x01])
		const color = encodeLed(LED_SLIDER, { kind: 'color', index: 0xff, r: 0x33, g: 0x24, b: 0x3f, save: true })
		assert.deepEqual(Array.from(color.subarray(0, 8)), [0x02, 0x2d, 0x01, 0xff, 0x33, 0x24, 0x3f, 0x01])
		const brightness = encodeLed(LED_BASE, { kind: 'brightness', index: 0, brightness: 0x64 })
		assert.deepEqual(Array.from(brightness.subarray(0, 5)), [0x02, 0x2e, 0x00, 0x00, 0x64])
		assert.ok(brightness.subarray(5).every((byte) => byte === 0))
	})
})

void describe('1xDial', () => {
	void it('matches the captured turn and press reports', () => {
		assert.deepEqual(dialInput(envelope(0x44, [0x03, 0x01, 0x00])), { type: 'turn', clockwise: true })
		assert.deepEqual(dialInput(envelope(0x44, [0x03, 0x01, 0x01])), { type: 'turn', clockwise: false })
		assert.deepEqual(dialInput(envelope(0x44, [0x04, 0x01, 0x01])), { type: 'press', pressed: true })
		assert.deepEqual(dialInput(envelope(0x44, [0x04, 0x01, 0x00])), { type: 'press', pressed: false })
		assert.equal(dialInput(envelope(0x44, [0x03, 0x01, 0xff])), null)
	})

	void it('matches the captured software-mode feature', () => {
		const report = dialSoftwareModeFeature()
		assert.deepEqual(
			Array.from(report.subarray(0, 13)),
			[0x03, 0x49, 0x01, 0x00, 0x00, 0x00, 0xf0, 0x00, 0xf0, 0x00, 0x01, 0xf0, 0xf0],
		)
		assert.ok(report.subarray(13).every((byte) => byte === 0))
	})

	void it('uses the captured screen slot', () => {
		const reports = encodeScreen(Uint8Array.from([0xff, 0xd8, 0xff]))
		assert.equal(reports.length, 1)
		assert.equal(reports[0]?.[0], 0x02)
		assert.equal(reports[0]?.[1], 0x45)
		assert.equal(reports[0]?.[6], 0x30)
		assert.equal(reports[0]?.[7], 1)
	})
})

void describe('JPEG size', () => {
	void it('reads a SOF0 square and rejects a truncated header', () => {
		const jpeg = Uint8Array.from([
			0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x48, 0x00, 0x48, 0x01, 0x00, 0x11, 0x00,
		])
		assert.deepEqual(jpegDimensions(jpeg), { width: 72, height: 72 })
		assert.equal(jpegDimensions(Uint8Array.from([0xff, 0xd8, 0xff])), null)
	})
})
