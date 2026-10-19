import { MODULE_PIDS, VID } from './hid/ids.js'

export const SURFACE_ID = 'masterhub-usb'

export interface HidIdentity {
	vendorId: number
	productId: number
	path: string
}

export interface PluginInfo {
	devices: HidIdentity[]
}

export interface DeviceDiscovery {
	surfaceId: string
	description: string
	pluginInfo: PluginInfo
}

const PID_SET = new Set<number>(MODULE_PIDS)

/** One path per product id, keeping the first path in enumerate order. */
export function matchingDevices(devices: readonly HidIdentity[]): HidIdentity[] {
	const byPid = new Map<number, HidIdentity>()
	for (const device of devices) {
		if (device.vendorId !== VID || !PID_SET.has(device.productId) || !device.path) {
			continue
		}
		if (!byPid.has(device.productId)) {
			byPid.set(device.productId, device)
		}
	}
	return [...byPid.values()]
}

/**
 * One surface for every present module. Companion suffixes a repeated surface
 * id, so only the lowest PID is the anchor and the rest are listed beside it.
 */
export function discoveryFor(device: HidIdentity, present: readonly HidIdentity[]): DeviceDiscovery | null {
	const devices = matchingDevices(present)
	const anchor = devices.reduce<HidIdentity | null>((best, item) => {
		if (!best || item.productId < best.productId) {
			return item
		}
		if (item.productId === best.productId && item.path < best.path) {
			return item
		}
		return best
	}, null)
	if (!anchor || device.path !== anchor.path) {
		return null
	}
	return {
		surfaceId: SURFACE_ID,
		description: 'MasterHub',
		pluginInfo: { devices },
	}
}
