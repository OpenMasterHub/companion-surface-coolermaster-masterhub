/** M4315 HID codec. Byte layout matches `daemons/masterhubd/src/usb/m4315.rs`. */

export const KEY_COUNT = 15
export const REPORT_LEN = 320
export const CHUNK_MAX = REPORT_LEN - 8

const KEY_CHANNEL = 0x34
const KEY_REPORT_ID = 0x02
const KEY_REPORT_LEN = 0x0f
const IMAGE_COMMAND = 0x36

export type KeySnapshot = boolean[]

export function releasedSnapshot(): KeySnapshot {
	return Array.from({ length: KEY_COUNT }, () => false)
}

export function backlightFeature(brightness: number): Uint8Array {
	const report = new Uint8Array(0x20)
	report[0] = 0x03
	report[1] = 0x34
	report[2] = Math.min(100, Math.max(0, brightness))
	return report
}

export function softwareModeFeature(): Uint8Array {
	const report = new Uint8Array(0x20)
	report[0] = 0x03
	report[1] = 0x3a
	report[2] = 0x01
	return report
}

export function keySnapshotFromReport(report: Uint8Array): KeySnapshot | null {
	if (report.length < 4 || report[0] !== 0x01 || report[1] !== KEY_CHANNEL) {
		return null
	}
	const length = report[2] | (report[3] << 8)
	const payload = report.subarray(4, 4 + length)
	if (payload.length < length) {
		return null
	}
	return parseKeyPayload(payload)
}

function parseKeyPayload(payload: Uint8Array): KeySnapshot | null {
	if (payload.length < 2 + KEY_COUNT || payload[0] !== KEY_REPORT_ID || payload[1] !== KEY_REPORT_LEN) {
		return null
	}
	return Array.from({ length: KEY_COUNT }, (_, index) => payload[2 + index] === 0x01)
}

export function diffKeys(previous: KeySnapshot, next: KeySnapshot): Array<[number, boolean]> {
	const edges: Array<[number, boolean]> = []
	for (let index = 0; index < KEY_COUNT; index += 1) {
		if (previous[index] !== next[index]) {
			edges.push([index, next[index] === true])
		}
	}
	return edges
}

export function encodeJpegTransfer(command: number, index: number, jpeg: Uint8Array): Uint8Array[] {
	if (jpeg.length === 0) {
		return []
	}
	const reports: Uint8Array[] = []
	let offset = 0
	let chunkIndex = 0
	while (offset < jpeg.length) {
		const chunkLength = Math.min(CHUNK_MAX, jpeg.length - offset)
		const isLast = offset + chunkLength === jpeg.length
		const report = new Uint8Array(REPORT_LEN)
		report[0] = 0x02
		report[1] = command
		report[2] = chunkIndex & 0xff
		report[3] = (chunkIndex >> 8) & 0xff
		report[4] = chunkLength & 0xff
		report[5] = (chunkLength >> 8) & 0xff
		report[6] = index
		report[7] = isLast ? 1 : 0
		report.set(jpeg.subarray(offset, offset + chunkLength), 8)
		reports.push(report)
		offset += chunkLength
		chunkIndex = (chunkIndex + 1) & 0xffff
	}
	return reports
}

export function encodeButtonImage(index: number, jpeg: Uint8Array): Uint8Array[] {
	return encodeJpegTransfer(IMAGE_COMMAND, index, jpeg)
}
