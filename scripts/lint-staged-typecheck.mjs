#!/usr/bin/env node
// Wrapper invoked from lint-staged entries: runs `pnpm typecheck:<pkg>` and ignores any
// filename args lint-staged appends. TypeScript project-wide checks can't sensibly run
// on individual files (the tsc CLI's behavior with per-file args disables tsconfig
// options like `paths`, `types`, etc.), so we always check the whole package.
//
// Usage: node scripts/lint-staged-typecheck.mjs <web|renderer|shared>

import { spawnSync } from 'node:child_process';

const target = process.argv[2];
if (!target || !['web', 'renderer', 'shared'].includes(target)) {
  console.error('usage: lint-staged-typecheck.mjs <web|renderer|shared>');
  process.exit(2);
}

const result = spawnSync('pnpm', ['run', `typecheck:${target}`], {
  stdio: 'inherit',
  shell: false,
});
process.exit(result.status ?? 1);
