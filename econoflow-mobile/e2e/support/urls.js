import { execSync } from 'node:child_process';
import { by, device, element, waitFor } from 'detox';
import { answerSystemSensorIfShown } from './biometrics';

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
  // An app that came back in front asks the sensor again when biometrics are on; see
  // `restartApp` for why it is answered here rather than in each spec.
  await answerSystemSensorIfShown();
}

/** Kills the app. */
export async function stopApp() {
  await device.terminateApp();
}

/**
 * Waits for an element to become visible, and says which one in the app's own trail when it
 * does not.
 *
 * A Detox timeout reports the line in the helper, not the element: every "it never appeared"
 * failure then looks identical, whichever wait it was. The failing case is reproduced with
 * `--record-logs all`, so the trail of *that* case names the wait — which is the one fact no
 * screenshot can give (the screen may have been right a moment later).
 */
export async function waitVisible(testID, timeout = 45000) {
  try {
    await waitFor(element(by.id(testID))).toBeVisible().withTimeout(timeout);
  } catch (error) {
    traceFromSpec('e2e.wait.failed', { testID, timeout });
    throw error;
  }
}

/**
 * What Detox's own view hierarchy says about a few ids, as a one-line summary.
 *
 * A screenshot can show a screen that Detox still reports as invisible — that is exactly how
 * the "a restart opens on Overview" case failed: the picture showed the tab bar and the
 * hierarchy did not match it. The hierarchy is the authority the matcher acts on, and it can
 * only be read through Detox, so its answer is returned here and carried out by whoever
 * asserts next (a thrown assertion's message is what ends up in the report).
 */
export async function describeIds(testIDs) {
  const parts = [];
  for (const id of testIDs) {
    try {
      const attributes = await element(by.id(id)).getAttributes();
      parts.push(
        `${id}={visible:${attributes.visible}, hw:${attributes.hittable},`
        + ` rect:${JSON.stringify(attributes.frame ?? null)}}`,
      );
    } catch (error) {
      parts.push(`${id}=<${String(error).split('\n')[0].slice(0, 80)}>`);
    }
  }
  return parts.join(' ');
}

/**
 * The polling "is this on screen?" check, with its outcome in the trail.
 *
 * `appears` is used to *decide* things — is the offer here, is the keypad up — and a `false`
 * it should not have returned is impossible to see afterwards. Recorded, the trail says which
 * checks were made and how each ended.
 */
export async function traceAppears(testID, result, timeout) {
  traceFromSpec('e2e.appears', { testID, result, timeout });
}

/**
 * A named step in a spec, written to the same trail.
 *
 * Detox's timeout message names the helper's line, never the assertion that timed out — every
 * "wait" failure reads the same whichever wait it was. The steps a case reaches are the only
 * record of where it stopped, so they are written as they happen.
 */
export function traceStep(step) {
  traceFromSpec('e2e.step', { step });
}

/** One trail line from the spec, read with `adb logcat -s EconoFlowTrace`. */
function traceFromSpec(event, data) {
  try {
    const json = typeof data === 'undefined' ? '' : ` ${JSON.stringify(data)}`;
    execSync(`adb -e shell log -t EconoFlowTrace "e2e ${event}${json}"`, { stdio: 'ignore' });
  } catch {
    // The trail is a diagnostic: a spec must never fail because it could not be written.
  }
}

/**
 * Restarts the app: the process is killed and started again from its root.
 *
 * This is the "the customer reopened the app" case the unlock specs are about — the session
 * is restored from what was left on the device, something returning to a backgrounded app
 * never exercises.
 */
/**
 * Restarts the app: the process is killed and started again from its root.
 *
 * This is the "the customer reopened the app" case the unlock specs are about — the session
 * is restored from what was left on the device, something returning to a backgrounded app
 * never exercises.
 *
 * **The start URL is not optional.** `relaunchApp()` without one asks Android to replay the
 * last intent, and in these specs the last intent is the automation entry point
 * (`econoflow://e2e/open`, from `openAtLogin` in `beforeEach`) — whose handler ends the stored
 * session on purpose. The restart then looked like "the app signs the customer out while the
 * unlock gate asks for the sensor": the trail showed `biometric.prompt.requested` followed by
 * `auth.clear {"caller":"clearAuth <- openE2eStart"}`, the gate's attempt went stale, and the
 * spec waited for an app that had been sent back to Login. A restart always names the plain
 * start URL, which is what a customer's own relaunch is.
 */
export async function restartApp({ url = START_URL } = {}) {
  await device.relaunchApp({ url });
  // A restart is what makes the app ask for the sensor, and while that OS dialog is up the
  // app's window has no focus — every later `waitFor` would fail with
  // `has-window-focus=false`. See `answerSystemSensorIfShown` for why it is answered here
  // rather than in each spec.
  await answerSystemSensorIfShown();
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
