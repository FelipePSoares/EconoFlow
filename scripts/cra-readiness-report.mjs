#!/usr/bin/env node
/**
 * Non-blocking readiness report for the CRA Article 14 reporting capability.
 *
 * Run with:  node scripts/cra-readiness-report.mjs
 *
 * Why this is not part of `cra-compliance.test.mjs`:
 *
 * Every other CRA artefact is a file in the repository, so drift is a code defect and the
 * test suite should fail on it. The two items checked here are different: they are facts
 * about the world outside the repository - an ENISA SRP account that has been registered,
 * and a drill that has been run at some point in the last year. Neither can be established
 * by editing a file, and failing CI on them would block every unrelated change for as long
 * as the gap exists.
 *
 * So this prints a report and always exits 0 unless the runbook itself is unreadable. The
 * runbook's structure *is* asserted, in `cra-compliance.test.mjs`, where a failure is
 * actionable.
 *
 * Issue #1066, acceptance criteria "SRP access confirmed for both contacts" (warn while the
 * account does not exist) and "out-of-hours drill run once a year and timed".
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const RUNBOOK_PATH = resolve(repositoryRoot, 'docs', 'cra-incident-reporting.md');

const MARK = { ok: 'OK  ', warn: 'WARN', fail: 'FAIL' };

/** Collects one finding per readiness item, so the report reads as a checklist. */
const findings = [];

function check(name, { passed, detail }) {
  findings.push({ name, passed, detail });
}

let runbook;

try {
  runbook = readFileSync(RUNBOOK_PATH, 'utf8');
} catch {
  // The only hard failure: without the runbook there is nothing to assess.
  console.error(`${MARK.fail} docs/cra-incident-reporting.md could not be read`);
  process.exit(1);
}

/**
 * Returns the body of the first `## n.` section whose title contains `fragment`, or an
 * empty string. Kept deliberately forgiving here: the strict version lives in the test
 * suite, and this script should report what it can rather than throw.
 */
function section(markdown, fragment) {
  // `##` or `###`: the SRP access record and the drill record are subsections of section 6.
  const parts = markdown.split(/^#{2,3}\s+/m).slice(1);
  const match = parts.find((part) => part.split('\n', 1)[0].toLowerCase().includes(fragment.toLowerCase()));
  return match ?? '';
}

// ── SRP access ───────────────────────────────────────────────────────────────

const srpSection = section(runbook, 'SRP access');
const registered = /\|\s*Account registered\s*\|(.*?)\|/i.exec(srpSection);
const registeredValue = registered?.[1]?.trim() ?? '';

check('ENISA SRP account exists', {
  passed: /^\**\s*(yes|2026-|20\d\d-)/i.test(registeredValue),
  detail: registeredValue
    ? `the runbook says: "${registeredValue.replace(/\*\*/g, '')}"`
    : 'the runbook has no "Account registered" row',
});

const verified = /\|\s*Access last verified\s*\|(.*?)\|/i.exec(srpSection);
const verifiedValue = verified?.[1]?.trim() ?? '';
const verifiedDate = /\b(\d{4}-\d{2}-\d{2})\b/.exec(verifiedValue);
const verifiedAgeInDays = verifiedDate ? (Date.now() - new Date(verifiedDate[1]).getTime()) / 86_400_000 : Infinity;

check('SRP access verified within the last 12 months', {
  passed: verifiedAgeInDays <= 365,
  detail: verifiedDate
    ? `last verified ${verifiedDate[1]} (${Math.floor(verifiedAgeInDays)} days ago)`
    : `the runbook says: "${verifiedValue.replace(/\*\*/g, '')}"`,
});

// ── Drill ────────────────────────────────────────────────────────────────────

const drillSection = section(runbook, 'Drill');
const drillDates = [...drillSection.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)]
  .map((match) => new Date(match[1]))
  .filter((date) => !Number.isNaN(date.getTime()));

const mostRecentDrill = drillDates.length > 0
  ? new Date(Math.max(...drillDates.map((date) => date.getTime())))
  : null;
const drillAgeInDays = mostRecentDrill ? (Date.now() - mostRecentDrill.getTime()) / 86_400_000 : Infinity;

check('out-of-hours drill run within the last 12 months', {
  passed: drillAgeInDays <= 365,
  detail: mostRecentDrill
    ? `most recent drill ${mostRecentDrill.toISOString().slice(0, 10)} (${Math.floor(drillAgeInDays)} days ago)`
    : 'no drill has been recorded yet',
});

// ── Report ───────────────────────────────────────────────────────────────────

const warnings = findings.filter((finding) => !finding.passed);

console.log('');
console.log('CRA Article 14 readiness');
console.log('========================');
console.log('');

for (const finding of findings) {
  console.log(`${finding.passed ? MARK.ok : MARK.warn} ${finding.name}`);
  console.log(`     ${finding.detail}`);
}

console.log('');

if (warnings.length === 0) {
  console.log('No open readiness warnings.');
} else {
  console.log(`${warnings.length} open readiness warning(s). These do not fail the build, but`);
  console.log('every one of them is a gap between the runbook as written and the runbook as it');
  console.log('would behave on the night. Close them - do not silence them. Issue #1066.');
}

console.log('');

// Always 0: see the header comment. The absence of an SRP account is a known, tracked
// gap, not a build failure, and CI is not the place to discover it for the first time.
process.exit(0);
