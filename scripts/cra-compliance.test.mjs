#!/usr/bin/env node
/**
 * Regression tests for the CRA (Cyber Resilience Act) quick wins.
 *
 * Run with:  node --test scripts/cra-compliance.test.mjs
 *
 * The Cyber Resilience Act (Regulation (EU) 2024/2847) requires a published
 * means of reporting vulnerabilities (Annex I, Part II, point 2 — coordinated
 * vulnerability disclosure) and, from 11 September 2026, reporting of actively
 * exploited vulnerabilities within 24 hours. Both depend on artefacts that are
 * easy to delete or drift out of sync, so they are asserted here rather than
 * left to convention.
 *
 * These tests fail when an artefact is missing, when the disclosure contact
 * drifts between the two published documents, or when the SBOM pipeline loses
 * one of the component populations it has to cover.
 */

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');

const read = (relativePath) => readFileSync(resolve(repositoryRoot, relativePath), 'utf8');

/**
 * The RFC 9116 `security.txt` file. It must be served at
 * `/.well-known/security.txt` and is published by copying it into the Angular
 * build, which is why it lives under `src/`.
 */
const SECURITY_TXT_PATH = 'easyfinance.client/src/.well-known/security.txt';

/** The repository-level disclosure policy GitHub surfaces in its Security tab. */
const SECURITY_POLICY_PATH = 'SECURITY.md';

/** Art. 14 reporting runbook. */
const INCIDENT_RUNBOOK_PATH = 'docs/cra-incident-reporting.md';

/** Generates the CycloneDX SBOM for a .NET project. */
const SBOM_SCRIPT_PATH = 'scripts/generate-sbom.mjs';

// ── security.txt ─────────────────────────────────────────────────────────────

test('security.txt is published at the well-known location', () => {
  assert.ok(
    existsSync(resolve(repositoryRoot, SECURITY_TXT_PATH)),
    `${SECURITY_TXT_PATH} is missing; RFC 9116 places the disclosure channel at /.well-known/security.txt`,
  );
});

test('security.txt declares a contact and a security policy', () => {
  const securityTxt = read(SECURITY_TXT_PATH);

  // A contact field is required by RFC 9116 section 2.5.3, but the reason it is
  // asserted here is the CRA: without a reachable contact there is no
  // vulnerability-disclosure channel at all.
  assert.match(
    securityTxt,
    /^Contact:\s*\S+/m,
    'security.txt has no "Contact:" field, so researchers have no way to report a vulnerability',
  );

  assert.match(
    securityTxt,
    /^Policy:\s*https?:\/\/\S+/m,
    'security.txt has no absolute "Policy:" URL pointing at the disclosure policy',
  );
});

test('security.txt sets an expiry so a stale file cannot silently rot', () => {
  const securityTxt = read(SECURITY_TXT_PATH);
  const match = /^Expires:\s*(\S+)/m.exec(securityTxt);

  assert.ok(match, 'security.txt has no "Expires:" field; RFC 9116 requires consumers to treat the file as stale after a year');

  const expiry = new Date(match[1]);
  assert.ok(!Number.isNaN(expiry.getTime()), `security.txt "Expires:" value "${match[1]}" is not a valid date`);

  assert.ok(
    expiry.getTime() > Date.now(),
    `security.txt expired on ${match[1]}; a stale file tells researchers the channel is dead`,
  );
});

test('security.txt honours the 24-hour reporting window it advertises', () => {
  const securityTxt = read(SECURITY_TXT_PATH);

  // A published acknowledgement target that exceeds the CRA's 24-hour early
  // warning would contradict the obligation the runbook describes.
  const match = /^\s*the manufacturer acknowledges receipt within (\d+) hours/im.exec(
    securityTxt.replace(/\n\s*\n/g, '\n'),
  );

  if (!match) return; // The acknowledgement sentence is optional.

  assert.ok(
    Number(match[1]) <= 24,
    `security.txt promises acknowledgement within ${match[1]} hours, which is longer than the CRA 24-hour early-warning deadline`,
  );
});

// ── SECURITY.md ──────────────────────────────────────────────────────────────

test('SECURITY.md documents the disclosure policy and reporting window', () => {
  assert.ok(existsSync(resolve(repositoryRoot, SECURITY_POLICY_PATH)), `${SECURITY_POLICY_PATH} is missing`);

  const policy = read(SECURITY_POLICY_PATH);

  assert.match(policy, /cyber resilience act|\bCRA\b/i, 'SECURITY.md must name the CRA obligations it satisfies');
  assert.match(policy, /24 hours/i, 'SECURITY.md must state the 24-hour early-warning commitment for actively exploited vulnerabilities');
  assert.match(policy, /72 hours/i, 'SECURITY.md must state the 72-hour notification commitment');
  assert.match(policy, /support period/i, 'SECURITY.md must state the security-update support period');
});

test('SECURITY.md and security.txt agree on the reporting contact', () => {
  // Two published contact addresses that disagree is worse than one: a
  // researcher who reports to the unreachable one has not reported at all.
  const policyAddresses = [...read(SECURITY_POLICY_PATH).matchAll(/[\w.+-]+@econoflow\.pt/g)].map((m) => m[0].toLowerCase());
  const securityTxtAddresses = [...read(SECURITY_TXT_PATH).matchAll(/mailto:([^>\s]+)/g)].map((m) => m[1].toLowerCase());

  assert.ok(policyAddresses.length > 0, 'SECURITY.md does not publish an e-mail reporting address');
  assert.ok(securityTxtAddresses.length > 0, 'security.txt does not publish a mailto: contact');

  const shared = policyAddresses.filter((address) => securityTxtAddresses.includes(address));
  assert.ok(
    shared.length > 0,
    `SECURITY.md (${[...new Set(policyAddresses)].join(', ')}) and security.txt ` +
      `(${[...new Set(securityTxtAddresses)].join(', ')}) publish no common reporting address`,
  );
});

