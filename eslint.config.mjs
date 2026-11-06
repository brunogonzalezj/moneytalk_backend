import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'src/generated', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      // A leading underscore marks a value that is intentionally unused
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // Logging goes through utils/logger
      'no-console': 'error',
    },
  },
  {
    // The logger and the env bootstrap are the places allowed to print
    files: ['src/utils/logger.ts', 'src/config/env.ts', 'prisma/seed.ts'],
    rules: { 'no-console': 'off' },
  }
);
