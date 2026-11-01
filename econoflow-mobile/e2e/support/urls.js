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
 *
 * This URL is not special: nothing in the app handles it, and `App` only routes the
 * automation entry point (`econoflow://e2e/open`, see `src/e2e/e2eStart.ts`). It is the
 * scheme entry of the activity — what an ordinary customer's deeplink would be — so the app
 * cold-starts and decides its screen from what the device stores, which is exactly the state
 * each spec is about. Do not "fix" it into `e2e/open`: that entry point pins the Login screen
 * and is only for the two specs that start at the Login screen (`01-signUp`, `02-login`).
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

/**
 * Starts the app the way the product starts it — cold, on whatever the device stores — and
 * leaves the device **signed out, on the Login screen**.
 *
 * This is what a spec opens with, and it is what makes the specs independent of each other:
 * Detox decides the file order from measured durations, so "the spec before this one left a
 * session" is not a state a spec may be built on. `04` onward also call this between cases.
 *
 * The debug build's automation entry point (`econoflow://e2e/open`, see `src/e2e/e2eStart.ts`)
 * ends the stored session and shows the Login screen — the one start state a device with a
 * session cannot otherwise reach. Nothing is cleared from the device beyond that: a PIN and
 * the biometric flag belong to the device and are deliberately kept.
 */
export async function openAtLogin(timeout = 60000) {
  await relaunchApp(LOGIN_URL);
  await waitFor(element(by.id('login-submit'))).toBeVisible().withTimeout(timeout);
}

/** The automation entry point: a debug build ends the stored session and shows Login. */
export const LOGIN_URL = `${APP_SCHEME}://e2e/open`;
