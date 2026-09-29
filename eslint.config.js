import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'tests/.build']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  // Serverless functions, scripts and tests run in Node, not the browser
  // (v3.101.0). Linted as browser code, every process.env read was an error,
  // and that noise hid the real findings.
  {
    files: ['api/**/*.js', 'scripts/**/*.{js,cjs}', 'tests/**/*.mjs', 'vite.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
])
