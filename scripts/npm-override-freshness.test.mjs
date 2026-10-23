#!/usr/bin/env node
/**
 * Fails when an `overrides` pin is no longer on the latest published release.
 *
 * The repository pins patched transitive dependencies in the `overrides` block of
 * `easyfinance.client/package.json` and `econoflow-mobile/package.json`. Exact versions
 * are used on purpose, so that `npm ci` reproduces the audited tree exactly - but an
 * exact pin goes stale silently: a later advisory can cover the pinned version, and the
 * audit gate only notices if someone happens to look.
 *
 * This test closes that gap. For every string pin in either project it asks the npm
 * registry for `dist-tags.latest` and fails when the pin is behind it. The fix is always
 * to upgrade the pin, never to allow-list the advisory.
 *
 * Scoped selectors (`undici@6`, `brace-expansion@1`) pin a *major line* on purpose,
 * because a newer major would break the requesting package. Those are checked against
 * the newest release inside that same major only.
 *
 * Network: needs registry.npmjs.org. Set SKIP_REGISTRY_CHECK=1 to skip (used for offline
 * work); CI never sets it.
 *
 * Usage:  node scripts/npm-override-freshness.test.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');

const PROJECTS = ['easyfinance.client', 'econoflow-mobile'];
const REGISTRY = 'https://registry.npmjs.org';

const skip = process.env.SKIP_REGISTRY_CHECK === '1';

/** Parses `name`, `name@1`, `@scope/name` and `@scope/name@0.8` into a selector. */
function parseSelector(selector) {
  const at = selector.lastIndexOf('@');
  if (at > 0) {
    return { name: selector.slice(0, at), line: selector.slice(at + 1) };
  }
  return { name: selector, line: null };
}

/** Collects every string pin (nested objects are handled recursively). */
function collectPins(overrides, prefix = '') {
  const pins = [];
  for (const [selector, value] of Object.entries(overrides ?? {})) {
    const path = prefix ? `${prefix} > ${selector}` : selector;
    if (typeof value === 'string') {
      pins.push({ selector: parseSelector(selector), version: value, path });
    } else if (value && typeof value === 'object') {
      pins.push(...collectPins(value, path));
    }
  }
  return pins;
}

/** Compares two semver-ish strings numerically, ignoring pre-release metadata. */
function compare(a, b) {
  const parse = (v) => v.split('-')[0].split('.').map(Number);
  const [aMajor, aMinor, aPatch] = parse(a);
  const [bMajor, bMinor, bPatch] = parse(b);
  return aMajor - bMajor || aMinor - bMinor || aPatch - bPatch;
}

const registryCache = new Map();

/**
 * Builds the registry path segment for a package name.
 *
 * The npm registry keeps the scope slash literal and percent-encodes the rest, so
 * `@angular/core` maps to `@angular%2Fcore`. Encoding the whole name and then undoing
 * one slash is wrong: `String.replace` with a string pattern only replaces the FIRST
 * occurrence, so any further slash stays encoded. Splitting on the separator and
 * encoding each segment avoids a partial replacement entirely.
 */
function encodePackageName(name) {
  if (!name.startsWith('@')) return encodeURIComponent(name);

  const [scope, ...rest] = name.slice(1).split('/');
  const encodedScope = encodeURIComponent(scope);
  if (!rest.length) return `@${encodedScope}`;

  return `@${encodedScope}%2F${rest.map((segment) => encodeURIComponent(segment)).join('%2F')}`;
}

async function fetchPackage(name) {
  if (registryCache.has(name)) return registryCache.get(name);
  const encoded = encodePackageName(name);

  const response = await fetch(`${REGISTRY}/${encoded}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  });
  if (!response.ok) throw new Error(`registry returned ${response.status} for ${name}`);

  const body = await response.json();
  registryCache.set(name, body);
  return body;
}

/**
 * The newest *stable* release, optionally restricted to a version line.
 * `line` is whatever followed the `@` in the selector: `"6"` or `"0.8"`.
 */
function newestStable(manifest, line) {
  const latest = manifest['dist-tags']?.latest;
  const versions = Object.keys(manifest.versions ?? {}).filter((v) => v.includes('-') === false);
  if (!versions.length) return latest;

  const relevant = line ? versions.filter((v) => v.startsWith(`${line}.`)) : versions;
  if (!relevant.length) return latest;

  return relevant.sort(compare).at(-1);
}

/** True when the `name@line` selector means "stay on this version line". */
function isVersionLineSelector(pin, manifest) {
  if (pin.selector.line === null) return false;
  const versions = Object.keys(manifest.versions ?? {});
  return versions.some((version) => version.startsWith(`${pin.selector.line}.`));
}

test('every override pin is on the latest published release', { skip }, async (t) => {
  for (const project of PROJECTS) {
    const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, project, 'package.json'), 'utf8'));
    const pins = collectPins(manifest.overrides);

    if (!pins.length) {
      await t.test(`${project}: no overrides to check`, () => {});
      continue;
    }

    for (const pin of pins) {
      await t.test(`${project}: ${pin.path}`, async () => {
        const manifestForPackage = await fetchPackage(pin.selector.name);
        const newest = newestStable(manifestForPackage, pin.selector.line);

        assert.ok(
          newest,
          `${pin.selector.name} has no published stable release to compare ${pin.version} against`,
        );

        assert.ok(
          compare(pin.version, newest) >= 0,
          `${project} pins ${pin.path} to ${pin.version}, but ${newest} is the latest release` +
            `${isVersionLineSelector(pin, manifestForPackage) ? ` in major ${pin.selector.line}` : ''}. ` +
            'Upgrade the pin - do not allow-list the advisory in docs/security-exceptions.md.',
        );
      });
    }
  }
});

// ── Registry URL construction ────────────────────────────────────────────────

test('registry paths keep every slash of a scoped package name', () => {
  // npm registry paths keep the scope slash literal and percent-encode the rest:
  // @angular/core -> @angular%2Fcore. Encoding the whole name and then undoing one
  // slash with String.replace only fixes the FIRST occurrence, so a name with more
  // than one slash would stay partially encoded and 404.
  assert.equal(encodePackageName('@angular/core'), '@angular%2Fcore');
  assert.equal(encodePackageName('@a/b'), '@a%2Fb');
  assert.equal(encodePackageName('@a/b/c'), '@a%2Fb%2Fc');
  assert.equal(encodePackageName('follow-redirects'), 'follow-redirects');
  assert.equal(encodePackageName('@scope/name with spaces'), '@scope%2Fname%20with%20spaces');
});
