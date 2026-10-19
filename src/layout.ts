/**
 * Companion cells, one control each. Site rectangles come from `placement()` in
 * plugins/opendeck-masterhub/src/map.rs. A keypad is 5 columns wide and its site
 * is 4, so blocks can overlap; those reports use the stacked grid instead.
 */

export interface Placement {
	horizontal: boolean
	x: number
	y: number
	w: number
	h: number
}

export interface GridControl {
	id: string
	row: number
	column: number
	stylePreset: 'key' | 'dial' | 'encoder'
}

export interface SurfaceGrid {
	controls: GridControl[]
	hasKeypad: boolean
	hasSliders: boolean
	hasDial: boolean
}

const VISIBLE = ['M4315', 'M003K', 'M032LE', 'M005S', 'M0064', '1xDial'] as const

/**
 * The rows the stacked grid uses. They are fixed, so a module that is not connected
 * leaves its cells empty instead of moving the modules above or below it.
 */
export const STACK_ROW = { keypad: 0, sliders: 3, knobs: 4, rollers: 4, base: 5, dial: 5 } as const

type VisibleModule = (typeof VISIBLE)[number]

export function placement(module: string, site: string): Placement | null {
	const place = (horizontal: boolean, x: number, y: number, w: number, h: number): Placement => ({
		horizontal,
		x,
		y,
		w,
		h,
	})
	switch (`${module}:${site}`) {
		case 'M003K:124':
		case '1xDial:124':
			return place(true, 0, 0, 2, 2)
		case 'M003K:111':
		case '1xDial:111':
			return place(true, 2, 0, 2, 2)
		case 'M003K:143':
		case '1xDial:143':
			return place(true, 4, 0, 2, 2)
		case 'M003K:44':
		case '1xDial:44':
			return place(true, 0, 2, 2, 2)
		case 'M003K:43':
		case '1xDial:43':
			return place(true, 1, 2, 2, 2)
		case 'M003K:23':
		case '1xDial:23':
			return place(true, 2, 2, 2, 2)
		case 'M003K:112':
		case '1xDial:112':
			return place(true, 3, 2, 2, 2)
		case 'M003K:134':
		case '1xDial:134':
			return place(true, 4, 2, 2, 2)
		case 'M003K:34':
		case '1xDial:34':
			return place(false, 0, 0, 2, 2)
		case 'M003K:113':
		case '1xDial:113':
			return place(false, 2, 0, 2, 2)
		case 'M003K:31':
		case '1xDial:31':
			return place(false, 0, 2, 2, 2)
		case 'M003K:42':
		case '1xDial:42':
			return place(false, 2, 2, 2, 2)
		case 'M003K:123':
		case '1xDial:123':
			return place(false, 0, 4, 2, 2)
		case 'M003K:122':
		case '1xDial:122':
			return place(false, 2, 4, 2, 2)
		case 'M4315:111':
			return place(true, 0, -1, 4, 3)
		case 'M4315:143':
			return place(true, 2, -1, 4, 3)
		case 'M4315:22':
			return place(true, 0, 0, 4, 3)
		case 'M4315:132':
			return place(true, 2, 0, 4, 3)
		case 'M4315:23':
			return place(true, 0, 1, 4, 3)
		case 'M4315:112':
			return place(true, 1, 1, 4, 3)
		case 'M4315:134':
			return place(true, 2, 1, 4, 3)
		case 'M4315:113':
			return place(false, 0, -1, 4, 3)
		case 'M4315:24':
			return place(false, 0, 0, 4, 3)
		case 'M4315:42':
			return place(false, 0, 1, 4, 3)
		case 'M4315:41':
			return place(false, 0, 2, 4, 3)
		case 'M4315:122':
			return place(false, 0, 3, 4, 3)
		case 'M032LE:32':
			return place(true, 0, 1, 4, 1)
		case 'M032LE:21':
			return place(true, 0, 2, 4, 1)
		case 'M032LE:114':
			return place(true, 0, 3, 4, 1)
		case 'M032LE:141':
			return place(true, 2, 0, 4, 1)
		case 'M032LE:142':
			return place(true, 2, 1, 4, 1)
		case 'M032LE:131':
			return place(true, 2, 2, 4, 1)
		case 'M032LE:133':
			return place(true, 2, 3, 4, 1)
		case 'M032LE:134':
			return place(false, 0, 0, 4, 1)
		case 'M032LE:112':
			return place(false, 0, 1, 4, 1)
		case 'M032LE:23':
			return place(false, 0, 2, 4, 1)
		case 'M032LE:43':
			return place(false, 0, 3, 4, 1)
		case 'M032LE:44':
			return place(false, 0, 4, 4, 1)
		case 'M032LE:121':
			return place(false, 0, 5, 4, 1)
		case 'M005S:111':
			return place(true, 0, 0, 4, 2)
		case 'M005S:143':
			return place(true, 2, 0, 4, 2)
		case 'M005S:23':
			return place(true, 0, 2, 4, 2)
		case 'M005S:112':
			return place(true, 1, 2, 4, 2)
		case 'M005S:134':
			return place(true, 2, 2, 4, 2)
		case 'M005S:113':
			return place(false, 0, 0, 4, 2)
		case 'M005S:24':
			return place(false, 0, 1, 4, 2)
		case 'M005S:42':
			return place(false, 0, 2, 4, 2)
		case 'M005S:41':
			return place(false, 0, 3, 4, 2)
		case 'M005S:122':
			return place(false, 0, 4, 4, 2)
		default:
			return null
	}
}

