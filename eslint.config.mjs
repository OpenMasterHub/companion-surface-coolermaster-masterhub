import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

export default generateEslintConfig({
	enableTypescript: true,
	ignores: ['test-hooks.mjs', 'test-register.mjs'],
	typescriptRules: {
		// The default `.js` extension alias omits the plain `.js` fallback, so a cross-package
		// subpath that ships built `.js` (for example `companion-surface-masterhub/layout.js`)
		// fails to resolve. Keep `.js` last so both source `.ts` and built `.js` resolve.
		'n/no-missing-import': [
			'error',
			{
				resolverConfig: {
					extensionAlias: {
						'.js': ['.ts', '.js'],
						'.cjs': ['.cts', '.cjs'],
						'.mjs': ['.mts', '.mjs'],
						'.jsx': ['.tsx', '.jsx'],
					},
				},
			},
		],
	},
})
