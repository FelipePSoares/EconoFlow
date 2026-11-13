import { by, element, expect, waitFor } from 'detox';
import { PIN } from './accounts';
import { answerSystemSensorIfShown } from './biometrics';
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

/**
 * Gets past the device's PIN from the keypad: creating it when the device has none,
 * entering it when it has one. Leaves the app on whatever follows the PIN (the biometrics
 * offer, or the app itself).
 *
 * **The two screens are told apart by what they offer, and the difference is a wait.** The
 * keypad is `PinSetup` on a device with no PIN and `PinEntry` on one with it; only the setup
 * shows `pin-create-continue`. An immediate `exists()` samples the tree before the screen
 * has settled and picks the wrong branch, so the create button is looked for with a short
 * wait first.
 *
 * On the create branch the *title* is what marks the confirmation step — not a text match
 * on a translated sentence, and not "the keypad is still there", because the keypad of both
 * steps is the same component. `PinConfirmTitle` is the only rendering on that screen that
 * says the customer must repeat the PIN, so waiting for it is what makes the second
 * `typePin` land on the confirm step instead of typing the PIN a third time into `create`
 * (where `handleContinue` ignores a second press, and the app never opens).
 *
 * **A device with biometrics already ON never shows a keypad here**: `sessionEntryScreen`
 * sends it to `BiometricGate`, which asks the sensor. Waiting for the keypad alone therefore
 * timed out on a device that was correctly asking for a fingerprint — so the gate is checked
 * for first, and answered with the emulator's finger when it is the one on screen.
 */
export async function passDevicePin(pin = PIN, { createsIfMissing = true } = {}) {
  if (await appears(PIN_KEYS.digit('1'), PIN_SCREEN_WAIT_MS)) {
    await enterOrCreatePin(pin, createsIfMissing);
    return;
  }

  // No keypad: biometrics are on, so the sensor is what this device asks for.
  await answerSystemSensorIfShown();
}

/** Types the PIN on whichever keypad is up, creating the PIN when the device has none. */
async function enterOrCreatePin(pin, createsIfMissing) {
  await waitForKeypad();

  const creates = createsIfMissing && (await appears(CREATE_CONTINUE, PIN_SCREEN_WAIT_MS));

  if (!creates) {
    await typePin(pin);
    return;
  }

  await typePin(pin);
  await element(by.id(CREATE_CONTINUE)).tap();
  await waitFor(element(by.id(PIN_CONFIRM_TITLE))).toBeVisible().withTimeout(PIN_SCREEN_WAIT_MS);
  await typePin(pin);
}

/** How long a PIN screen transition may take before the spec decides it is not coming. */
const PIN_SCREEN_WAIT_MS = 15000;

/** `PinSetupScreen`'s confirm button: present while creating a PIN, absent while entering one. */
const CREATE_CONTINUE = 'pin-create-continue';

/** The confirmation step's own id (see `PinSetupScreen`). */
const PIN_CONFIRM_TITLE = 'pin-confirm-title';

/**
 * `true` when the element becomes visible within `timeout`; never throws.
 *
 * `waitFor` polls and `expect` samples once — a screen that arrives on a navigation needs the
 * polling form. Use this, not `exists()`, whenever the element may be on its way rather than
 * on screen already.
 */
export async function appears(testID, timeout = 15000) {
  try {
    await waitFor(element(by.id(testID))).toBeVisible().withTimeout(timeout);
    return true;
  } catch {
    return false;
  }
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

  // The notification rationale is *not* dismissed once and gone: it is mounted by
  // `MainNavigator` and its own answer only becomes known after an async permission read, so
  // it appears on top of the app a moment after `waitForApp` resolves — over the tab bar this
  // helper is about to tap. Dismissing it once, before the wait, left the card in place and
  // `tab-profile` never became *visible*, however long the wait (the Overview screen in the
  // failure screenshot is the app with the card covering its tab bar).
  for (let attempt = 0; attempt < 3; attempt++) {
    await dismissNotificationRationale();
    if (await appears(TAB_PROFILE, 5000)) break;
  }

  await waitFor(element(by.id(TAB_PROFILE))).toBeVisible().withTimeout(30000);
  await element(by.id(TAB_PROFILE)).tap();

  // `sign-out` is the LAST child of the Profile screen's `ScrollView` (`profile-scroll`), so
  // it sits below the fold on arrival: `toBeVisible` never matched it, whatever the timeout,
  // while the failure screenshot showed the Profile screen scrolled to the top.
  await scrollTo('profile-scroll', 'sign-out');
  await waitFor(element(by.id('sign-out'))).toBeVisible().withTimeout(30000);
  await element(by.id('sign-out')).tap();
  await waitFor(element(by.id('auth-hero'))).toBeVisible().withTimeout(45000);
}

/**
 * Scrolls a named scroll view until `testID` is visible.
 *
 * Some controls live below the fold — `sign-out` is the last child of the Profile screen's
 * `ScrollView` — and Detox's `toBeVisible` requires 75% of the view to be on screen, so it
 * never matches however long the wait, even though the element exists. Swiping the *scroll
 * view* (never the child: a swipe needs something scrollable to act on) brings it in.
 *
 * An element that is already visible is left alone, so this is safe to call unconditionally.
 */
export async function scrollTo(scrollTestID, testID, maxSwipes = 4) {
  if (await appears(testID, 2000)) return;

  for (let attempt = 0; attempt < maxSwipes; attempt++) {
    await element(by.id(scrollTestID)).swipe('up', 'slow', 0.6, 0.5);
    if (await appears(testID, 2000)) return;
  }
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
