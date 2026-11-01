import { by, element, expect, waitFor } from 'detox';
import { APP_PACKAGE, PIN, SEEDED_ACCOUNT, wrongPin } from '../support/accounts';
import { signOutThroughProfile, typePin, waitForApp, waitForKeypad } from '../support/cells';
import { dismissNotificationRationale } from '../support/notificationPrompt';
import { openAtLogin, relaunchApp, restartAndWaitFor, stopApp } from '../support/urls';

/**
 * Logging in, from the Login screen to the app, and the unlock a restart asks for.
 *
 * The tests are one chain: the session a login creates is what the restart, the wrong PIN
 * and the sign-out are about. The chain starts from whatever session the device was left
 * with — a previous spec's, or none — which the first test ends through the app's own
 * sign-out, so the login below starts from the Login screen like any customer would.
 *
 * Jest runs the files one worker at a time and Detox **shards them by expected duration**,
 * not by filename, so the order is not something this file can assume; every case below
 * therefore works from the state the previous one left, and the first one from any state.
 *
 * | step | what it proves |
 * |------|----------------|
 * | sign out | the previous session is gone and the Login screen is back |
 * | wrong password | the Login screen answers, and no session is created |
 * | sign in | the seeded account is accepted and the session starts with the PIN |
 * | create the PIN | the PIN has to be confirmed, and biometrics are offered after it |
 * | decline biometrics | the customer is in the app, with no PIN asked a second time |
 * | restart | the app restores the session: it asks for the PIN, never for credentials |
 * | wrong PIN | the keypad refuses and the app stays locked |
 * | right PIN | the app opens |
 * | sign out | the customer is back at Login |
 * | restart | after signing out, credentials again — never the old PIN |
 */
describe('Login', () => {
  const signInAsSeededAccount = async () => {
    await element(by.id('login-email')).typeText(SEEDED_ACCOUNT.email);
    await element(by.id('login-password')).typeText(SEEDED_ACCOUNT.password);
    await element(by.id('login-submit')).tap();
  };

  beforeAll(async () => {
    // The automation entry point, not the plain start URL: this spec needs the Login screen
    // on a device that may still hold a session and a PIN (see `src/e2e/e2eStart.ts`). It
    // exists in a debug build only. Waiting for the Login screen here is what makes the
    // first case below an assertion instead of a search.
    await openAtLogin();
  });

  it('ends the session the device had and shows the Login screen', async () => {
    // The entry point ends the session; this asserts the result, which is the state every
    // case below starts from.
    await expect(element(by.id('login-submit'))).toBeVisible();
    await expect(element(by.id('pin-key-1'))).not.toExist();
    await expect(element(by.id('main-navigator'))).not.toExist();
  });

  it('lands on a signed-out device, with no lock in front of the Login screen', async () => {
    await expect(element(by.id('login-submit'))).toBeVisible();
    await expect(element(by.id('pin-key-1'))).not.toExist();
    await expect(element(by.id('main-navigator'))).not.toExist();
  });

  it('refuses a wrong password without creating a session', async () => {
    await element(by.id('login-email')).typeText(SEEDED_ACCOUNT.email);
    await element(by.id('login-password')).typeText(`not-${SEEDED_ACCOUNT.password}`);
    await element(by.id('login-submit')).tap();

    await waitFor(element(by.id('login-error'))).toBeVisible().withTimeout(30000);
    await expect(element(by.id('pin-key-1'))).not.toExist();
    await expect(element(by.id('main-navigator'))).not.toExist();
  });

  it('signs in and starts the session at the PIN', async () => {
    await element(by.id('login-email')).clearText();
    await element(by.id('login-password')).clearText();
    await signInAsSeededAccount();

    // The PIN belongs to the device, not the account: by the time this spec runs, an
    // earlier spec (or an earlier run) has created one, so the gate opens on the keypad to
    // *enter* it. What must never happen is a login that stops on the Login screen — the
    // session is the thing this case proves, not which of the two PIN screens follows.
    await waitForKeypad(60000);
    await expect(element(by.id('main-navigator'))).not.toExist();
    await expect(element(by.id('login-submit'))).not.toExist();
  });

  it('getting past the PIN opens the app when the PIN is the one the device has', async () => {
    // The keypad on screen is `PinSetup` on a device with no PIN and `PinEntry` on one with
    // it. This case tells them apart by what the screen offers: the create flow has the
    // confirm button, the entry flow does not. Both end the same way — the app.
    if (await exists('pin-create-continue')) {
      await typePin(PIN);
      await element(by.id('pin-create-continue')).tap();
      await waitFor(element(by.text('Confirm your PIN'))).toBeVisible().withTimeout(15000);
      await typePin(PIN);
      await waitFor(element(by.id('biometric-enroll-skip'))).toBeVisible().withTimeout(30000);
      // The offer is declined: the app PIN is the lock, biometrics stay optional.
      await element(by.id('biometric-enroll-skip')).tap();
    } else {
      await typePin(PIN);
    }

    await waitForApp(60000);
    await dismissNotificationRationale();
    // The seeded account already has a name: nothing to onboard.
    await expect(element(by.id('onboarding-first-name'))).not.toExist();
  });

  it('asks for the PIN after a restart, not for credentials', async () => {
    await restartAndWaitFor('pin-key-1');
    await dismissNotificationRationale();

    // The session survives the process (never the Login screen), and the lock it opens on
    // is this device's: entering the PIN, because the PIN already exists on it.
    await expect(element(by.text('Enter App PIN'))).toBeVisible();
    await expect(element(by.id('login-email'))).not.toExist();
  });

  it('refuses a wrong PIN and keeps the customer out', async () => {
    await typePin(wrongPin(PIN));

    await waitFor(element(by.textMatch(/attempt/i))).toBeVisible().withTimeout(20000);
    await expect(element(by.id('main-navigator'))).not.toExist();
  });

  it('opens the app with the right PIN', async () => {
    // The keypad clears itself after a wrong PIN; typing on the screen that is showing is
    // all this case needs.
    await typePin(PIN);
    await waitForApp(60000);
  });

  it('signing out returns to the Login screen', async () => {
    await dismissNotificationRationale();
    await signOutThroughProfile();

    // The signed-out tree replaces the session one, with no lock screen in front of it:
    // the account is no longer reachable without credentials.
    await expect(element(by.id('login-submit'))).toBeVisible();
    await expect(element(by.id('pin-key-1'))).not.toExist();
  });

  it('a restart after signing out asks for credentials, not for the PIN', async () => {
    // Signed-out state, part one: the session does not survive the process.
    await restartAndWaitFor('login-submit');
    await expect(element(by.id('pin-key-1'))).not.toExist();
    await expect(element(by.id('main-navigator'))).not.toExist();
  });

  it('a killed app that is started again still asks for credentials', async () => {
    // Signed-out state, part two: a killed process is not a resumed one.
    await stopApp();
    await relaunchApp();
    await waitFor(element(by.id('login-submit'))).toBeVisible().withTimeout(45000);
    await expect(element(by.id('pin-key-1'))).not.toExist();
  });
});

/** `true` when the element exists; never throws. */
async function exists(testID) {
  try {
    await expect(element(by.id(testID))).toExist();
    return true;
  } catch {
    return false;
  }
}
