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

/**
 * `readStart`/`readStop` live on the native handle: `node-hid` only republishes the methods that
 * existed when it wrote its wrapper, so the typed `HIDAsync` does not carry them.
 */
interface NativeHid extends HIDAsync {
	readStart(onReport: (error: Error | null, data?: Buffer) => void): Promise<void>
	readStop(): Promise<void>
}

interface AsyncHid extends HIDAsync {
	_raw: NativeHid
}

export async function openHid(path: string): Promise<HidPort> {
	const device = (await loadHid().HIDAsync.open(path)) as unknown as AsyncHid
	const native = device._raw
	return {
		async write(data: Uint8Array): Promise<void> {
			await device.write(Buffer.from(data))
		},
		async sendFeatureReport(data: Uint8Array): Promise<void> {
			await device.sendFeatureReport(Buffer.from(data))
		},
		/**
		 * `node-hid` keeps one long-lived reader thread per module. It is what makes writes fast:
		 * the thread sits in `hid_read_timeout`, off libuv's pool, where a one-shot read would
		 * hold a pool thread for its whole timeout and delay every write behind it.
		 */
		async readStart(onReport: (report: Uint8Array) => void): Promise<void> {
			await native.readStart((error, data) => {
				if (!error && data && data.length > 0) {
					onReport(new Uint8Array(data))
				}
			})
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
