import { buildGrid, type SurfaceGrid } from './layout.js'

/**
 * The USB surface has no sites, so it always uses the stacked grid: keys in rows 0-2,
 * sliders in row 3, knobs and rollers in row 4, and the dial and base in row 5. The
 * modules arrive by product id, which is not the order the grid expects.
 */
export function usbGrid(modules: readonly string[]): SurfaceGrid | null {
	return buildGrid(modules, {}, true)
}
