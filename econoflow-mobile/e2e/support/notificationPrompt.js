import { by, element, expect } from 'detox';

const RATIONALE_DISMISS = 'NotificationsPermissionNotNow';
const RATIONALE_ASK = 'NotificationsPermissionAllow';

/**
 * Answers the post-login notification prompt if it is showing.
 *
 * The app asks for the notification permission once per account (`#1053`), on the first
 * screen after the biometric gate. The specs launch with the OS permission denied, so the
 * card is shown once and never again; dismissing it keeps it from covering the keypad or
 * the tab bar the next assertion needs to reach.
 *
 * A prompt that is not there is not an error — a second run of the suite has already
 * answered it — hence the `toExist` check instead of a wait.
 */
export async function dismissNotificationRationale() {
  if (await exists(RATIONALE_DISMISS)) {
    await element(by.id(RATIONALE_DISMISS)).tap();
  } else if (await exists(RATIONALE_ASK)) {
    await element(by.id(RATIONALE_ASK)).tap();
  }
}

/** `true` when the element is on screen; never throws. */
export async function exists(testID) {
  try {
    await expect(element(by.id(testID))).toExist();
    return true;
  } catch {
    return false;
  }
}

/** `true` when the element is visible; never throws. */
export async function isVisible(testID) {
  try {
    await expect(element(by.id(testID))).toBeVisible();
    return true;
  } catch {
    return false;
  }
}
