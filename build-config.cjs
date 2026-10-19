// node-hid is a native module that the plugin loads at runtime through createRequire, so esbuild
// never sees it and cannot bundle it. Declaring it as an external makes companion-surface-build add
// it to the packaged dependencies and install it into the plugin's own node_modules, where the
// runtime require finds it. Without this the packaged surface throws MODULE_NOT_FOUND on open.
// The USB surface talks to the hardware itself, so no masterhubd binary is shipped.
module.exports = {
	externals: ['node-hid'],
	extraFiles: [],
}
