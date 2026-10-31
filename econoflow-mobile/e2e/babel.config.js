const path = require('path');

/**
 * Babel config for the Detox specs (`e2e/*.e2e.js`).
 *
 * Node cannot parse JSX out of the box, so the screen and component files have to be
 * loaded through Expo's preset, the same way Metro compiles the app. The config lives in
 * `e2e/` instead of the project root so the unit suite (jest-expo reads the root
 * configuration itself) is untouched.
 *
 * The preset is an absolute path because `babel-preset-expo` is hoisted under `expo/`;
 * naming it plain would only resolve for files inside `expo/`'s own dependency tree.
 *
 * @type {import('@babel/core').TransformOptions}
 */
module.exports = {
  babelrc: false,
  configFile: false,
  presets: [
    require.resolve('babel-preset-expo', {
      paths: [path.dirname(require.resolve('expo/package.json'))],
    }),
  ],
};
