#!/usr/bin/env node
/**
 * Fails when `npm audit` reports a HIGH or CRITICAL advisory that is not listed in
 * `docs/security-exceptions.md`.
 *
 * The repository keeps a small, explicitly documented allow-list of advisories that
 * cannot be patched from inside this repository (the upstream project ships no fixed
 * release, or the only fixed release is a breaking/ESM-only major). Everything else
 * must be upgraded, so CI fails here instead of letting the advisory rot in the
 * lock file. See `docs/security-exceptions.md` for the rationale of every entry.
 *
 * Usage:
 *   node scripts/audit-gate.mjs easyfinance.client
 *   node scripts/audit-gate.mjs econoflow-mobile
 *   node scripts/audit-gate.mjs            # audits the current working directory
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const projectRoot = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
const exceptionsPath = resolve(repositoryRoot, 'docs/security-exceptions.md');

const FAIL_AT_OR_ABOVE = new Set(['high', 'critical']);

/**
 * Reads the `| GHSA | Severity | Packages |` rows out of the exceptions document.
 * The document is the single source of truth, so there is no second list to drift.
 */
function readExceptions() {
  let markdown;
  try {
    markdown = readFileSync(exceptionsPath, 'utf8');
  } catch {
    return new Map();
  }

  const allowed = new Map();
  for (const line of markdown.split(/\r?\n/)) {
    const cells = line.split('|').map((cell) => cell.trim());
    // A row looks like: | GHSA-id | high | pkg-a, pkg-b | extra rationale columns...
    if (cells.length < 5) continue;
    if (!/^GHSA-[0-9a-z-]+$/i.test(cells[1])) continue;

    const ghsaId = cells[1];
    const packages = cells[3]
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    allowed.set(ghsaId, { ghsaId, severity: cells[2], packages });
  }
  return allowed;
}

function runAudit() {
  // npm sets `npm_execpath` to its own JS entry point. Running that through the
  // current Node runtime avoids the Windows `npm.cmd` shim, which cannot be
  // spawned directly by `spawnSync` without a shell.
  const npmExecPath = process.env.npm_execpath;
  const result = npmExecPath
    ? spawnSync(process.execPath, [npmExecPath, 'audit', '--json'], {
        cwd: projectRoot,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      })
    : spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['audit', '--json'], {
        cwd: projectRoot,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        shell: process.platform === 'win32',
      });

  // `npm audit` exits non-zero whenever any advisory is found; that is not an error
  // for us, because the verdict comes from the JSON payload below.
  const stdout = result.stdout ?? '';
  if (!stdout.trim()) {
    console.error(
      `[audit-gate] npm audit produced no output (exit ${result.status}${result.error ? `, ${result.error.message}` : ''}).`,
    );
    console.error(result.stderr ?? '');
    process.exit(1);
  }

  try {
    return JSON.parse(stdout);
  } catch (error) {
    console.error('[audit-gate] Could not parse `npm audit --json` output.');
    console.error(error.message);
    console.error(stdout.slice(0, 4000));
    process.exit(1);
  }
}

const exceptions = readExceptions();
const report = runAudit();
const totals = report.metadata?.vulnerabilities ?? {};

const offenders = [];
for (const [packageName, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
  if (!FAIL_AT_OR_ABOVE.has(vulnerability.severity)) continue;
  if (vulnerability.via && vulnerability.via.some((entry) => typeof entry !== 'string') === false) {
    // Purely inherited from another package's advisory; the root entry is reported below.
    continue;
  }

  for (const via of vulnerability.via ?? []) {
    if (typeof via === 'string') continue;

    const ghsaMatch = /GHSA-[0-9a-z-]+/i.exec(via.url ?? '');
    const ghsaId = ghsaMatch ? ghsaMatch[0] : null;
    const exception = ghsaId ? exceptions.get(ghsaId) : undefined;

    if (exception && exception.packages.includes(packageName)) continue;

    offenders.push({
      packageName,
      severity: vulnerability.severity,
      ghsaId,
      title: via.title,
      range: via.range,
      url: via.url,
      direct: vulnerability.isDirect,
    });
  }
}

console.log(
  `[audit-gate] ${projectRoot}\n` +
    `  totals: critical=${totals.critical ?? 0} high=${totals.high ?? 0} ` +
    `moderate=${totals.moderate ?? 0} low=${totals.low ?? 0}`,
);

if (offenders.length === 0) {
  console.log('[audit-gate] No unexcepted high/critical advisories. OK');
  process.exit(0);
}

console.error(`\n[audit-gate] ${offenders.length} unexcepted high/critical advisor${offenders.length === 1 ? 'y' : 'ies'}:`);
for (const offender of offenders) {
  console.error(
    `  - ${offender.ghsaId ?? 'no-ghsa'} [${offender.severity}] ${offender.packageName}` +
      `${offender.direct ? ' (direct dependency)' : ''} range=${offender.range}`,
  );
  console.error(`      ${offender.title}`);
  console.error(`      ${offender.url}`);
}
console.error(
  '\n[audit-gate] Upgrade the dependency, or - only when the advisory is genuinely' +
    '\n  unfixable from this repository - add a row to docs/security-exceptions.md.',
);
process.exit(1);
