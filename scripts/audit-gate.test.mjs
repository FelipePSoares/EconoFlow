#!/usr/bin/env node
/**
 * Regression tests for `scripts/audit-gate.mjs` and for the lock files it audits.
 *
 * Run with:  node --test scripts/audit-gate.test.mjs
 *
 * The second group is the important one: `npm audit` only fails on advisories that
 * exist in the *lock file*, so a stale `package-lock.json` reintroduces a gate
 * failure even though `package.json` looks fine. These tests read the lock files
 * directly and assert that the patched releases are actually resolved, which is
 * exactly the guarantee the CI gate enforces.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');

/**
 * Advisories that must never be accepted, because a patched release exists and
 * every requesting range in the tree admits it. Each entry maps the vulnerable
 * package to the lowest patched version and the GHSA that forbids the old range.
 */
const MUST_BE_PATCHED = [
  {
    lockProject: 'easyfinance.client',
    packageName: 'proxy-addr',
    minimumPatchedVersion: '2.0.8',
    ghsa: 'GHSA-jqcg-44mw-7w3h',
  },
  {
    lockProject: 'easyfinance.client',
    packageName: 'source-map-js',
    minimumPatchedVersion: '1.2.2',
    ghsa: 'GHSA-68fv-2mgg-jv7q',
  },
  {
    lockProject: 'econoflow-mobile',
    packageName: 'compression',
    minimumPatchedVersion: '1.8.2',
    ghsa: 'GHSA-vc2v-76pw-4v95',
  },
  {
    lockProject: 'econoflow-mobile',
    packageName: 'shell-quote',
    minimumPatchedVersion: '1.11.0',
    ghsa: 'GHSA-pqg4-j6r4-53mv',
  },
  {
    lockProject: 'econoflow-mobile',
    packageName: 'source-map-js',
    minimumPatchedVersion: '1.2.2',
    ghsa: 'GHSA-68fv-2mgg-jv7q',
  },
];

function readLockFile(project) {
  return JSON.parse(readFileSync(resolve(repositoryRoot, project, 'package-lock.json'), 'utf8'));
}

/**
 * Collects every resolved version of `packageName` in the lock file. npm v3 lock
 * files keep the full installed tree under `packages`, keyed by install path, so
 * a package can legitimately appear more than once.
 */
function resolvedVersions(lock, packageName) {
  const versions = [];
  for (const [installPath, entry] of Object.entries(lock.packages ?? {})) {
    if (installPath === '') continue;
    const name = installPath.slice(installPath.lastIndexOf('node_modules/') + 'node_modules/'.length);
    if (name === packageName && entry.version) versions.push(entry.version);
  }
  return versions;
}

/** Compares two semver strings numerically, ignoring pre-release/build metadata. */
function compareVersions(left, right) {
  const parse = (value) => value.split('-')[0].split('.').map(Number);
  const [leftMajor, leftMinor, leftPatch] = parse(left);
  const [rightMajor, rightMinor, rightPatch] = parse(right);
  return leftMajor - rightMajor || leftMinor - rightMinor || leftPatch - rightPatch;
}

test('every patched advisory is resolved in the lock file', async (t) => {
  for (const requirement of MUST_BE_PATCHED) {
    await t.test(
      `${requirement.lockProject} resolves ${requirement.packageName} >= ${requirement.minimumPatchedVersion} (${requirement.ghsa})`,
      () => {
        const lock = readLockFile(requirement.lockProject);
        const versions = resolvedVersions(lock, requirement.packageName);

        assert.ok(
          versions.length > 0,
          `${requirement.packageName} is not in ${requirement.lockProject}/package-lock.json at all`,
        );

        for (const version of versions) {
          assert.ok(
            compareVersions(version, requirement.minimumPatchedVersion) >= 0,
            `${requirement.lockProject}/package-lock.json resolves ${requirement.packageName}@${version}, ` +
              `which is still affected by ${requirement.ghsa}; expected >= ${requirement.minimumPatchedVersion}`,
          );
        }
      },
    );
  }
});

test('the accepted-advisory allow-list stays small and justified', () => {
  const markdown = readFileSync(resolve(repositoryRoot, 'docs/security-exceptions.md'), 'utf8');
  const rows = markdown
    .split(/\r?\n/)
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 5 && /^GHSA-[0-9a-z-]+$/i.test(cells[1]));

  for (const cells of rows) {
    const [, ghsaId, severity, packages, reason] = cells;
    assert.ok(
      reason && reason.length > 40,
      `${ghsaId} needs a substantive rationale explaining why ${packages} cannot be patched`,
    );
    assert.match(
      severity,
      /^(low|moderate|high|critical)$/,
      `${ghsaId} has unrecognised severity "${severity}"`,
    );
  }
});
