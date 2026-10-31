import { by, element, expect, waitFor } from 'detox';
import { APP_PACKAGE, PIN, SEEDED_ACCOUNT, wrongPin } from '../support/accounts';
import { signOutThroughProfile, typePin, waitForApp, waitForKeypad } from '../support/cells';
import { dismissNotificationRationale } from '../support/notificationPrompt';
import { relaunchApp, restartAndWaitFor, stopApp } from '../support/urls';

/**
 * Logging in, from the Login screen to the app, and the unlock a restart asks for.
 *
 * The tests are one chain: the session a login creates is what the restart, the wrong PIN
 * and the sign-out are about. The chain starts with a device session that is not
 * `test1@test.com`'s — the one `signUp.e2e.js` registered — which the first test ends
 * through the app's own sign-out, so the login below starts from the Login screen like any
 * customer would.
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
    await relaunchApp();
  });

  it('ends the session the device had and shows the Login screen', async () => {
    // Signed out already (a previous run), or the app of the account the registration
    // spec created. Either way this spec starts from the Login screen.
    if (await exists('login-submit')) {
      return;
    }

    // The app may be locked on the PIN screen left by the previous spec.
    if (await exists('pin-key-1')) {
      await typePin(PIN);
    }

    await waitForApp();
    await dismissNotificationRationale();
    await signOutThroughProfile();
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

  it('signs in and starts the session at the PIN setup', async () => {
    await element(by.id('login-email')).clearText();
    await element(by.id('login-password')).clearText();
    await signInAsSeededAccount();

    // The gate decides "no PIN yet → create one" first. Biometrics are an offer, never
    // the lock, so they are not proposed before there is a PIN to fall back to.
    await waitForKeypad(60000);
    await expect(element(by.text('Create App PIN'))).toBeVisible();
    await expect(element(by.id('main-navigator'))).not.toExist();
  });

  it('only accepts the PIN once it is confirmed', async () => {
    await typePin(PIN);
    await element(by.id('pin-create-continue')).tap();

    await waitFor(element(by.text('Confirm your PIN'))).toBeVisible().withTimeout(15000);
    await typePin(PIN);

    await waitFor(element(by.id('biometric-enroll-skip'))).toBeVisible().withTimeout(30000);
  });

  it('declining biometrics enters the app', async () => {
    await element(by.id('biometric-enroll-skip')).tap();

    await waitForApp();
    await dismissNotificationRationale();
    // The seeded account already has a name: nothing to onboard.
    await expect(element(by.id('onboarding-first-name'))).not.toExist();
  });

  it('asks for the PIN after a restart, not for credentials', async () => {
    await restartAndWaitFor('pin-key-1');
    await dismissNotificationRationale();

    await expect(element(by.text('Enter App PIN'))).toBeVisible();
    // Biometrics were declined, so nothing prompts for them: the PIN is the lock.
    await expect(element(by.id('login-email'))).not.toExist();
  });

  it('refuses a wrong PIN and keeps the customer out', async () => {
    await typePin(wrongPin(PIN));

    await waitFor(element(by.textMatch(/attempt/i))).toBeVisible().withTimeout(20000);
    await expect(element(by.id('main-navigator'))).not.toExist();
  });

  it('opens the app with the right PIN', async () => {
    await waitForKeypad();
    await typePin(PIN);
    await waitForApp();
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
