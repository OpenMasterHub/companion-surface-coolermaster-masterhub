/**
 * Timing counters for the output path, on when `MASTERHUB_DEBUG=1`. Counters are written through
 * Companion's module logger. Its default sink also mirrors to the module process `console`, which
 * is where the surface process output goes.
 */
const envEnabled = process.env.MASTERHUB_DEBUG === '1'
let enabled = envEnabled
let timer: ReturnType<typeof setInterval> | null = null

interface Counter {
	count: number
	totalMs: number
	maxMs: number
}

const counters = new Map<string, Counter>()

/** Cumulative counters, printed in this order. */
const COUNTERS = [
	'draw calls',
	'draw superseded',
	'draw aborted before send',
	'encode ms',
	'jpeg bytes',
	'jpeg chunks',
	'flush reports',
	'flush ms',
	'read ms',
	'write errors',
] as const

function record(name: string, value: number): void {
	const counter = counters.get(name) ?? { count: 0, totalMs: 0, maxMs: 0 }
	counter.count += 1
	counter.totalMs += value
	counter.maxMs = Math.max(counter.maxMs, value)
	counters.set(name, counter)
}

/** Counts one event. */
export function count(name: string, amount = 1): void {
	if (enabled) {
		record(name, amount)
	}
}

/** Counts one event and its duration, logging when it exceeds `budgetMs`. */
export function time(name: string, startedAt: number, budgetMs = 50): void {
	if (!enabled) {
		return
	}
	const ms = performance.now() - startedAt
	record(name, ms)
	if (ms > budgetMs) {
		console.log(`${name} took ${ms.toFixed(1)} ms`)
	}
}

/** Timestamps are only needed while counters are on, so this avoids a clock read per report. */
export function now(): number {
	return enabled ? performance.now() : 0
}

export function isDebugEnabled(): boolean {
	return enabled
}

export function isDebugForcedByEnv(): boolean {
	return envEnabled
}

export function setDebugEnabled(value: boolean): void {
	if (envEnabled || value === enabled) {
		return
	}
	enabled = value
	if (enabled) {
		startSummaries()
	} else {
		stopSummaries()
	}
}

function startSummaries(): void {
	timer = setInterval(() => {
		if (counters.size === 0) {
			return
		}
		const parts: string[] = []
		for (const name of COUNTERS) {
			const counter = counters.get(name)
			if (!counter) {
				continue
			}
			parts.push(
				`${name}: n=${counter.count} avg=${(counter.totalMs / counter.count).toFixed(1)} max=${counter.maxMs.toFixed(1)}`,
			)
			counters.delete(name)
		}
		console.log(parts.join(' | '))
	}, 1000)
	timer.unref()
}

function stopSummaries(): void {
	if (timer) {
		clearInterval(timer)
		timer = null
	}
	counters.clear()
}

if (enabled) {
	startSummaries()
}
