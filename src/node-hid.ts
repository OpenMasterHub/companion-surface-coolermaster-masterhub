import { createRequire } from 'node:module'

import type { Device, HIDAsync } from 'node-hid'

import type { HidIdentity } from './discover.js'
import { matchingDevices } from './discover.js'
import type { HidPort } from './session.js'

// `node-hid` is a native module, so it cannot live in the bundled plugin file. Companion unpacks
// the plugin into `main.js` plus the module's own `node_modules`, so loading it lazily through a
// `require` rooted in that directory finds it at runtime and fails only if it is genuinely absent.
const requireHid = createRequire(import.meta.url)

function loadHid(): typeof import('node-hid') {
	try {
		return requireHid('node-hid') as typeof import('node-hid')
	} catch (error) {
		throw new Error(
			'Could not load the node-hid native module. The plugin must be installed with its own node_modules directory.',
			{ cause: error },
		)
	}
}

export function listHid(): HidIdentity[] {
	return matchingDevices(
		loadHid()
			.devices()
			.flatMap((device) => identity(device)),
	)
}

export function listPids(): number[] {
	return listHid().map((device) => device.productId)
}

export async function openHid(path: string): Promise<HidPort> {
	const device: HIDAsync = await loadHid().HIDAsync.open(path)
	return {
		async write(data: Uint8Array): Promise<void> {
			await device.write(Buffer.from(data))
		},
		async sendFeatureReport(data: Uint8Array): Promise<void> {
			await device.sendFeatureReport(Buffer.from(data))
		},
		async read(timeoutMs: number): Promise<Uint8Array | null> {
			const data = await device.read(timeoutMs)
			if (!data || data.length === 0) {
				return null
			}
			return new Uint8Array(data)
		},
		async close(): Promise<void> {
			await device.close()
		},
	}
}

function identity(device: Device): HidIdentity[] {
	if (!device.path) {
		return []
	}
	return [{ vendorId: device.vendorId, productId: device.productId, path: device.path }]
}
