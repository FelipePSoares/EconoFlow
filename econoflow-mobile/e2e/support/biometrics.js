import { execSync } from 'node:child_process';
import { by, element, expect } from 'detox';

/**
 * Answers the app's biometric prompt from the host.
 *
 * With biometrics on, the app asks the system sensor as soon as it is in front, and that
 * dialog belongs to the OS — Detox cannot tap it, and the app cannot be driven past it any
 * other way. The Android emulator accepts a fingerprint over its own console, which is the
 * one thing an integration test *can* do:
 *
 *   adb -e emu finger touch 1
 *
 * `1` is the finger enrolled on the AVD (`Pixel_7_API_35`, see `setup.md`). The command
 * returns once the emulator has delivered the touch; the dialog then closes and the app
 * carries on by itself.
 *
 * It runs on the **host**, not on the device: Detox 20 exposes no host-shell API (`exec` and
 * `device.exec` do not exist in this version — biometrics are covered on iOS only, through
 * `matchFinger`), so the command is executed with Node's own `execSync`. `adb` is the same
 * binary the Detox session drives, so `-e` reaches the emulator under test.
 */
export const EMULATOR_FINGERPRINT_ID = 1;

/**
 * Offers a fingerprint, whether or not the dialog is up yet.
 *
 * A restart takes as long as it takes, so a spec cannot know the moment the prompt opens;
 * it offers the touch and then waits for what the app shows next. The emulator accepts the
 * touch at any time — a spec that offers it too early simply offers it again.
 */
export async function offerFingerprint() {
  execSync(`adb -e emu finger touch ${EMULATOR_FINGERPRINT_ID}`, { stdio: 'inherit' });
}

/**
 * Declines the biometric offer wherever the app is showing it, and leaves the customer on
 * whatever follows the PIN.
 *
 * The offer has two shapes and both mean "not enabled", so a spec never needs to know which
 * one its device gets:
 *
 * - the full offer — `biometric-enroll-enable` / `biometric-enroll-skip`;
 * - the "nothing to offer here" screen, shown when the device has no sensor or nothing is
 *   enrolled (`biometric-enroll-cannot-offer`). The emulator the suite runs on has no
 *   enrolled biometric, so this is the shape it actually gets.
 *
 * Neither is guaranteed to be on screen: the offer only follows a *created* PIN, and a
 * device that already had one (or already answered) goes straight on. So this looks before
 * it taps and returns `false` when there was nothing to decline, rather than waiting for a
 * screen that will never come.
 */
export async function declineBiometricOffer() {
  for (const id of CANNOT_OFFER_IDS) {
    if (await elementExists(id)) {
      await element(by.id(id)).tap();
      return true;
    }
  }
  return false;
}

/** The ids that end the biometric offer without enabling it, in the order they are tried. */
const CANNOT_OFFER_IDS = ['biometric-enroll-skip', 'biometric-enroll-cannot-offer'];

/** `true` when the element exists right now; never throws. */
async function elementExists(testID) {
  try {
    await expect(element(by.id(testID))).toExist();
    return true;
  } catch {
    return false;
  }
}
