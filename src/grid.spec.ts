import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { usbGrid } from './grid.js'

const cell = (grid: ReturnType<typeof usbGrid>, id: string) => {
	const control = grid?.controls.find((item) => item.id === id)
	return control ? { row: control.row, column: control.column } : null
}

const moduleOf = (id: string) => {
	if (id.startsWith('key/')) {
		return 'M4315'
	}
	if (id.startsWith('knob/')) {
		return 'M003K'
	}
	if (id.startsWith('roller/')) {
		return 'M032LE'
	}
	if (id.startsWith('slider/')) {
		return 'M005S'
	}
	return id === 'dial' ? '1xDial' : 'M0064'
}

void describe('USB grid', () => {
	void it('stacks keys, sliders, knobs, rollers, and the dial', () => {
		const grid = usbGrid(['M4315', 'M003K', 'M032LE', 'M005S', '1xDial'])
		assert.ok(grid)
		assert.equal(grid.hasKeypad, true)
		assert.deepEqual(cell(grid, 'key/0'), { row: 0, column: 0 })
		assert.deepEqual(cell(grid, 'key/14'), { row: 2, column: 4 })
		assert.deepEqual(cell(grid, 'slider/0'), { row: 3, column: 0 })
		assert.deepEqual(cell(grid, 'slider/4'), { row: 3, column: 4 })
		assert.deepEqual(cell(grid, 'knob/0'), { row: 4, column: 0 })
		assert.deepEqual(cell(grid, 'knob/2'), { row: 4, column: 2 })
		assert.deepEqual(cell(grid, 'roller/1'), { row: 4, column: 3 })
		assert.deepEqual(cell(grid, 'roller/0'), { row: 4, column: 4 })
		assert.deepEqual(cell(grid, 'dial'), { row: 5, column: 0 })
	})

	void it('does not move a module when another is disconnected', () => {
		const full = usbGrid(['M4315', 'M003K', 'M032LE', 'M005S', '1xDial'])
		for (const modules of [
			['M4315', 'M003K', 'M032LE', '1xDial'],
			['M4315', 'M032LE', 'M005S', '1xDial'],
			['M005S', '1xDial'],
			['1xDial'],
		]) {
			const grid = usbGrid(modules)
			for (const control of full?.controls ?? []) {
				const present = modules.some((name) => name === moduleOf(control.id))
				assert.deepEqual(
					cell(grid, control.id),
					present ? cell(full, control.id) : null,
					`${control.id} is wrong without ${modules.join(',')}`,
				)
			}
		}
	})

	void it('shows the base on its own cell beside the dial', () => {
		const grid = usbGrid(['1xDial', 'M0064'])
		assert.equal(grid?.hasDial, true)
		assert.deepEqual(cell(grid, 'dial'), { row: 5, column: 0 })
		assert.deepEqual(cell(grid, 'base'), { row: 5, column: 1 })
	})

	void it('shows the base alone', () => {
		const grid = usbGrid(['M0064'])
		assert.equal(grid?.hasDial, true)
		assert.deepEqual(grid?.controls, [{ id: 'base', row: 5, column: 1, stylePreset: 'encoder' }])
	})

	void it('has no controls without modules', () => {
		assert.equal(usbGrid([]), null)
	})
})
