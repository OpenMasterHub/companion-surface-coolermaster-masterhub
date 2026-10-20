import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LatestJpegEncoder } from './jpeg.js'
import { jpegDimensions } from './jpeg-size.js'

interface Frame {
	rgb: Uint8Array
	width: number
	height: number
}

function frame(value: number, width = 72, height = 72): Frame {
	return { rgb: new Uint8Array(width * height * 3).fill(value), width, height }
}

void describe('LatestJpegEncoder', () => {
	void it('encodes the frame straight away so a burst can start transferring at once', () => {
		const encoder = new LatestJpegEncoder()
		const encoded = encoder.encode('key/0', frame(255))

		// No promise and no deferred turn: the JPEG exists by the time `draw` returns to its caller.
		assert.ok(encoded)
		assert.deepEqual(jpegDimensions(encoded), { width: 72, height: 72 })
	})

	void it('keeps frames for different keys', () => {
		const encoder = new LatestJpegEncoder()
		const key = encoder.encode('key/0', frame(255))
		const next = encoder.encode('key/1', frame(0))
		const dial = encoder.encode('dial', frame(128, 240, 240))

		assert.ok(key)
		assert.ok(next)
		assert.ok(dial)
		assert.deepEqual(jpegDimensions(dial), { width: 240, height: 240 })
	})

	void it('drops the frame when the same key is drawn again during the encode', () => {
		const encoder = new LatestJpegEncoder()
		const interrupted: Frame = {
			get rgb(): Uint8Array {
				// Runs after the frame is registered, so this is a newer draw landing mid-encode.
				encoder.encode('key/0', frame(0))
				return new Uint8Array(72 * 72 * 3).fill(255)
			},
			width: 72,
			height: 72,
		}

		assert.equal(encoder.encode('key/0', interrupted), null)
		// The newer frame was not replaced again, so it is sent.
		assert.ok(encoder.encode('key/0', frame(128)))
	})
})
