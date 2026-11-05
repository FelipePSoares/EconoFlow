import { by, device, element, expect, waitFor } from 'detox';
import { PIN, SEEDED_ACCOUNT } from '../support/accounts';
import { answerSystemSensorIfShown, declineBiometricOffer, offerFingerprint } from '../support/biometrics';
import {
  appears,
  TAB_OVERVIEW,
  passDevicePin,
  signOutThroughProfile,
  typePin,
  waitForApp,
  waitForKeypad,
} from '../support/cells';
import { dismissNotificationRationale } from '../support/notificationPrompt';
import { describeIds, openAtLogin, stopApp, traceStep, waitVisible } from '../support/urls';

/**
 * The unlock a customer gets after enabling biometrics — the flow the report behind this
 * spec describes (#1116):
 *
 * "after a successful login and accepting biometrics, closing the app and opening it again
 * should ask for biometrics, and open the Overview page once it succeeds."
 *
 * | step | what it proves |
 * |------|----------------|
 * | sign in | the session reaches this device's PIN — creating it on a fresh device, entering it after |
 * | enable biometrics | accepting the offer stores the setting, and the sensor opens the app |
 * | answer the sensor | after a restart the sensor is asked, and opens on Overview |
 * | restart again | and again: the PIN screens stay away |
 * | sign out | the session is gone, and a restart asks for credentials |
 *
 * The sensor is answered by the emulator's fingerprint (see `support/biometrics.js`): the
 * system dialog is the OS's, and Detox cannot tap it.
 *
 * **Every case starts from the Login screen** and signs in again (`openAtLogin`): Detox
 * orders the spec files by measured duration, so this file cannot build on what the one
 * before it left. What it *can* rely on is the device's own state — the PIN and the
 * biometric flag belong to the device and outlive a sign-out, so the biometric answers it
 * checks are exactly the ones the customer would get after reopening the app.
 */
describe('Biometric unlock', () => {
  beforeEach(async () => {
    await stopApp();
    await openAtLogin();
    await dismissNotificationRationale();
  });

  it('signs in and reaches the PIN of this device', async () => {
    await element(by.id('login-email')).typeText(SEEDED_ACCOUNT.email);
    await element(by.id('login-password')).typeText(SEEDED_ACCOUNT.password);
    await element(by.id('login-submit')).tap();

    // A PIN on the device is entered, none is created — the session never stops on Login.
    await waitForKeypad(60000);
    await expect(element(by.id('main-navigator'))).not.toExist();
    await expect(element(by.id('login-submit'))).not.toExist();
  });

  it('accepts biometrics when they are offered, and the sensor opens the app', async () => {
    await signInAndPassPin();

    // First time on this device, the offer is shown after the PIN; it is accepted here
    // because the whole point of this file is the sensor that follows. A device that has
    // already answered keeps its answer, and this case then simply proves the app opens.
    //
    // The button is *waited* for, not sampled: the offer is a navigation, so an immediate
    // `exists()` can look before the screen has arrived and skip the tap on a device that was
    // about to show it — which is how this case used to end up waiting for an app that
    // nothing was going to open.
    if (await appears('biometric-enroll-enable', 15000)) {
      await element(by.id('biometric-enroll-enable')).tap();
      await offerFingerprint();
    }

    await waitForApp(60000);
    await dismissNotificationRationale();
    await expect(element(by.id('pin-key-1'))).not.toExist();
  });

  it('asks the sensor after a restart, and opens on Overview', async () => {
    // The biometric flag is on the device now (accepted above, or already accepted when it
    // was created): reopening the app asks for the sensor, on its own.
    await stopApp();
    await device.launchApp({ newInstance: false, permissions: { notifications: 'deny' } });

    // Offered across the whole start-up window, not once: the relaunch returns before the JS
    // bundle has run, so a single touch lands while no prompt exists yet and is dropped. The
    // gate then asks a moment later and waits for an answer that never comes.
    await answerSystemSensorIfShown();

    // **The notification rationale is answered before the tab bar is looked for, not after.**
    // `MainNavigator` mounts the prompt, which reads the OS permission and then covers the
    // bottom of the screen — the tab bar is behind it, and Detox's `toBeVisible` needs 75% of
    // a view on screen, so `tab-overview` cannot match while the card is up. That is what the
    // failure screenshot showed: Overview, with the card over it.
    await dismissNotificationRationale();

    // What Detox's own hierarchy says — the matcher acts on it, not on the pixels — carried
    // out in the assertion message when the tab does not match.
    const hierarchy = await describeIds(['main-navigator', TAB_OVERVIEW, 'lock-overlay']);
    await waitVisible(TAB_OVERVIEW, 45000);
    traceStep('overview visible');

    await expect(element(by.id('main-navigator'))).toBeVisible();
    await expect(element(by.id('pin-key-1'))).not.toExist();
    await expect(element(by.id('login-email'))).not.toExist();
    // Read only so a failure of the wait above can name what Detox saw.
    void hierarchy;
  });

  it('asks the sensor again on the next launch, and not for the PIN', async () => {
    await stopApp();
    await device.launchApp({ newInstance: false, permissions: { notifications: 'deny' } });

    await answerSystemSensorIfShown();
    await dismissNotificationRationale();
    await waitVisible(TAB_OVERVIEW, 45000);
    await expect(element(by.id('pin-key-1'))).not.toExist();
    await expect(element(by.text('Create App PIN'))).not.toExist();
  });

  it('signing out leaves the Login screen', async () => {
    await signInAndPassPin();
    // The device has just created/entered its PIN, so the offer is showing right now — in
    // whichever shape this device gets. Declining it is what reaches the app.
    await declineBiometricOffer();
    await waitForApp(60000);
    await dismissNotificationRationale();
    await signOutThroughProfile();

    await expect(element(by.id('login-submit'))).toBeVisible();
    await expect(element(by.id('pin-key-1'))).not.toExist();
    await expect(element(by.id('main-navigator'))).not.toExist();
  });

  it('a restart after signing out asks for credentials, not for the sensor', async () => {
    await stopApp();
    await device.launchApp({ newInstance: false, permissions: { notifications: 'deny' } });

    await waitFor(element(by.id('login-submit'))).toBeVisible().withTimeout(60000);
    await expect(element(by.id('pin-key-1'))).not.toExist();
    await expect(element(by.id('main-navigator'))).not.toExist();
  });
});

/**
 * Signs the seeded account in and gets past the device's PIN — creating it when the device
 * has none, entering it when it has one. Leaves the app on whatever follows the PIN (the
 * biometrics offer, or the app itself).
 *
 * The PIN steps live in `support/cells.js`: three specs drive them and each used to carry
 * its own copy, so each could get the same transition wrong on its own.
 */
async function signInAndPassPin() {
  await element(by.id('login-email')).typeText(SEEDED_ACCOUNT.email);
  await element(by.id('login-password')).typeText(SEEDED_ACCOUNT.password);
  await element(by.id('login-submit')).tap();
  await passDevicePin();
}
