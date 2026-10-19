export function parseHexColor(color: string): { r: number; g: number; b: number } | null {
	const match = /^#?([0-9a-fA-F]{6})$/.exec(color.trim())
	const hex = match?.[1]
	if (!hex) {
		return null
	}
	const value = Number.parseInt(hex, 16)
	return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff }
}
