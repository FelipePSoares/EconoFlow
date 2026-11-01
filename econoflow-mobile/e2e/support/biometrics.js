import { execSync } from 'node:child_process';

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