// ── Art. 14 runbook ──────────────────────────────────────────────────────────

test('the incident runbook carries every statutory deadline', () => {
  assert.ok(existsSync(resolve(repositoryRoot, INCIDENT_RUNBOOK_PATH)), `${INCIDENT_RUNBOOK_PATH} is missing`);

  const runbook = read(INCIDENT_RUNBOOK_PATH);

  assert.match(runbook, /\b24 hours?\b/i, 'runbook is missing the 24-hour early-warning deadline');
  assert.match(runbook, /\b72 hours?\b/i, 'runbook is missing the 72-hour notification deadline');
  assert.match(runbook, /\b14 days?\b/i, 'runbook is missing the 14-day final report for actively exploited vulnerabilities');
  assert.match(runbook, /Single Reporting Platform|\bSRP\b/, 'runbook must name the ENISA Single Reporting Platform');
  assert.match(runbook, /\bCSIRT\b/, 'runbook must name the CSIRT receiving the notification');
});

// ── SBOM pipeline ────────────────────────────────────────────────────────────

test('the SBOM generator documents every component population', () => {
  assert.ok(existsSync(resolve(repositoryRoot, SBOM_SCRIPT_PATH)), `${SBOM_SCRIPT_PATH} is missing`);

  const generator = read(SBOM_SCRIPT_PATH);

  // The five populations that must all reach the SBOM: an SBOM that silently
  // omits one of them gives false assurance during a 24-hour triage.
  for (const population of ['NuGet', 'npm', 'base image']) {
    assert.match(
      generator,
      new RegExp(population, 'i'),
      `the SBOM generator does not mention the ${population} population it has to cover`,
    );
  }
});

test('the release workflow publishes an SBOM artefact for the image it pushes', () => {
  // There is one release workflow now: it builds and pushes the application image AND
  // publishes the SBOM. The SBOM used to live in two workflows because the image and the
  // (now removed) FTP deployment were released by different files; keeping this assertion
  // on the single workflow is what stops that inventory from being lost in a merge.
  const path = '.github/workflows/Release.yml';
  const workflow = read(path);

  assert.match(
    workflow,
    /sbom/i,
    `${path} does not produce or publish an SBOM, so a release has no component inventory`,
  );

  assert.match(
    workflow,
    /docker\/build-push-action/,
    `${path} no longer builds and pushes the image, so the SBOM it publishes would describe nothing released`,
  );

  // A second publisher of the same image would reintroduce the split this consolidated.
  const publishers = readdirSync(resolve(repositoryRoot, '.github', 'workflows'))
    .filter(workflowFile => workflowFile.endsWith('.yml'))
    .filter(workflowFile => /docker\/build-push-action|buildx build/.test(
      read(`.github/workflows/${workflowFile}`),
    ));

  assert.deepEqual(
    publishers,
    ['Release.yml'],
    'exactly one workflow may build and push the application image',
  );
});

// ── IIS host configuration ───────────────────────────────────────────────────

test('web.config sets clickjacking protection', () => {
  // CodeQL (cs/web/missing-x-frame-options) flags the deployed IIS configuration when
  // it carries neither X-Frame-Options nor a CSP frame-ancestors directive. The SPA's
  // own CSP sets frame-ancestors, but that only covers responses the app itself writes:
  // anything IIS serves directly - error pages, static files, a redirect before the
  // request reaches the pipeline - would be framable. The header belongs here too.
  const webConfigPath = 'EasyFinance.Server/web.config';
  assert.ok(existsSync(resolve(repositoryRoot, webConfigPath)), `${webConfigPath} is missing`);

  const webConfig = read(webConfigPath);

  assert.match(
    webConfig,
    /<add\s+name="X-Frame-Options"\s+value="(DENY|SAMEORIGIN)"/i,
    'web.config does not set the X-Frame-Options header',
  );
});

test('CodeQL ignores build output so generated files are not scanned', () => {
  // The SDK copies web.config into bin/Release on every build. CodeQL analysed that
  // generated copy and raised cs/web/missing-x-frame-options against a path that bin/
  // gitignores and that no commit can fix - it is regenerated from the source
  // web.config. Scanning source only keeps the alert meaningful.
  const codeql = read('.github/workflows/codeql.yml');

  assert.match(codeql, /paths-ignore:/, 'codeql.yml does not exclude build output from analysis');
  for (const pattern of ['**/bin/**', '**/obj/**', '**/node_modules/**']) {
    assert.ok(
      codeql.includes(pattern),
      `codeql.yml paths-ignore is missing ${pattern}`,
    );
  }
});

test('the Docker build receives the repo-level MSBuild files', () => {
  // Directory.Build.targets carries the transitive vulnerability pins, and
  // Directory.Build.props carries TreatWarningsAsErrors. The Dockerfile copies build
  // inputs explicitly (there is no full-context COPY before restore), so any repo-level
  // MSBuild file that is not listed here is silently absent from the image build - and
  // the NuGet audit then fails the container restore with NU1903.
  const dockerfile = read('Dockerfile');

  for (const buildFile of ['Directory.Build.props', 'Directory.Build.targets', 'global.json']) {
    assert.match(
      dockerfile,
      new RegExp(`^\\s*COPY\\s+.*${buildFile.replace('.', '\\.')}`, 'm'),
      `The Dockerfile does not copy ${buildFile} into the build stage`,
    );
  }
});
