import { by, element, expect, waitFor } from 'detox';
import {
  PIN,
  REGISTRATION_PASSWORD,
  REGISTRATION_PROFILE,
  newAccountEmail,
} from '../support/accounts';
import { typePin, waitForApp } from '../support/cells';
import { dismissNotificationRationale } from '../support/notificationPrompt';
import { relaunchApp, restartAndWaitFor } from '../support/urls';

/**
 * Registration — the flow a customer goes through to create an account.
 *
 * Registration signs the customer in directly, and the app then runs the same post-login
 * sequence a returning customer goes through — the PIN, then the biometric offer — before
 * the onboarding that asks for a name and opens the new-project flow.
 *
 * This spec runs before `login.e2e.js` (filename order) and is the one that starts from the
 * Login screen: nothing has signed in on this device yet, which is exactly the state a
 * fresh install is in. Read together with `login.e2e.js`, it checks the order the customer
 * meets the screens for the first time.
 */
describe('Registration', () => {
  const email = newAccountEmail();

  beforeAll(async () => {
    await relaunchApp();
    await waitFor(element(by.id('login-submit'))).toBeVisible().withTimeout(45000);
  });

  it('starts on the Login screen, with no session to restore', async () => {
    await expect(element(by.id('main-navigator'))).not.toExist();
    await expect(element(by.id('pin-key-1'))).not.toExist();
  });

  it('refuses a registration whose password confirmation does not match', async () => {
    await element(by.id('login-register-link')).tap();
    await waitFor(element(by.id('register-submit'))).toBeVisible().withTimeout(15000);

    await element(by.id('register-email')).typeText(newAccountEmail());
    await element(by.id('register-password')).typeText(REGISTRATION_PASSWORD);
    await element(by.id('register-confirm-password')).typeText(`${REGISTRATION_PASSWORD}!`);
    await element(by.id('register-submit')).tap();

    // The form's own rule catches it: the message shows and nothing is sent.
    await waitFor(element(by.text('Passwords must match'))).toBeVisible().withTimeout(10000);
    await expect(element(by.id('register-submit'))).toBeVisible();
  });

  it('registers the account and lands on the PIN setup, not in the app', async () => {
    await element(by.id('register-email')).clearText();
    await element(by.id('register-email')).typeText(email);
    await element(by.id('register-confirm-password')).clearText();
    await element(by.id('register-confirm-password')).typeText(REGISTRATION_PASSWORD);
    await element(by.id('register-submit')).tap();

    // Registration signs the customer in, and a session without a PIN starts at the PIN
    // setup — the same step a password login gets.
    await waitFor(element(by.id('pin-key-1'))).toBeVisible().withTimeout(60000);
    await expect(element(by.id('main-navigator'))).not.toExist();
  });

  it('asks for the PIN to be confirmed before accepting it', async () => {
    await typePin(PIN);

    // Four digits do not leave the screen on their own: a PIN may be 4 to 6 digits, so only
    // the customer can say the one being entered is complete.
    await expect(element(by.id('pin-create-continue'))).toBeVisible();
    await element(by.id('pin-create-continue')).tap();

    await waitFor(element(by.text('Confirm your PIN'))).toBeVisible().withTimeout(15000);
    await typePin(PIN);

    await waitFor(element(by.id('biometric-enroll-skip'))).toBeVisible().withTimeout(30000);
  });

  it('offers biometrics after the PIN and enters the app when it is declined', async () => {
    await element(by.id('biometric-enroll-skip')).tap();

    // The PIN was set a moment ago, so declining the optional shortcut enters the app
    // instead of asking for the PIN again.
    await waitForApp();
    await dismissNotificationRationale();
  });

  it('onboards the new customer before opening the app', async () => {
    // A customer with no first name is onboarded — the screen a returning customer never
    // sees.
    await waitFor(element(by.id('onboarding-first-name'))).toBeVisible().withTimeout(45000);
    await element(by.id('onboarding-first-name')).typeText(REGISTRATION_PROFILE.firstName);
    await element(by.id('onboarding-last-name')).typeText(REGISTRATION_PROFILE.lastName);
    await element(by.id('onboarding-submit')).tap();

    await waitForApp();
    await dismissNotificationRationale();

    // Onboarding ends in the new-project flow: a brand new account has no project, and the
    // app asks for the first one instead of showing an empty overview.
    await waitFor(element(by.text('Create Project'))).toBeVisible().withTimeout(45000);

    // Leaving it keeps the app usable.
    await element(by.id('onboarding-skip-project')).tap();
    await waitForApp();
  });

  it('is still signed in after a restart, with the PIN as the way back in', async () => {
    await restartAndWaitFor('pin-key-1');
    await dismissNotificationRationale();
    await expect(element(by.id('login-email'))).not.toExist();

    await typePin(PIN);
    await waitForApp();

    // The name entered during onboarding is on the account now, so the next start opens
    // the app instead of onboarding again.
    await expect(element(by.id('onboarding-first-name'))).not.toExist();
  });
});
