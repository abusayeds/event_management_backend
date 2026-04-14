const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'prisma/generated/**',
      'src/config/database.ts',
      'src/config/index.ts',
      'src/config/redis.ts',
      'src/config/swagger.ts',
      'src/config/cors.ts',
      'src/middleware/**',
      'src/modules/**',
      'src/socket/**',
      'src/jobs/**',
      'src/cache/**',
      'src/interfaces/**',
      'src/utils/**',
      'src/routes/**',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2020,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
      'no-undef': 'off',
    },
  },
];
