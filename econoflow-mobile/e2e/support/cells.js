import { by, element, expect, waitFor } from 'detox';
import { PIN } from './accounts';
import { dismissNotificationRationale } from './notificationPrompt';

/**
 * The PIN keypad. `PinSetupScreen`, `PinEntryScreen` and the in-app `LockOverlay` all render
 * a digit as `pin-key-<digit>`, so one helper reaches whichever of the three is on screen.
 */
export const PIN_KEYS = {
  backspace: 'pin-key-backspace',
  digit: (digit) => `pin-key-${digit}`,
};

/** Types a PIN on the keypad of whichever lock screen is showing. */
export async function typePin(pin) {
  await waitForKeypad();
  for (const digit of String(pin)) {
    await element(by.id(PIN_KEYS.digit(digit))).tap();
  }
}

/**
 * Waits for the keypad, the point at which a lock screen has settled: the gate reads the
 * stored PIN and decides between biometrics and the PIN before showing one.
 */
export async function waitForKeypad(timeout = 45000) {
  await waitFor(element(by.id(PIN_KEYS.digit('1')))).toBeVisible().withTimeout(timeout);
}

/** Waits for the signed-in tree — the app a logged-in customer sees. */
export async function waitForApp(timeout = 45000) {
  await waitFor(element(by.id('main-navigator'))).toBeVisible().withTimeout(timeout);
}

/** `true` when the element exists; never throws. */
export async function exists(testID) {
  try {
    await expect(element(by.id(testID))).toExist();
    return true;
  } catch {
    return false;
  }
}

/**
 * Signs out through the Profile tab, the customer's own way out.
 *
 * The tab is reached by its `testID` (`tab-profile`, set by `MainNavigator`), not by its
 * translated label: that is the contract the suite keeps everywhere else.
 *
 * Every step waits for what it needs *before* touching it: the signed-in tree has to be up
 * (a spec can arrive on the lock screens, or just after a restart), the tab bar stays
 * hidden behind the lock, and the sign-out replaces the whole tree with the Login screen.
 * Tapping a view that is still incoming is how a spec "passes" on nothing.
 *
 * The account screen is reached **by its tab node** (`tab-profile`), never by the
 * `sign-out` id: the tab bar shows every tab's node whether or not its screen is the one
 * on top, so waiting for `sign-out` straight after a launch waited for a screen nobody had
 * opened — which is how a sign-out case failed while the app was sitting on Overview.
 */
export async function signOutThroughProfile() {
  await waitForApp();
  await dismissNotificationRationale();

  // The session may be locked (a restart, or an app returned from the background): the
  // Profile tab only exists behind the unlock, so unlock first when a keypad is showing.
  if (await exists(PIN_KEYS.digit('1'))) {
    await typePin(PIN);
    await waitForApp();
  }

  await waitFor(element(by.id(TAB_PROFILE))).toBeVisible().withTimeout(30000);
  await element(by.id(TAB_PROFILE)).tap();
  await waitFor(element(by.id('sign-out'))).toBeVisible().withTimeout(30000);
  await element(by.id('sign-out')).tap();
  await waitFor(element(by.id('auth-hero'))).toBeVisible().withTimeout(45000);
}

/**
 * Brings the device to the Login screen from wherever it is: signed in, locked, or already
 * signed out.
 *
 * This is the only supported way for a spec to make itself independent of the one before
 * it. Detox runs the spec files in an order derived from their measured duration, so a spec
 * cannot assume which one ran first — it can only assume its own starting point, and this
 * is that starting point.
 */
export async function signOutIfNeeded() {
  if (await exists('login-submit')) return;          // already signed out
  if (await exists('onboarding-first-name')) {
    // A customer registered and never finished onboarding: finish it, so the session
    // reaches the app and can be ended.
    await element(by.id('onboarding-first-name')).typeText('E2e');
    await element(by.id('onboarding-last-name')).typeText('Teardown');
    await element(by.id('onboarding-submit')).tap();
    await waitForApp(60000);
    if (await exists('onboarding-skip-project')) {
      await element(by.id('onboarding-skip-project')).tap();
      await waitForApp();
    }
  }
  await signOutThroughProfile();
}

/** The tab bar's ids (`MainNavigator` → `tabBarButtonTestID`). */
export const TAB_PROFILE = 'tab-profile';
export const TAB_OVERVIEW = 'tab-overview';
