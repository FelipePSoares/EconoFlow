import { isE2eLink, toPathSegments } from '../deepLinks';

/**
 * The app's side of `econoflow://` links.
 *
 * React Navigation's own prefix handling swallows the first path segment of an app link
 * (`econoflow://econoflow-start` parses the segment as the URL's host), so the app reads the
 * segments from the raw URL. These tests pin down exactly which URLs count as the app's, and
 * that nothing else does — a link a user could follow must not reach a test-only screen.
 */
describe('toPathSegments', () => {
  it('takes the first segment after the scheme as a path segment, not a host', () => {
    expect(toPathSegments('econoflow://econoflow-start')).toEqual(['econoflow-start']);
  });

  it('keeps the segments after the first one', () => {
    expect(toPathSegments('econoflow://e2e/open/login?next=main')).toEqual([
      'e2e',
      'open',
      'login',
    ]);
  });

  it('accepts the scheme with a single slash as well', () => {
    expect(toPathSegments('econoflow:/e2e/open')).toEqual(['e2e', 'open']);
  });

  it('drops a trailing slash and empty segments', () => {
    expect(toPathSegments('econoflow://e2e//open/')).toEqual(['e2e', 'open']);
  });

  it('is empty for a missing URL', () => {
    expect(toPathSegments(undefined)).toEqual([]);
    expect(toPathSegments(null)).toEqual([]);
    expect(toPathSegments('')).toEqual([]);
  });

  it('is empty for a URL of another scheme', () => {
    expect(toPathSegments('https://econoflow.pt/e2e/open')).toEqual([]);
    expect(toPathSegments('econoflowx://e2e/open')).toEqual([]);
  });
});

describe('isE2eLink', () => {
  it('recognises the automation sentinel', () => {
    expect(isE2eLink('econoflow://e2e/open')).toBe(true);
    expect(isE2eLink('econoflow://e2e')).toBe(true);
  });

  it('does not recognise anything without it', () => {
    expect(isE2eLink('econoflow://econoflow-start')).toBe(false);
    expect(isE2eLink('econoflow://open/e2e')).toBe(false);
    expect(isE2eLink('econoflow://e2eX/open')).toBe(false);
    expect(isE2eLink(undefined)).toBe(false);
    expect(isE2eLink('https://econoflow.pt/e2e/open')).toBe(false);
  });
});
