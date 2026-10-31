const { withGradleProperties } = require('expo/config-plugins');

/** The CMake release to pin when the app config does not name one (Expo's historical value). */
const DEFAULT_CMAKE_VERSION = '3.30.4';

/**
 * Keeps the native build inside the toolchain's limits when `npx expo prebuild` regenerates
 * `android/` (which is not committed).
 *
 * `android.cmakeVersion` selects a CMake whose Ninja understands long paths. AGP's default
 * (3.22.1) ships Ninja 1.10, which stops a deep checkout with "Filename longer than 260
 * characters" while naming the object files of the codegen sources under `node_modules`.
 * Expo reads this Gradle property and assigns it to `externalNativeBuild.cmake.version` of
 * every module, so the value is a hard requirement on the SDK - not a preference.
 *
 * The version belongs in the tracked `app.json` (`["cmakeVersion", "x.y.z"]`), because the
 * generated `gradle.properties` is only a copy of it. CI derives the CMake package to install
 * from that copy, so pin the version here and let the job install it:
 *   scripts/cra-compliance.test.mjs asserts the two stay in step.
 */
module.exports = function withDetoxAndroid(config, { cmakeVersion = DEFAULT_CMAKE_VERSION } = {}) {
  return withGradleProperties(config, (cfg) => {
    const properties = cfg.modResults;
    const key = 'android.cmakeVersion';

    if (!properties.some((entry) => entry.type === 'property' && entry.key === key)) {
      properties.push({ type: 'property', key, value: cmakeVersion });
    }

    return cfg;
  });
};
