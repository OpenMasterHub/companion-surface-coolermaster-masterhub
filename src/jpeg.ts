import { encode as encodeJpeg } from 'jpeg-js'

import { count, now, time } from './debug.js'

/** masterhubd rejects a JPEG larger than this. */
export const MAX_JPEG_BYTES = 64 * 1024

const blackFrames = new Map<string, Buffer>()

export interface JpegFrame {
	rgb: Uint8Array
	width: number
	height: number
}

export function encodeRgbJpeg(rgb: Uint8Array, width: number, height: number): Buffer {
	const pixels = width * height
	if (rgb.length < pixels * 3) {
		throw new Error(`expected ${pixels * 3} RGB bytes, got ${rgb.length}`)
	}
	const rgba = Buffer.alloc(pixels * 4)
	for (let pixel = 0; pixel < pixels; pixel += 1) {
		rgba[pixel * 4] = rgb[pixel * 3] ?? 0
		rgba[pixel * 4 + 1] = rgb[pixel * 3 + 1] ?? 0
		rgba[pixel * 4 + 2] = rgb[pixel * 3 + 2] ?? 0
		rgba[pixel * 4 + 3] = 255
	}
	let quality = 80
	let encoded = encodeJpeg({ data: rgba, width, height }, quality)
	while (encoded.data.length > MAX_JPEG_BYTES && quality > 10) {
		quality -= 10
		encoded = encodeJpeg({ data: rgba, width, height }, quality)
	}
	if (encoded.data.length > MAX_JPEG_BYTES) {
		throw new Error(`JPEG is ${encoded.data.length} bytes, above the 64 KiB limit`)
	}
	return encoded.data
}

export function blackJpeg(width: number, height: number): Buffer {
	const key = `${width}x${height}`
	const cached = blackFrames.get(key)
	if (cached) {
		return cached
	}
	const encoded = encodeRgbJpeg(new Uint8Array(width * height * 3), width, height)
	blackFrames.set(key, encoded)
	return encoded
}

/**
 * Encodes the newest frame for a key immediately and returns it, or `null` when a later frame
 * for the same key has already been produced. A key is a few milliseconds of work and the HID
 * writer is idle until the image is queued, so encoding straight away is what lets a burst of
 * draws land on the module at once. It must not wait for a turn: the previous version queued
 * frames and yielded with `setImmediate` before each encode, so every draw in a burst waited
 * for all the encodes ahead of it.
 */
export class LatestJpegEncoder {
	private readonly latest = new Map<string, object>()

	/** Registers the frame before reading it, so a draw that starts mid-encode wins. */
	encode(key: string, frame: JpegFrame): Buffer | null {
		const ticket = {}
		this.latest.set(key, ticket)
		const startedAt = now()
		const jpeg = encodeRgbJpeg(frame.rgb, frame.width, frame.height)
		time('encode ms', startedAt, 30)
		count('jpeg bytes', jpeg.length)
		if (this.latest.get(key) !== ticket) {
			return null
		}
		this.latest.delete(key)
		return jpeg
	}
}
