/**
 * Detox configuration for the integration (end-to-end) suite.
 *
 * The suite runs against a native **debug** build, because Detox talks to the app through
 * the instrumentation runner that lives in the androidTest APK (`android/build.gradle` and
 * `android/app/build.gradle` carry that wiring).
 *
 * Prerequisites (see `setup.md` → "Integration tests with Detox"):
 *   - the local API stack, reachable from the emulator (`EXPO_PUBLIC_API_URL` in `.env.local`
 *     points at `http://localhost:7003`, bridged with `adb reverse tcp:7003 tcp:7003`);
 *   - the emulator booted, and both APKs built with `npm run e2e:build`.
 */

/** Pixel_7_API_35 is the AVD `setup.md` documents; override it with DETOX_AVD_NAME. */
const avdName = process.env.DETOX_AVD_NAME || 'Pixel_7_API_35';

/**
 * The ABI the APKs are built for, passed on the Gradle command line rather than left to
 * `gradle.properties`: the emulator is x86_64, and a debug build for every ABI compiles four
 * times more native code (and three of those copies are never installed). The test APK must
 * match the app's ABI, so both are part of the same build command.
 */
const abi = process.env.DETOX_ANDROID_ABI || 'x86_64';

const androidDebugApk = 'android/app/build/outputs/apk/debug/app-debug.apk';
const androidDebugTestApk = 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk';

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
      build: `cd android && gradlew.bat assembleDebug assembleDebugAndroidTest -PreactNativeArchitectures=${abi}`,
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
