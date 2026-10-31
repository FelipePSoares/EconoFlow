import { isE2eStartUrl, startScreenFor } from '../../e2e/e2eStart';

/**
 * The screen the automation entry point (`econoflow://e2e/open`) starts the app on.
 *
 * The integration suite (`e2e/`) needs to start from the Login screen even when the device
 * still holds a session — that is the only way to check "sign in again" after "sign out",
 * because signing out ends on Login while the app restarting must reach the same place from
 * a device that has been used before.
 */
describe('e2eStart', () => {
  it('recognises only its own link', () => {
    expect(isE2eStartUrl('econoflow://e2e/open')).toBe(true);
    expect(isE2eStartUrl('econoflow://econoflow-start')).toBe(false);
    expect(isE2eStartUrl('econoflow://e2e')).toBe(false);
    expect(isE2eStartUrl(undefined)).toBe(false);
  });

  it('starts on the Login screen for its own link', () => {
    expect(startScreenFor('econoflow://e2e/open')).toBe('Login');
  });

  it('has no opinion about any other URL', () => {
    expect(startScreenFor('econoflow://econoflow-start')).toBe(null);
    expect(startScreenFor(undefined)).toBe(null);
  });
});