export function gridKey(controls: readonly GridControl[]): string {
	return controls
		.map((control) => `${control.id}@${control.row},${control.column}`)
		.sort()
		.join('|')
}

/**
 * `sites` maps a module name to its pogo site. When they all identify a cell the grid
 * follows the hardware; otherwise it falls back to the stable rows. `rows` keeps the
 * rows fixed even when a module in between is missing.
 */
export function buildGrid(
	modules: readonly string[],
	sites: Readonly<Record<string, string>> = {},
	rows: boolean = false,
): SurfaceGrid | null {
	const visible = VISIBLE.filter((name) => modules.includes(name))
	if (visible.length === 0) {
		return null
	}
	const controls = rows ? stackedLayout(visible) : (layoutFromSites(visible, sites) ?? stackedLayout(visible))
	return {
		controls,
		hasKeypad: visible.includes('M4315'),
		hasSliders: visible.includes('M005S'),
		hasDial: visible.includes('M0064') || visible.includes('1xDial'),
	}
}

function layoutFromSites(
	visible: readonly VisibleModule[],
	sites: Readonly<Record<string, string>>,
): GridControl[] | null {
	const controls: GridControl[] = []
	for (const name of visible) {
		const site = sites[name]
		if (!site) {
			return null
		}
		const place = placement(name, site)
		if (!place) {
			return null
		}
		controls.push(...controlsFor(name, place))
	}
	return withoutOverlap(controls)
}

function controlsFor(name: VisibleModule, place: Placement): GridControl[] {
	if (name === 'M4315') {
		return Array.from({ length: 15 }, (_, index) => ({
			id: `key/${index}`,
			row: place.y + Math.floor(index / 5),
			column: place.x + (index % 5),
			stylePreset: 'key' as const,
		}))
	}
	if (name === 'M003K') {
		return Array.from({ length: 3 }, (_, index) => ({
			id: `knob/${index}`,
			row: place.y,
			column: place.x + index,
			stylePreset: 'encoder' as const,
		}))
	}
	if (name === 'M032LE') {
		return [
			{ id: 'roller/0', row: place.y, column: place.x + place.w - 2, stylePreset: 'encoder' },
			{ id: 'roller/1', row: place.y, column: place.x + place.w - 1, stylePreset: 'encoder' },
		]
	}
	if (name === 'M005S') {
		return Array.from({ length: 5 }, (_, index) => ({
			id: `slider/${index}`,
			row: place.y,
			column: place.x + index,
			stylePreset: 'encoder' as const,
		}))
	}
	return [{ id: 'dial', row: place.y, column: place.x, stylePreset: 'dial' }]
}

function withoutOverlap(controls: GridControl[]): GridControl[] | null {
	const first = controls[0]
	if (!first) {
		return null
	}
	const seen = new Set<string>()
	for (const control of controls) {
		const key = `${control.row},${control.column}`
		if (seen.has(key)) {
			return null
		}
		seen.add(key)
	}
	return fit(controls)
}

/**
 * The grid does not move while modules come and go. Keys fill rows 0-2, sliders row 3,
 * knobs and rollers row 4, and the dial and base row 5. Every module keeps its cells
 * whether or not the others are connected, so a module that is absent leaves a gap.
 * Each module lands on the same buttons every time.
 */
function stackedLayout(visible: readonly VisibleModule[]): GridControl[] {
	const controls: GridControl[] = []
	if (visible.includes('M4315')) {
		controls.push(
			...Array.from({ length: 15 }, (_, index) => ({
				id: `key/${index}`,
				row: STACK_ROW.keypad + Math.floor(index / 5),
				column: index % 5,
				stylePreset: 'key' as const,
			})),
		)
	}
	if (visible.includes('M005S')) {
		controls.push(
			...Array.from({ length: 5 }, (_, index) => ({
				id: `slider/${index}`,
				row: STACK_ROW.sliders,
				column: index,
				stylePreset: 'encoder' as const,
			})),
		)
	}
	if (visible.includes('M003K')) {
		controls.push(
			...Array.from({ length: 3 }, (_, index) => ({
				id: `knob/${index}`,
				row: STACK_ROW.knobs,
				column: index,
				stylePreset: 'encoder' as const,
			})),
		)
	}
	if (visible.includes('M032LE')) {
		controls.push(
			{ id: 'roller/0', row: STACK_ROW.rollers, column: 4, stylePreset: 'encoder' },
			{ id: 'roller/1', row: STACK_ROW.rollers, column: 3, stylePreset: 'encoder' },
		)
	}
	if (visible.includes('M0064')) {
		controls.push({ id: 'base', row: STACK_ROW.base, column: 1, stylePreset: 'encoder' })
	}
	if (visible.includes('1xDial')) {
		controls.push({ id: 'dial', row: STACK_ROW.dial, column: 0, stylePreset: 'dial' })
	}
	return controls
}

/** Pulls the controls up and left so the grid has no empty leading row or column. */
function fit(controls: readonly GridControl[]): GridControl[] {
	const first = controls[0]
	if (!first) {
		return []
	}
	const minRow = Math.min(...controls.map((control) => control.row))
	const minColumn = Math.min(...controls.map((control) => control.column))
	return controls.map((control) => ({
		...control,
		row: control.row - minRow,
		column: control.column - minColumn,
	}))
}
