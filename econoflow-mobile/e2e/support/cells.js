import { by, element, waitFor } from 'detox';

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
 * Signs out through the Profile tab, the customer's own way out.
 *
 * The tab button has no `testID` of its own (`MainNavigator` leaves it to the navigator),
 * so the tab is found by its label.
 */
export async function signOutThroughProfile() {
  await element(by.text(TAB_PROFILE_LABEL)).tap();
  await waitFor(element(by.id('sign-out'))).toBeVisible().withTimeout(30000);
  await element(by.id('sign-out')).tap();
  await waitFor(element(by.id('auth-hero'))).toBeVisible().withTimeout(45000);
}

/** `en.json` → `TabProfile`; the device runs the app in English. */
export const TAB_PROFILE_LABEL = 'Profile';
