/**
 * Jest configuration for Detox — deliberately separate from the unit-test config in
 * `package.json`.
 *
 * The unit suite runs on `jest-expo` (jsdom-ish RN mocks), while these specs drive a real
 * app on a device: they need Detox's own environment, a long timeout, and no haste
 * collisions with the unit tests. `npm test` therefore keeps its `testPathIgnorePatterns`
 * entry for `e2e/`, and `npm run e2e:test` is the only entry point here.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  rootDir: '..',
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  testMatch: ['<rootDir>/e2e/**/*.e2e.js'],
  transform: {
    // `babel-preset-expo` is hoisted under `expo/`, which Babel resolves from the preset
    // name rather than from this file's directory — so the preset is named, not required.
    '\\.js$': ['babel-jest', { configFile: require.resolve('./babel.config.js') }],
  },
  transformIgnorePatterns: ['/node_modules/(?!.*\\.mjs$)'],
};
