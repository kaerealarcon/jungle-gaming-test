import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'assets/**', 'public/mockServiceWorker.js', '.test-*.generated.mjs', 'playwright-report/**', 'test-results/**', '.delivery-check/**', 'delivery/**', 'docs/evidence/e2e-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['docs/**/*.mjs', 'scripts/**/*.mjs', 'tests/**/*.ts', 'playwright.config.ts'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
