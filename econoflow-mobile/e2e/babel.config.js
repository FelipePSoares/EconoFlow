const path = require('path');

/**
 * Babel config for the Detox specs (`e2e/*.e2e.js`).
 *
 * Node cannot parse JSX out of the box, so the screens and components a spec imports have to
 * be loaded through Expo's preset, the same way Metro compiles the app. The config lives in
 * `e2e/` instead of the project root so the unit suite (jest-expo reads the root
 * configuration itself) is untouched.
 *
 * `jest.config.js` hands this file to `babel-jest` as the transform's `configFile`, which is
 * Babel's *root* programmatic option — so this file must not set `configFile` itself ("only
 * allowed in root programmatic options").
 *
 * The preset is an absolute path because `babel-preset-expo` is hoisted under `expo/`; naming
 * it plainly would only resolve for files inside `expo/`'s own dependency tree.
 *
 * @type {import('@babel/core').TransformOptions}
 */
module.exports = {
  babelrc: false,
  presets: [
    require.resolve('babel-preset-expo', {
      paths: [path.dirname(require.resolve('expo/package.json'))],
    }),
  ],
};
