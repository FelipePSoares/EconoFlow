/**
 * Detox configuration for the integration (end-to-end) suite.
 *
 * The suite runs against a native **debug** build, because Detox talks to the app through
 * the `AndroidJUnitRunner` that `android/app/build.gradle` adds to `debugAndroidTest`.
 *
 * Prerequisites (see `setup.md` → "Integration tests with Detox"):
 *   - the local API stack, reachable from the emulator at `http://localhost:7003`
 *     (`EXPO_PUBLIC_API_URL` in `.env.local` — `adb reverse tcp:7003 tcp:7003` bridges it);
 *   - the emulator booted, and the app built with `npm run e2e:build`.
 */

/** Pixel_7_API_35 is the AVD `setup.md` documents; override it with DETOX_AVD_NAME. */
const avdName = process.env.DETOX_AVD_NAME || 'Pixel_7_API_35';

const androidDebugApk = 'android/app/build/outputs/apk/debug/app-debug.apk';
const androidDebugTestApk = 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk';

// Flipper (RN's default debug JS bridge) is off in the debug build; the Detox Gradle plugin
// turns Flipper off on its own as well, and the app does not configure it either way.

/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 180000,
      teardownTimeout: 60000,
    },
  },
  apps: {
    'android.debug': {
      type: 'android.apk',
      binaryPath: androidDebugApk,
      testBinaryPath: androidDebugTestApk,
      build:
        'cd android && gradlew.bat assembleDebug assembleDebugAndroidTest -PreactNativeArchitectures=x86_64',
    },
  },
  devices: {
    emulator: {
      type: 'android.emulator',
      device: {
        avdName,
      },
    },
  },
  configurations: {
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
  },
  artifacts: {
    rootDir: 'e2e/artifacts',
    plugins: {
      log: 'failing',
      screenshot: { shouldTakeAutomaticSnapshots: true, keepOnlyFailedTestsArtifacts: true },
    },
  },
};
