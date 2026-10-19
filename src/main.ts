import type { HIDDevice, SurfacePlugin } from '@companion-surface/base'

import { discoveryFor, type HidIdentity, type PluginInfo } from './discover.js'
import { moduleName } from './hid/ids.js'
import { listHid, listPids, openHid } from './node-hid.js'
import { UsbLink } from './session.js'
import { usbGrid } from './grid.js'
import { MasterHubUsbSurface, registerProps } from './surface.js'

const plugin: SurfacePlugin<PluginInfo> = {
	async init(): Promise<void> {},
	async destroy(): Promise<void> {},
	checkSupportsHidDevice(device: HIDDevice) {
		try {
			return discoveryFor(identity(device), listHid())
		} catch {
			return null
		}
	},
	async openSurface(surfaceId, pluginInfo, context) {
		const devices = pluginInfo.devices.filter((device) => device.path && moduleName(device.productId))
		const modules = devices.flatMap((device) => {
			const name = moduleName(device.productId)
			return name ? [name] : []
		})
		const grid = usbGrid(modules)
		if (!grid) {
			throw new Error('No MasterHub controls to open')
		}
		const link = new UsbLink({ open: openHid }, listPids)
		await link.open(devices)
		const surface = new MasterHubUsbSurface(surfaceId, grid, context, link, () => undefined)
		link.setHandlers(
			(event) => surface.handle(event),
			(error) => surface.disconnect(error),
		)
		link.start()
		return { surface, registerProps: registerProps(grid) }
	},
}

function identity(device: HIDDevice): HidIdentity {
	return { vendorId: device.vendorId, productId: device.productId, path: device.path }
}

export default plugin
