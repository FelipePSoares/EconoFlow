/**
 * Jest configuration for Detox — deliberately separate from the unit-test config in
 * `package.json`.
 *
 * The unit suite runs on `jest-expo` (RN mocks, jsdom-ish environment, 91 suites in one
 * process); these specs drive a real app on a device, so they need Detox's own environment,
 * a long timeout, and no Jest modules shared with the unit run. `npm test` therefore ignores
 * `e2e/` (`testPathIgnorePatterns`), and `npm run e2e:test` is the only entry point here.
 *
 * **Jest's `rootDir` is this directory**, because Detox starts Jest with `--config
 * e2e/jest.config.js` and Jest takes the config file's directory as the project root. Paths
 * below are therefore relative to `e2e/`, not to the app: `testMatch` is `**\/*.e2e.js`, not
 * `<rootDir>/e2e/**`. Setting `rootDir` to the app directory instead would make Jest look up
 * its own packages from a directory it does not treat as the project, which is how a run
 * stops with "Could not resolve jest package". Detox itself resolves `jest` from the process
 * working directory, so `npm run e2e:test` must keep running from `econoflow-mobile/`.
 *
 * The Babel config is passed by absolute path: `babel-preset-expo` is hoisted under `expo/`,
 * so a preset named relatively would only resolve for files inside `expo/`'s dependency tree.
 *
 * @type {import('jest').Config}
 */
const path = require('node:path');

module.exports = {
  testMatch: ['**/*.e2e.js'],
  testTimeout: 120000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  transform: {
    '\\.js$': ['babel-jest', { configFile: path.join(__dirname, 'babel.config.js') }],
  },
  transformIgnorePatterns: ['/node_modules/(?!.*\\.mjs$)'],
};
