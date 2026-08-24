// apps/web ESLint config — inherits the workspace-wide base + adds the Next.js flat
// config (its own `core-web-vitals` bundle, which layers on `next/recommended`). See
// ../../eslint.config.mjs for the base rule set rationale.
//
// We use @next/eslint-plugin-next's native flat configs directly rather than piping the
// old-shape `next/typescript` / `next/core-web-vitals` presets through @eslint/eslintrc's
// FlatCompat — the compat wrapper trips over an internal circular-plugin-reference in
// the Next 16 plugin's `configs` object at flat-config-normalization time.

import { defineConfig, globalIgnores } from 'eslint/config';
import nextPlugin from '@next/eslint-plugin-next';
import baseConfig from '../../eslint.config.mjs';

export default defineConfig([
  ...baseConfig,
  // Next's core-web-vitals bundle (extends `recommended`; adds a11y-flavored rules and
  // the `no-img-element` / `no-html-link-for-pages` warnings we already respect).
  nextPlugin.configs['core-web-vitals'],
  {
    // JSX/TSX naturally goes long with Tailwind class strings — bump max-len to 200
    // here (base is 150 for regular TS/JS in packages/scripts).
    files: ['**/*.{tsx,jsx}'],
    rules: {
      'max-len': ['error', {
        code: 200,
        ignoreComments: true,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        tabWidth: 2,
      }],
    },
  },
  // Additional local ignores on top of the base ones (which already cover .next, out,
  // generated).
  globalIgnores(['public/renders/']),
]);
