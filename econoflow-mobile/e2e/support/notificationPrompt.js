import { by, element, waitFor } from 'detox';

const RATIONALE_DISMISS = 'NotificationsPermissionNotNow';
const RATIONALE_ASK = 'NotificationsPermissionAllow';

/**
 * How long to wait for the prompt, per button.
 *
 * The card is shown by the screen that is *already* up (it is mounted by `MainNavigator`,
 * not navigated to), so it lands a frame or two after the app does. An immediate check
 * sampled the tree before it arrived, decided "nothing to dismiss", and left the card over
 * the tab bar — `signOutThroughProfile` then waited for `tab-profile` behind it and timed out
 * on the Overview screen that was showing the whole time. So this waits, briefly.
 */
const PROMPT_TIMEOUT_MS = 5000;

/**
 * Answers the post-login notification prompt if it is showing.
 *
 * The app asks for the notification permission once per account (`#1053`), on the first
 * screen after the biometric gate. The specs launch with the OS permission denied, so the
 * card is shown once and never again; dismissing it keeps it from covering the keypad or
 * the tab bar the next assertion needs to reach.
 *
 * A prompt that is not there is not an error — a second run of the suite has already
 * answered it — hence the bounded wait instead of an assertion.
 */
export async function dismissNotificationRationale() {
  for (const id of [RATIONALE_DISMISS, RATIONALE_ASK]) {
    if (await appears(id, PROMPT_TIMEOUT_MS)) {
      await element(by.id(id)).tap();
      return true;
    }
  }
  return false;
}

/**
 * `true` when the element becomes visible within `timeout`; never throws.
 *
 * `waitFor` polls and `expect` samples once — anything that arrives after a screen is shown
 * needs the polling form.
 */
async function appears(testID, timeout) {
  try {
    await waitFor(element(by.id(testID))).toBeVisible().withTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}
