module.exports = {
  root: true,
  extends: ['expo'],
  rules: {
    'no-console': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // jest.mock() factories require require() — it is unavoidable due to hoisting
      files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
  ],
};
