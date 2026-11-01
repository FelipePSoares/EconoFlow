import { requireOptionalNativeModule } from 'expo';

/**
 * The app's diagnostic trail sink — native, so it cannot be lost (#1116).
 *
 * ## Why this module exists
 *
 * Measured on the emulator, repeatedly: `console.log`, `console.warn` **and** `console.error`
 * written by the app's own JavaScript do not reach `adb logcat` in this build, with or without
 * a Detox session attached. The only JavaScript-originated lines that ever show up are the ones
 * React Native's *internal* error reporter emits. Every log-based design that went through
 * `console` therefore produced nothing, and diagnosing a blank screen meant guessing from
 * screenshots.
 *
 * `Log.i` on the native side cannot be stripped, buffered behind a dev-mode flag, or swallowed
 * by the bridge, so the trail lands where a developer already looks:
 *
 *     adb logcat -s EconoFlowTrace
 *
 * ## It is optional by design
 *
 * `requireOptionalNativeModule` returns `null` in a build that does not include the module —
 * Expo Go, a stale dev client — and every call here then becomes a no-op. A diagnostic must
 * never be the reason the app fails to start: that is the mistake the first version of this
 * work made, by importing a package the bundle could not resolve.
 *
 * The module ships from `modules/econoflow-log`, a **local Expo module**, so `expo prebuild`
 * re-adds it to the Android and iOS projects instead of deleting a hand-edited file.
 */

const TAG = 'EconoFlowTrace';

interface NativeLogModule {
  /** Writes one line to logcat (Android) / NSLog (iOS). */
  log(level: string, tag: string, message: string): void;
}

const native = requireOptionalNativeModule<NativeLogModule>('EconoFlowLog');

/** Whether this build has the native sink (a dev client or a release build, not Expo Go). */
export const hasNativeLogSink = (): boolean => native !== null;

/** Levels `Log.i` and friends accept; anything else is written as `info`. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Writes one trail line through the native log.
 *
 * Never throws: a diagnostic that fails must not become the failure. The message is a single
 * line on purpose — `adb logcat` keeps one line per entry, and a multi-line value would be
 * split across entries that no longer look like a sequence.
 */
export function nativeLog(level: LogLevel, message: string): void {
  if (!native) return;
  try {
    native.log(level, TAG, singleLine(message));
  } catch {
    // Nothing to do; the caller's next sink is not this module's business.
  }
}

/** The trail's tag, exported so the reader script and the tests agree with the writer. */
export const NATIVE_LOG_TAG = TAG;

/** logcat treats a newline as the end of an entry: keep one event on one line. */
function singleLine(message: string): string {
  return message.replace(/\r?\n/g, ' \\n ');
}
