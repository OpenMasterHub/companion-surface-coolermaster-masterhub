// Builds the module into `pkg/masterhub-usb` unminified, for Companion's developer modules
// directory. Companion reloads the module when `main.js` there changes, so this is enough: no
// `.tgz` to repackage or reinstall.
//
// Each run compiles and bundles in a temporary directory and only then replaces `pkg/masterhub-usb`,
// so Companion never reads a half-written module, a failed compile leaves the previous build in
// place, and a burst of saves cannot leave a mix of old and new output. (The tool's
// `companion-surface-build` alone cannot do this: it bundles `dist/` in place and fails if two runs
// overlap.) A build asked for while another is running follows it.
//
// `--watch` rebuilds on changes under `src/` and `companion/`, debounced so one save builds once.
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

// Resolve from the repository, as `pnpm` scripts do, not from `scripts/`. `exports` in both packages
// hides the two files used here, hence resolving from their main entry points.
const require = createRequire(join(process.cwd(), 'package.json'))
const buildScript = join(dirname(require.resolve('@companion-module/tools')), 'scripts/build-surface.js')
const tsc = join(dirname(dirname(require.resolve('typescript'))), 'bin/tsc')

const devDir = join('pkg', 'masterhub-usb')
const moduleId = JSON.parse(readFileSync('companion/manifest.json', 'utf8')).id

let running = false
let queued = false

function run(command, args, cwd) {
	return spawnSync(process.execPath, [command, ...args], { cwd, stdio: 'inherit' }).status === 0
}

function build() {
	if (running) {
		queued = true
		return
	}
	running = true
	const inputs = ['package.json', 'build-config.cjs', 'companion', 'tsconfig.build.json', 'src', 'node_modules']
	const outDir = mkdtempSync(join(tmpdir(), 'masterhub-dev-'))
	try {
		// The tool reads the module from its cwd and writes `pkg/` there. It is given a copy of the
		// inputs, node_modules included (pnpm symlinks would dangle): never a part of the tree that
		// the repository's own tooling may be reading at the same time.
		for (const input of inputs) {
			cpSync(input, join(outDir, input), { recursive: true })
		}
		const output = join(outDir, 'pkg', moduleId)
		if (!run(tsc, ['-p', 'tsconfig.build.json'], outDir) || !run(buildScript, ['--dev'], outDir)) {
			console.error('[dev] build failed')
		} else {
			const staging = join(outDir, 'staged')
			cpSync(output, staging, { recursive: true })
			rmSync(devDir, { recursive: true, force: true })
			cpSync(staging, devDir, { recursive: true })
		}
	} finally {
		rmSync(outDir, { recursive: true, force: true })
		running = false
	}
	if (queued) {
		queued = false
		build()
	}
}

build()

if (process.argv.includes('--watch')) {
	// eslint-disable-next-line n/no-unpublished-import -- a dev entry point, not published with the module
	const { watch } = await import('chokidar')
	let timer = null
	const rebuild = () => {
		clearTimeout(timer)
		timer = setTimeout(build, 200)
	}
	// `atomic: false`: an editor that saves by renaming a temp file over the source breaks inotify.
	watch(['src', 'companion'], { ignoreInitial: true, atomic: false }).on('all', rebuild)
	console.log('[dev] watching src/ and companion/, building into pkg/masterhub-usb')
}
