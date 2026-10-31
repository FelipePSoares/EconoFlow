const { withGradleProperties } = require('expo/config-plugins');

/**
 * Keeps the native build inside the toolchain's limits when `npx expo prebuild` regenerates
 * `android/` (which is not committed).
 *
 * `android.cmakeVersion` selects a CMake whose Ninja understands long paths. AGP's default
 * (3.22.1) ships Ninja 1.10, which stops a deep checkout with "Filename longer than 260
 * characters" while naming the object files of the codegen sources under `node_modules`.
 * Expo reads this Gradle property and applies it to every native module.
 *
 * The CMake release itself is an SDK package, not something prebuild can install:
 *   sdkmanager "cmake;3.30.4"
 */
module.exports = function withDetoxAndroid(config) {
  return withGradleProperties(config, (cfg) => {
    const properties = cfg.modResults;
    const key = 'android.cmakeVersion';

    if (!properties.some((entry) => entry.type === 'property' && entry.key === key)) {
      properties.push({ type: 'property', key, value: '3.30.4' });
    }

    return cfg;
  });
};
