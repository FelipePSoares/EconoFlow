import { execSync } from 'node:child_process';
import { by, element, waitFor } from 'detox';

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
 * `1` is the finger enrolled on the AVD (`Pixel_7_API_35`). **A fingerprint has to be enrolled
 * for any of this to work** — `adb -e emu finger touch 1` only simulates a touch, it does not
 * create an enrolment. With nothing enrolled the app answers `isEnrolledAsync()` false, shows
 * its "nothing to offer" shape, and the sensor is never asked at all; enroll one finger in the
 * emulator's own Settings → Security → Fingerprint (see `e2e/ENVIRONMENT.md`).
 *
 * The command returns once the emulator has delivered the touch; the dialog then closes and
 * the app carries on by itself.
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
 * Answers the **system** sensor prompt if one is in front, so a spec that is not about
 * biometrics can get past it.
 *
 * Once a fingerprint is enrolled, a customer who turned biometrics on opens the app on
 * `BiometricGate`, which asks the sensor straight away. The dialog belongs to the OS: Detox
 * cannot see or tap it, and while it is up the app's window has no focus, so every later
 * `waitFor` fails with `has-window-focus=false` — a message that reads like a broken app and
 * is not one.
 *
 * The prompt is answered by the emulator's finger, which is what a customer would do. A spec
 * that is not about biometrics must call this after any restart, so it never depends on
 * whether the device happens to have a finger enrolled and biometrics enabled.
 */
export async function answerSystemSensorIfShown() {
  // There is no way to ask Detox "is the system dialog up?" — it is outside the app's view
  // tree. Offering the touch is harmless when no prompt is open (the emulator drops it), so
  // this is unconditional.
  //
  // **It has to be offered across the start-up window, but no more than once per prompt.**
  // A relaunch returns before the JS bundle has run, so a touch sent immediately lands while
  // no prompt exists yet and is discarded; the gate then asks for the sensor a moment later
  // and waits. Offering again after a pause covers that. The touches are spread out because
  // an extra touch arriving while a prompt is open is not free: the sensor delivers it to the
  // dialog that is already there.
  for (let attempt = 0; attempt < 3; attempt++) {
    await offerFingerprint();
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
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
 *
 * **The look is a short wait, not an instant check.** The offer is a *navigation*: the PIN
 * screen is replaced by this one a moment after the keypad accepts the PIN, so an immediate
 * `expect(...).toExist()` samples the tree before the new screen is mounted, sees nothing,
 * and reports "nothing to decline" while the offer is on its way. The spec then waits for
 * the app and times out on a screen that was showing the whole time — exactly how
 * `02-login` › "getting past the PIN opens the app when the PIN is the one the device has"
 * failed. The wait is bounded and still returns `false` for a device that has no offer.
 */
export async function declineBiometricOffer(timeout = OFFER_TIMEOUT_MS) {
  const id = await firstThatAppears(CANNOT_OFFER_IDS, timeout);
  if (!id) return false;
  await element(by.id(id)).tap();
  return true;
}

/** How long to wait for the offer to appear before deciding there is none. */
const OFFER_TIMEOUT_MS = 15000;

/** The ids that end the biometric offer without enabling it, in the order they are tried. */
const CANNOT_OFFER_IDS = ['biometric-enroll-skip', 'biometric-enroll-cannot-offer'];

/**
 * The first id that becomes visible within `timeout`, or `null`.
 *
 * `waitFor` polls; `expect` samples once. Polling each id in turn would spend the whole
 * timeout on the first one, so the wait is split between them.
 */
async function firstThatAppears(ids, timeout) {
  const perId = Math.ceil(timeout / ids.length);
  for (const id of ids) {
    try {
      await waitFor(element(by.id(id))).toBeVisible().withTimeout(perId);
      return id;
    } catch {
      // Not this shape; try the next one.
    }
  }
  return null;
}
