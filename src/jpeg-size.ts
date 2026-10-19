/** SOF width and height. A JPEG that is not the panel size must not be written. */
export function jpegDimensions(jpeg: Uint8Array): { width: number; height: number } | null {
	if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
		return null
	}
	let offset = 2
	while (offset + 8 < jpeg.length) {
		if (jpeg[offset] !== 0xff) {
			return null
		}
		const marker = jpeg[offset + 1] ?? 0
		if (marker === 0xd8) {
			offset += 2
			continue
		}
		if (marker === 0xd9 || marker === 0xda) {
			return null
		}
		const length = ((jpeg[offset + 2] ?? 0) << 8) | (jpeg[offset + 3] ?? 0)
		if (length < 2 || offset + 2 + length > jpeg.length) {
			return null
		}
		if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
			const height = ((jpeg[offset + 5] ?? 0) << 8) | (jpeg[offset + 6] ?? 0)
			const width = ((jpeg[offset + 7] ?? 0) << 8) | (jpeg[offset + 8] ?? 0)
			return { width, height }
		}
		offset += 2 + length
	}
	return null
}

export function jpegMatching(jpeg: Uint8Array, edge: number): Uint8Array | null {
	const size = jpegDimensions(jpeg)
	if (!size || size.width !== edge || size.height !== edge) {
		return null
	}
	return jpeg
}
