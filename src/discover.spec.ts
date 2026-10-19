import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { discoveryFor, matchingDevices, SURFACE_ID, type HidIdentity } from './discover.js'
import { PID_BASE, PID_KEYS, VID } from './hid/ids.js'

function device(productId: number, path: string, vendorId = VID): HidIdentity {
	return { vendorId, productId, path }
}

void describe('USB discovery', () => {
	void it('anchors on the lowest PID and lists every module once', () => {
		const keys = device(PID_KEYS, 'keys')
		const base = device(PID_BASE, 'base')
		const present = [keys, base, device(PID_KEYS, 'keys-interface-2')]
		assert.deepEqual(matchingDevices(present), [keys, base])
		assert.equal(discoveryFor(keys, present), null)
		const discovery = discoveryFor(base, present)
		assert.ok(discovery)
		assert.equal(discovery.surfaceId, SURFACE_ID)
		assert.deepEqual(discovery.pluginInfo.devices, [keys, base])
	})

	void it('ignores other vendors', () => {
		const base = device(PID_BASE, 'base')
		const foreign = device(PID_BASE, 'base-foreign', 0x1234)
		assert.deepEqual(matchingDevices([foreign]), [])
		assert.equal(discoveryFor(foreign, [base, foreign]), null)
	})
})
