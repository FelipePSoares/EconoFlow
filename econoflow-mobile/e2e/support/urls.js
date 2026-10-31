import { by, device, element, waitFor } from 'detox';

/**
 * The app's URL scheme and package (`app.json` → `expo.scheme` / `expo.android.package`).
 */
export const APP_SCHEME = 'econoflow';
export const APP_PACKAGE = 'pt.econoflow.mobile';

/**
 * A start URL: opens the app without adding to its history.
 *
 * The suite uses one instead of a bare `launchApp` wherever the screen it needs is the one a
 * cold start shows. The activity is `singleTask`, so a plain relaunch keeps the running
 * navigator — whose `initialRouteName` is read only on mount — and the screen the previous
 * spec left can stay on top. A URL starts the app from its root instead.
 */
export const START_URL = `${APP_SCHEME}://econoflow-start`;

/**
 * Launches the app, with the notification permission denied.
 *
 * The permission is denied so the post-login prompt shows its rationale — which the specs
 * dismiss — rather than the OS dialog, which would sit over the assertions.
 *
 * `newInstance: false` on purpose: with `true`, Detox stops the app and then waits for the
 * process (`ps | grep`) to reappear before it hands control to instrumentation. On the
 * emulators this suite runs against that wait never completes — it fails with "PID still not
 * available" although the app itself starts and renders — so the app is handed to Detox
 * without a restart. A spec that needs a cold start calls `stopApp()` first.
 */
export async function relaunchApp(url = START_URL) {
  await device.launchApp({
    newInstance: false,
    url,
    permissions: { notifications: 'deny' },
  });
}

/** Kills the app. */
export async function stopApp() {
  await device.terminateApp();
}

/**
 * Restarts the app: the process is killed and started again from its root.
 *
 * This is the "the customer reopened the app" case the unlock specs are about — the session
 * is restored from what was left on the device, something returning to a backgrounded app
 * never exercises.
 */
export async function restartApp({ url } = {}) {
  await device.relaunchApp({ url });
}

/**
 * Restarts the app and waits for the screen it decided to start on.
 *
 * A restart invalidates the views that were on screen, so the first finder afterwards can
 * race the new tree; waiting for one known marker absorbs that.
 */
export async function restartAndWaitFor(testID, timeout = 45000) {
  await restartApp();
  await waitFor(element(by.id(testID))).toBeVisible().withTimeout(timeout);
}
