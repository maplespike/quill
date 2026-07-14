// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      // Baseline: existing codebase has many unused vars / floating promises.
      // Keep as warnings so `pnpm lint` passes locally; CI uses lint:strict.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      // Type-aware rules disabled until a tsconfig.eslint.json covers test files.
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'eqeqeq': ['error', 'always'],
      'prefer-const': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.d.ts',
      'packages/portal/dist/**',
      'packages/portal/public/**',
      '.turbo/**',
      '.wrangler/**',
    ],
  },
);
