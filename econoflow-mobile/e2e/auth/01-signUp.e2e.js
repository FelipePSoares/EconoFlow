import { by, element, expect, waitFor } from 'detox';
import {
  PIN,
  REGISTRATION_PASSWORD,
  REGISTRATION_PROFILE,
  SEEDED_ACCOUNT,
  newAccountEmail,
} from '../support/accounts';
import { exists, typePin, waitForApp, waitForKeypad } from '../support/cells';
import { dismissNotificationRationale } from '../support/notificationPrompt';
import { openAtLogin, stopApp } from '../support/urls';

/**
 * Registration — the flow a customer goes through to create an account.
 *
 * Registration signs the customer in directly, and the app then runs the same post-login
 * sequence a returning customer goes through — the PIN, then the biometric offer — before
 * the onboarding that asks for a name and opens the new-project flow.
 *
 * **Every case starts from the Login screen** (`openAtLogin`): Detox orders the spec files
 * by measured duration, so the state the previous case left is not something this file can
 * build on. The single fact it does rely on is the device's: a PIN, once created, stays —
 * so the create-the-PIN branch below runs on a fresh device and the enter-it branch after
 * that.
 */
describe('Registration', () => {
  const email = newAccountEmail();

  beforeEach(async () => {
    // A killed process, then the automation entry point: the Login screen, and nothing of
    // the previous case's session left behind.
    await stopApp();
    await openAtLogin();
    await dismissNotificationRationale();
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

  it('registers the account and lands on the PIN, not in the app', async () => {
    await element(by.id('login-register-link')).tap();
    await waitFor(element(by.id('register-submit'))).toBeVisible().withTimeout(15000);
    await element(by.id('register-email')).typeText(email);
    await element(by.id('register-password')).typeText(REGISTRATION_PASSWORD);
    await element(by.id('register-confirm-password')).typeText(REGISTRATION_PASSWORD);
    await element(by.id('register-submit')).tap();

    // Registration signs the customer in, and a session without a PIN starts at the PIN —
    // the same step a password login gets. On a device that already has one, the step is
    // entering it; either way the app itself is not reached before the PIN is.
    await waitForKeypad(60000);
    await expect(element(by.id('main-navigator'))).not.toExist();
    await expect(element(by.id('login-submit'))).not.toExist();
  });

  it('gets the new customer past the PIN, with or without creating one', async () => {
    // The registration above is the session this case continues (the Login screen would
    // mean it did not happen — the PIN screen has no way back to it).
    if (await exists('pin-create-continue')) {
      await typePin(PIN);
      await element(by.id('pin-create-continue')).tap();
      await waitFor(element(by.text('Confirm your PIN'))).toBeVisible().withTimeout(15000);
      await typePin(PIN);
      await waitFor(element(by.id('biometric-enroll-skip'))).toBeVisible().withTimeout(30000);
      await element(by.id('biometric-enroll-skip')).tap();
    } else {
      await typePin(PIN);
      // Biometrics offered here means the decline did not stick: take it, so nothing in
      // this file is left waiting on a system dialog.
      if (await exists('biometric-enroll-skip')) {
        await element(by.id('biometric-enroll-skip')).tap();
      }
    }

    // A customer with no first name is onboarded — the screen a returning customer never
    // sees. It opens after the PIN, before the app.
    await waitFor(element(by.id('onboarding-first-name'))).toBeVisible().withTimeout(60000);
    await element(by.id('onboarding-first-name')).typeText(REGISTRATION_PROFILE.firstName);
    await element(by.id('onboarding-last-name')).typeText(REGISTRATION_PROFILE.lastName);
    await element(by.id('onboarding-submit')).tap();

    await waitForApp(60000);
    await dismissNotificationRationale();

    // Onboarding ends in the new-project flow: a brand new account has no project, and the
    // app asks for the first one instead of showing an empty overview.
    await waitFor(element(by.text('Create Project'))).toBeVisible().withTimeout(45000);
    await element(by.id('onboarding-skip-project')).tap();
    await waitForApp();
  });

  it('is still signed in after a restart, with the PIN as the way back in', async () => {
    // The onboarding the previous case finished is on the account, so this one starts in
    // the app; if a case above did not get that far, a registered customer is signed in
    // with a PIN all the same, which is what is being checked here.
    await stopApp();
    await openAtLogin();
    await element(by.id('login-email')).typeText(SEEDED_ACCOUNT.email);
    await element(by.id('login-password')).typeText(SEEDED_ACCOUNT.password);
    await element(by.id('login-submit')).tap();
    await waitForKeypad(60000);

    // The seeded account signed in again: its session is stored, and a restart restores it.
    await stopApp();
    await device.launchApp({ newInstance: false, permissions: { notifications: 'deny' } });

    await waitFor(element(by.id('pin-key-1'))).toBeVisible().withTimeout(60000);
    await expect(element(by.id('login-email'))).not.toExist();

    await typePin(PIN);
    await waitForApp(60000);

    // The name entered during onboarding is on the account now, so the next start opens
    // the app instead of onboarding again.
    await expect(element(by.id('onboarding-first-name'))).not.toExist();
  });
});
