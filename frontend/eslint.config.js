import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '__an.mjs', '__an2.mjs']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      // Was pinned to 2020, which made the parser reject syntax the app
      // already ships — numeric separators (`60_000`) in Topbar.jsx were
      // reported as a hard "Parsing error", masking every other lint result
      // in that file. Vite/esbuild compiled it fine; only ESLint disagreed.
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Jest injects describe/test/expect as globals.
    files: ['**/__tests__/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
  },
  {
    // The Firebase messaging service worker runs in a ServiceWorkerGlobalScope
    // and loads the compat SDK through importScripts, neither of which exists
    // in the browser globals above.
    files: ['src/sw/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        importScripts: 'readonly',
        firebase: 'readonly',
      },
    },
  },
])
