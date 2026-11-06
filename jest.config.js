/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  // Loads .env.test before any module reads the environment
  setupFiles: ['<rootDir>/tests/setup/env.ts'],
  globalSetup: '<rootDir>/tests/setup/globalSetup.ts',
  // Suites share one database, so they run one at a time
  maxWorkers: 1,
  clearMocks: true,
};
