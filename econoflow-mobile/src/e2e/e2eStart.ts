import { isE2eLink, toPathSegments } from '../utils/deepLinks';

/**
 * `econoflow://e2e/open` — the entry point the integration suite (`e2e/`) uses.
 *
 * The suite runs against a real device, and the app decides on launch what to show from
 * what the device holds. "Start over from the Login screen with a session still stored"
 * is a state the product never shows, so it needs a way in that only automation opens.
 *
 * The link is handled **only in a debug build** (`__DEV__`), so a release build ignores it
 * entirely, and it names one screen: there is no way to reach any other place this way.
 */
export const E2E_START_URL = 'econoflow://e2e/open';

/** The screens the automation entry point may start the app on. */
export type E2eStartScreen = 'Login';

/** Whether the URL is the automation entry point. */
export function isE2eStartUrl(url?: string | null): boolean {
  if (!__DEV__ || !isE2eLink(url)) {
    return false;
  }

  const [, ...segments] = toPathSegments(url);
  return segments.length === 1 && segments[0] === 'open';
}

/**
 * The screen to show for the URL, or `null` when the URL does not ask for one.
 *
 * Callers use `null` for "no opinion": the app keeps deciding its screen from its stored
 * state, which is what every other launch does.
 */
export function startScreenFor(url?: string | null): E2eStartScreen | null {
  return isE2eStartUrl(url) ? 'Login' : null;
}
