/** 1xDial HID codec. Byte layout matches `daemons/masterhubd/src/usb/dial.rs`. */

import { encodeJpegTransfer } from './keys.js'

const SCREEN_COMMAND = 0x45
const SCREEN_SLOT = 0x30
const INPUT_CHANNEL = 0x44

export type DialInput = { type: 'turn'; clockwise: boolean } | { type: 'press'; pressed: boolean }

export function dialSoftwareModeFeature(): Uint8Array {
	const report = new Uint8Array(0x20)
	report[0] = 0x03
	report[1] = 0x49
	report[2] = 0x01
	report[6] = 240 & 0xff
	report[8] = 240 & 0xff
	report[10] = 0x01
	report[11] = 0xf0
	report[12] = 0xf0
	return report
}

export function encodeScreen(jpeg: Uint8Array): Uint8Array[] {
	return encodeJpegTransfer(SCREEN_COMMAND, SCREEN_SLOT, jpeg)
}

export function dialInput(report: Uint8Array): DialInput | null {
	if (report.length < 4 || report[0] !== 0x01 || report[1] !== INPUT_CHANNEL) {
		return null
	}
	const length = report[2] | (report[3] << 8)
	const payload = report.subarray(4, 4 + length)
	if (payload.length < length || payload.length !== 3) {
		return null
	}
	if (payload[0] === 0x03 && payload[1] === 0x01 && payload[2] === 0x00) {
		return { type: 'turn', clockwise: true }
	}
	if (payload[0] === 0x03 && payload[1] === 0x01 && payload[2] === 0x01) {
		return { type: 'turn', clockwise: false }
	}
	if (payload[0] === 0x04 && payload[1] === 0x01) {
		return { type: 'press', pressed: payload[2] === 0x01 }
	}
	return null
}
