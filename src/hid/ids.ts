/** VID and PIDs from `daemons/masterhubd/src/usb`. */
export const VID = 0x2516

export const PID_BASE = 0x01f6
export const PID_KEYS = 0x01fe
export const PID_SLIDER = 0x0200
export const PID_KNOB = 0x0202
export const PID_ROLLER = 0x0204
export const PID_DIAL = 0x0206

export const MODULE_PIDS = [PID_BASE, PID_KEYS, PID_SLIDER, PID_KNOB, PID_ROLLER, PID_DIAL] as const

const MODULE_NAMES: Record<number, string> = {
	[PID_BASE]: 'M0064',
	[PID_KEYS]: 'M4315',
	[PID_SLIDER]: 'M005S',
	[PID_KNOB]: 'M003K',
	[PID_ROLLER]: 'M032LE',
	[PID_DIAL]: '1xDial',
}

export function moduleName(productId: number): string | null {
	return MODULE_NAMES[productId] ?? null
}
