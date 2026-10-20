/** M0 HID codec for M003K, M005S, M032LE, and M0064. Matches `daemons/masterhubd/src/usb/m0.rs`. */

export const LED_BASE = 0x00
export const LED_SLIDER = 0x01
export const LED_KNOB = 0x02
export const LED_INDEX_ALL = 0xff
export const LED_MODE_STATIC = 0x01
export const LED_REPORT_LEN = 0x40

const INPUT_CHANNEL = 0x2a
const LED_MODE = 0x2c
const LED_COLOR = 0x2d
const LED_BRIGHTNESS = 0x2e
const KNOB_TURN = 0x00
const ROLLER_TURN = 0x01
const SLIDER_VALUE = 0x02
const KNOB_PRESS = 0x03
const NO_CHANGE = 0xff

export type InputReport =
	| { type: 'turns'; turns: Array<[number, boolean]> }
	| { type: 'press'; pressed: [boolean, boolean, boolean] }
	| { type: 'sliders'; values: [number, number, number, number, number] }
	| { type: 'rollers'; turns: Array<[number, boolean]> }

export type LedCommand =
	| { kind: 'mode'; index: number; mode: number; save: boolean }
	| { kind: 'color'; index: number; r: number; g: number; b: number; save: boolean }
	| { kind: 'brightness'; index: number; brightness: number }

export function knobControl(reportIndex: number): number {
	if (reportIndex === 0) {
		return 1
	}
	if (reportIndex === 1) {
		return 2
	}
	if (reportIndex === 2) {
		return 0
	}
	return reportIndex
}

export function knobLedIndex(control: number): number {
	if (control === 0) {
		return 2
	}
	if (control === 1) {
		return 0
	}
	if (control === 2) {
		return 1
	}
	return control
}

export function inputReport(report: Uint8Array): InputReport | null {
	if (report[1] !== INPUT_CHANNEL) {
		return null
	}
	return inputPayload(report)
}

export function inputPayload(report: Uint8Array): InputReport | null {
	if (report.length < 4 || report[0] !== 0x01) {
		return null
	}
	const length = report[2] | (report[3] << 8)
	const payload = report.subarray(4, 4 + length)
	if (payload.length < length) {
		return null
	}
	return parsePayload(payload)
}

function parsePayload(payload: Uint8Array): InputReport | null {
	const knobTurns = body(payload, KNOB_TURN, 3)
	if (knobTurns) {
		return { type: 'turns', turns: directions(knobTurns, true) }
	}
	const knobPress = body(payload, KNOB_PRESS, 3)
	if (knobPress) {
		return { type: 'press', pressed: [knobPress[0] === 0x01, knobPress[1] === 0x01, knobPress[2] === 0x01] }
	}
	const rollerTurns = body(payload, ROLLER_TURN, 2)
	if (rollerTurns) {
		return { type: 'rollers', turns: directions(rollerTurns, false) }
	}
	const sliders = body(payload, SLIDER_VALUE, 5) ?? body(payload, KNOB_TURN, 5)
	if (sliders) {
		if (sliders.some((value) => value > 100)) {
			return null
		}
		return {
			type: 'sliders',
			values: [sliders[0] ?? 0, sliders[1] ?? 0, sliders[2] ?? 0, sliders[3] ?? 0, sliders[4] ?? 0],
		}
	}
	// Some roller frames omit the inner report header and are just the two direction bytes.
	if (payload.length === 2 && payload.every((byte) => isRollerByte(byte))) {
		return { type: 'rollers', turns: directions(payload, false) }
	}
	return null
}

/**
 * Rollers send a direction byte or `0xff`. Encoders sometimes report a turn with no detent
 * position, which arrives as `0x7f`; treating it as a turn keeps the roller usable instead of
 * dropping the report, and the `0x7f` frame itself contributes nothing.
 */
function isRollerByte(byte: number): boolean {
	return byte === 0x00 || byte === 0x01 || byte === NO_CHANGE || byte === 0x7f
}

function body(payload: Uint8Array, id: number, count: number): Uint8Array | null {
	if (payload.length >= 2 + count && payload[0] === id && payload[1] === count) {
		return payload.subarray(2, 2 + count)
	}
	return null
}

function directions(bytes: Uint8Array, clockwise: boolean): Array<[number, boolean]> {
	const turns: Array<[number, boolean]> = []
	bytes.forEach((byte, index) => {
		if (byte === 0x00 || byte === 0x01) {
			turns.push([index, (byte === 0x01) === clockwise])
		}
	})
	return turns
}

/**
 * Roller input when the envelope does not describe the payload. The module sends one value per
 * roller, so the first two bytes after the envelope header are read as directions and any
 * trailing bytes are padding or an unknown field.
 */
export function looseRollerReport(report: Uint8Array): InputReport | null {
	if (report.length < 6 || report[0] !== 0x01 || report[1] !== INPUT_CHANNEL) {
		return null
	}
	const payload = report.subarray(4, 6)
	if (!payload.every((byte) => isRollerByte(byte))) {
		return null
	}
	return { type: 'rollers', turns: directions(payload, false) }
}

export function encodeLed(module: number, command: LedCommand): Uint8Array {
	const report = new Uint8Array(LED_REPORT_LEN)
	report[0] = 0x02
	if (command.kind === 'mode') {
		report[1] = LED_MODE
		report[2] = module
		report[3] = command.index
		report[4] = command.mode
		report[5] = command.save ? 1 : 0
		return report
	}
	if (command.kind === 'color') {
		report[1] = LED_COLOR
		report[2] = module
		report[3] = command.index
		report[4] = command.r
		report[5] = command.g
		report[6] = command.b
		report[7] = command.save ? 1 : 0
		return report
	}
	report[1] = LED_BRIGHTNESS
	report[2] = module
	report[3] = command.index
	report[4] = command.brightness
	return report
}
