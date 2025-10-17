import { defineConfig, globalIgnores } from 'eslint/config';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  globalIgnores(['**/node_modules/', '**/dist/', '**/.cardconjurer/']),
  {
    extends: compat.extends('eslint:recommended', 'plugin:@typescript-eslint/recommended'),

    plugins: {
      '@typescript-eslint': typescriptEslint,
    },

    languageOptions: {
      globals: {
        ...Object.fromEntries(Object.entries(globals.browser).map(([key]) => [key, 'off'])),
      },

      parser: tsParser,
      ecmaVersion: 12,
      sourceType: 'module',
    },

    rules: {
      'max-len': ['error', {
        code: 150,
        ignoreComments: true,
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

      'no-process-env': 'off',
      'no-await-in-loop': 'off',
      'prefer-destructuring': 'off',
      'import/prefer-default-export': 'off',
      'import/no-cycle': 'off',
      'comma-dangle': ['error', 'always-multiline'],
      'eol-last': ['error', 'always'],

      quotes: ['error', 'single', {
        avoidEscape: true,
      }],

      'no-trailing-spaces': 'error',
      semi: ['error', 'always'],
      'no-unreachable': 'error',
      'no-unexpected-multiline': 'error',
      indent: ['error', 2],

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

      '@typescript-eslint/lines-between-class-members': 'off',
      'class-methods-use-this': 'off',
      'import/extensions': 'off',
      'import/no-absolute-path': 'off',

      'no-plusplus': ['error', {
        allowForLoopAfterthoughts: true,
      }],

      '@typescript-eslint/indent': 'off',

      '@typescript-eslint/no-unused-vars': ['warn', {
        vars: 'all',
        args: 'none',
      }],

      'no-template-curly-in-string': 'off',
      'no-new': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
]);
