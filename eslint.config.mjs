// Root ESLint flat config — shared base for every v2 package/app.
//
// Adapted from v1 server/eslint.config.mjs (same rule set that has governed the shared/
// server/mcp packages for the last two years) with two v2-specific deltas:
//
//   - no-process-env: 'off'   — v2 reads process.env.KP_* pervasively (see
//                                apps/web/next.config.ts, packages/renderer/src/cardconjurer/
//                                hosts/node-handle.ts, apps/web/scripts/export-static.mjs).
//   - globalIgnores widened   — v2's generated/build/output dirs (apps/web/.next,
//                                apps/web/generated, apps/web/out, packages/*/dist,
//                                packages/renderer/external, collection/).
//
// Package-specific configs (packages/*/eslint.config.mjs, apps/web/eslint.config.mjs)
// re-export this base — plus any additions (e.g. Next.js's core-web-vitals for the web app).

import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export const baseIgnores = globalIgnores([
  '**/node_modules/',
  '**/dist/',
  '**/.next/',
  '**/generated/',
  '**/out/',
  '**/external/',
  // v1 packages we don't lint from v2's config (they have their own root-level configs
  // that will be removed with v1 in Phase 5).
  'client/',
  'server/',
  'shared/',
  'mcp/',
  // apps/web has its own eslint.config.mjs (extends base + Next.js flat plugin) — lint it
  // via `pnpm --filter @kindred-paths/web lint` (also invoked by `pnpm lint:all`). Ignoring
  // here avoids the root run trying to apply Next-specific rules with no plugin loaded.
  'apps/web/',
  // The collection is a separate repo cloned in; not our source. Leading slash anchors
  // this to the repo root — without it, this (like .gitignore's bare 'collection' bug,
  // fixed alongside this) would also match apps/web/src/core/collection/.
  '/collection/',
  // CardConjurer clone lives under packages/renderer/external (already covered by
  // '**/external/' above), plus rendered PNG cache and static-export artifacts.
  '.cache/',
  'spike/',
]);

/**
 * The shared rule set. Consumers spread this into their own config so they can add
 * package-specific rules/overrides on top.
 */
export const baseRules = {
  ...js.configs.recommended.rules,
  ...tseslint.configs.recommended[0].rules,
  ...tseslint.configs.recommended[1].rules,
  ...tseslint.configs.recommended[2].rules,

  'max-len': ['error', {
    code: 150,
    ignoreComments: true,
    ignoreUrls: true,
    tabWidth: 2,
  }],

  'no-console': 'off',
  'no-param-reassign': 'off',
  'no-restricted-syntax': 'off',

  'no-use-before-define': ['error', {
    functions: false,
    classes: false,
    variables: true,
  }],

  'no-process-env': 'off', // v2 uses env vars pervasively; see comment above
  'no-await-in-loop': 'off',
  'prefer-destructuring': 'off',
  'comma-dangle': ['error', 'always-multiline'],
  'eol-last': ['error', 'always'],

  quotes: ['error', 'single', {
    avoidEscape: true,
  }],

  'no-trailing-spaces': 'error',
  semi: ['error', 'always'],
  'no-unreachable': 'error',
  'no-unexpected-multiline': 'error',
  indent: ['error', 2, { SwitchCase: 1 }],

  'space-infix-ops': ['error', {
    int32Hint: false,
  }],

  'object-curly-spacing': ['error', 'always'],
  'key-spacing': 'error',
  'space-in-parens': 'error',
  'no-multi-spaces': 'error',
  'comma-spacing': 'error',

  'no-multiple-empty-lines': ['error', {
    max: 1,
  }],

  'class-methods-use-this': 'off',

  'no-plusplus': ['error', {
    allowForLoopAfterthoughts: true,
  }],

  '@typescript-eslint/no-unused-vars': ['warn', {
    vars: 'all',
    args: 'none',
    varsIgnorePattern: '^_',
  }],

  'no-template-curly-in-string': 'off',
  'no-new': 'off',
  '@typescript-eslint/no-explicit-any': 'error',
};

export default defineConfig([
  baseIgnores,
  {
    files: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: baseRules,
  },
]);
