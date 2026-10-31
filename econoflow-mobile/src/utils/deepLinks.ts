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
const APP_URL_REGEX = /^econoflow:\/{1,}([^/?#]+)(?:\/([^?#]*))?/;

/** The path segments of an app URL, with the part after `econoflow://` counted as one. */
export function toPathSegments(url?: string | null): string[] {
  if (!url) {
    return [];
  }

  const match = APP_URL_REGEX.exec(url);
  if (!match) {
    return [];
  }

  const rest = match[2] ? match[2].split('/').filter(Boolean) : [];
  return [match[1], ...rest];
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
