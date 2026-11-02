/**
 * The app's own `econoflow://` links, read from the raw URL.
 *
 * React Navigation's prefix handling takes the segment after `econoflow://` for the URL's
 * host, which is right for ordinary links (`econoflow://chat?user=jane`) but makes the app's
 * own links ambiguous: `econoflow://econoflow-start` does not match the bare `econoflow://`
 * prefix at all, and `econoflow://e2e/open` would discard `e2e` as the host. Screens and
 * handlers that need the first segment therefore read it here.
 *
 * Only the app's scheme is accepted, so an `https://` link — the only form a user can follow
 * from outside the app — never reaches this parser.
 */

/**
 * A whole app link: the exact scheme, one or more segments, nothing after the last one.
 *
 * **Strict on purpose, and not only about the scheme.** `Linking` does not only report links
 * the customer opened: on Android the keyboard's "Open with" reports the text being typed, and
 * on the login form — an address keyboard — a typed address such as
 * `econoflow: //e2e/open@example.com` parses as a `econoflow://` link whose path is
 * `e2e/open@example.com`. Acting on it fired the automation entry point and signed the
 * customer out of the PIN screen they had just reached (#1116).
 *
 * So a string is a link only when it is *exactly* one: no space anywhere, no `@` in a
 * segment, and nothing after the path but a query or a fragment. Empty path segments are
 * dropped, so a trailing or doubled slash still reads as the link it is. Every link the app
 * handles fits this shape.
 */
const APP_URL_REGEX = /^econoflow:\/{1,}([^/?#@\s]+(?:\/[^/?#@\s]*)*)(?:[?#][^@\s]*)?$/;

/** Paths deeper than this belong to a link format the app does not handle. */
const MAX_SEGMENTS = 3;

/** The path segments of an app URL, with the part after `econoflow://` counted as one. */
export function toPathSegments(url?: string | null): string[] {
  if (!url) {
    return [];
  }

  const match = APP_URL_REGEX.exec(url.trim());
  if (!match) {
    return [];
  }

  const path = match[1].split('/').filter(Boolean);
  return path.length <= MAX_SEGMENTS ? path : [];
}

/**
 * Whether the URL is the automation entry point the integration suite (`e2e/`) opens.
 *
 * The segment is a reserved sentinel: nothing in the product links to it, and a handler
 * that acts on it only exists in a debug build.
 */
export function isE2eLink(url?: string | null): boolean {
  return toPathSegments(url)[0] === 'e2e';
}
