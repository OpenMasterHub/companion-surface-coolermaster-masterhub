import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LED_KNOB } from './m0.js'
import { KeyImageQueue, LedQueue, ScreenQueue } from './queue.js'

void describe('output queues', () => {
	void it('writes one key chunk and replaces the active JPEG', () => {
		const queue = new KeyImageQueue()
		const first = Uint8Array.from({ length: 313 }, (_, index) => index & 0xff)
		queue.store(4, first)
		const chunk = queue.nextChunk()
		assert.equal(chunk?.[6], 4)
		assert.equal(chunk?.[7], 0)
		const replacement = Uint8Array.from([1, 2, 3])
		queue.store(4, replacement)
		const next = queue.nextChunk()
		assert.equal(next?.[7], 1)
		assert.equal(next?.[8], 1)
		assert.equal(queue.nextChunk(), null)
	})

	void it('keeps the newest dial frame until the current transfer finishes', () => {
		const queue = new ScreenQueue()
		const first = Uint8Array.from({ length: 313 }, () => 9)
		queue.store(first)
		assert.equal(queue.nextChunk()?.[7], 0)
		queue.store(Uint8Array.from([4, 5, 6]))
		assert.equal(queue.nextChunk()?.[7], 1)
		const replaced = queue.nextChunk()
		assert.equal(replaced?.[7], 1)
		assert.equal(replaced?.[8], 4)
		assert.equal(queue.nextChunk(), null)
	})

	void it('replaces an LED command for the same index', () => {
		const queue = new LedQueue(LED_KNOB)
		queue.setStaticColor(2, { r: 1, g: 2, b: 3 })
		queue.setStaticColor(2, { r: 9, g: 8, b: 7 })
		const mode = queue.next()
		const color = queue.next()
		assert.equal(mode?.[1], 0x2c)
		assert.equal(mode?.[4], 0x01)
		assert.equal(color?.[1], 0x2d)
		assert.equal(color?.[4], 9)
		assert.equal(color?.[5], 8)
		assert.equal(color?.[6], 7)
		assert.equal(queue.next(), null)
	})
})
