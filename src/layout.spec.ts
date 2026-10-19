import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildGrid } from './layout.js'

const cell = (grid: ReturnType<typeof buildGrid>, id: string) => {
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

void test('no modules is not a surface', () => {
	assert.equal(buildGrid([], { M4315: '22' }), null)
})

void test('a keypad above the base shifts so the first row is zero', () => {
	const grid = buildGrid(['M4315'], { M4315: '111' })
	assert.ok(grid)
	assert.deepEqual(
		grid.controls.find((control) => control.id === 'key/0'),
		{ id: 'key/0', row: 0, column: 0, stylePreset: 'key' },
	)
	assert.deepEqual(
		grid.controls.find((control) => control.id === 'key/5'),
		{ id: 'key/5', row: 1, column: 0, stylePreset: 'key' },
	)
})

void test('knobs and the dial keep their sites when the cells do not overlap', () => {
	const grid = buildGrid(['M003K', '1xDial'], { M003K: '111', '1xDial': '124' })
	assert.ok(grid)
	assert.deepEqual(
		grid.controls.find((control) => control.id === 'dial'),
		{
			id: 'dial',
			row: 0,
			column: 0,
			stylePreset: 'dial',
		},
	)
	assert.deepEqual(
		grid.controls.find((control) => control.id === 'knob/0'),
		{
			id: 'knob/0',
			row: 0,
			column: 2,
			stylePreset: 'encoder',
		},
	)
	assert.equal(grid.controls.find((control) => control.id === 'knob/2')?.column, 4)
})

void test('overlapping sites fall back to the stacked grid', () => {
	const grid = buildGrid(['M4315', 'M003K'], { M4315: '22', M003K: '124' })
	assert.ok(grid)
	assert.equal(grid.controls.find((control) => control.id === 'key/0')?.row, 0)
	assert.equal(grid.controls.find((control) => control.id === 'knob/0')?.row, 4)
})

void test('the stacked grid pins every module to its own row', () => {
	const grid = buildGrid(['1xDial', 'M005S', 'M032LE', 'M003K', 'M4315', 'M0064'], {})
	assert.ok(grid)
	assert.equal(grid.controls.find((control) => control.id === 'key/14')?.row, 2)
	assert.deepEqual(
		grid.controls.find((control) => control.id === 'slider/0'),
		{
			id: 'slider/0',
			row: 3,
			column: 0,
			stylePreset: 'encoder',
		},
	)
	assert.deepEqual(
		grid.controls.find((control) => control.id === 'knob/0'),
		{
			id: 'knob/0',
			row: 4,
			column: 0,
			stylePreset: 'encoder',
		},
	)
	assert.deepEqual(
		grid.controls.find((control) => control.id === 'roller/1'),
		{
			id: 'roller/1',
			row: 4,
			column: 3,
			stylePreset: 'encoder',
		},
	)
	assert.deepEqual(
		grid.controls.find((control) => control.id === 'dial'),
		{
			id: 'dial',
			row: 5,
			column: 0,
			stylePreset: 'dial',
		},
	)
	assert.deepEqual(
		grid.controls.find((control) => control.id === 'base'),
		{
			id: 'base',
			row: 5,
			column: 1,
			stylePreset: 'encoder',
		},
	)
})

void test('a missing module leaves its cells empty', () => {
	const full = buildGrid(['M4315', 'M003K', 'M032LE', 'M005S', 'M0064', '1xDial'], {}, true)
	assert.ok(full)
	for (const modules of [['M4315', 'M003K', 'M032LE', '1xDial'], ['M005S', '1xDial'], ['1xDial']]) {
		const grid = buildGrid(modules, {}, true)
		for (const control of full.controls) {
			const present = modules.includes(moduleOf(control.id))
			assert.deepEqual(
				cell(grid, control.id),
				present ? cell(full, control.id) : null,
				`${control.id} is wrong without a module`,
			)
		}
	}
})

void test('the base alone has a cell and counts as a dial', () => {
	const grid = buildGrid(['M0064'], {})
	assert.ok(grid)
	assert.equal(grid.hasDial, true)
	assert.equal(grid.hasKeypad, false)
	assert.deepEqual(grid.controls, [{ id: 'base', row: 5, column: 1, stylePreset: 'encoder' }])
})

void test('hardware roller 0 sits on the right of its site', () => {
	const grid = buildGrid(['M032LE'], { M032LE: '32' })
	assert.ok(grid)
	assert.equal(grid.controls.find((control) => control.id === 'roller/1')?.column, 1)
	assert.equal(grid.controls.find((control) => control.id === 'roller/0')?.column, 0)
	assert.equal(grid.controls.find((control) => control.id === 'roller/0')?.row, 0)
})
