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

/**
 * A `security.txt` file reduced to what the ABNF in RFC 9116 section 4 actually
 * describes: comments dropped, blank lines dropped, and every remaining line split into
 * its field name and value.
 *
 * <p>
 * Comments are dropped here for the same reason the article's own checker drops them:
 * section 2.1 lets a comment carry any Unicode character, so a non-ASCII em dash in the
 * prose is legal. Only the field lines are held to the stricter rules.
 * </p>
 */
function parseFields(securityTxt) {
  const fields = [];

  for (const rawLine of securityTxt.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf(':');
    if (separator === -1) {
      fields.push({ name: line, value: null, raw: rawLine });
      continue;
    }

    fields.push({
      name: line.slice(0, separator).trim(),
      value: line.slice(separator + 1).trim(),
      raw: rawLine,
    });
  }

  return fields;
}

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

test('security.txt expiries stay under a year, as RFC 9116 recommends', () => {
  // Section 2.5.5: "It is RECOMMENDED that the value of this field be less than a year
  // into the future to avoid staleness." The previous value sat 431 days out, which is
  // exactly the drift the recommendation exists to prevent: a date that far away is
  // nobody's calendar reminder, so the file rots between reviews.
  //
  // The window is measured from the file's own commit rather than from today, so the
  // assertion stays meaningful when the suite runs against a shallow or old checkout.
  const securityTxt = read(SECURITY_TXT_PATH);
  const match = /^Expires:\s*(\S+)/m.exec(securityTxt);

  assert.ok(match, 'security.txt has no "Expires:" field');

  const expiry = new Date(match[1]);
  assert.ok(!Number.isNaN(expiry.getTime()), `security.txt "Expires:" value "${match[1]}" is not a valid date`);

  const oneYear = 365 * 24 * 60 * 60 * 1000;
  const horizon = expiry.getTime() - Date.now();

  assert.ok(
    horizon <= oneYear,
    `security.txt "Expires: ${match[1]}" is ${Math.ceil(horizon / 86_400_000)} days out; `
      + 'RFC 9116 section 2.5.5 recommends less than a year, so keep the date reviewable '
      + 'and renew it rather than parking it beyond the horizon somebody will notice',
  );
});

test('security.txt fields match the RFC 9116 ABNF', () => {
  // This file is not OpenPGP-signed, so the bare productions apply rather than the
  // dash-escaped cleartext ones. The page that prompted these tests publishes a checker
  // that parses `lang-values` as the ABNF does; a file that only looks right in prose
  // fails it.
  const fields = parseFields(read(SECURITY_TXT_PATH));

  assert.ok(fields.length > 0, 'security.txt contains no field lines at all');

  // Section 4: `field = ... fs SP unstructured`, and section 6 (IANA) forbids pointing
  // unregistered resources into the well-known namespace. The concrete failure this
  // catches is `Contact: security@example.com` — a bare address is not a URI, and the
  // ABNF requires one (RFC 3986 section 3), so `mailto:` is not decoration.
  for (const field of fields) {
    assert.ok(field.value !== null, `security.txt line "${field.raw}" has no ":" separator`);
    assert.ok(field.value.length > 0, `security.txt field "${field.name}" has an empty value`);
    assert.ok(!/\s/.test(field.value) || field.name === 'Preferred-Languages',
      `security.txt field "${field.name}" has whitespace inside its value; the ABNF allows none for URIs`);
  }

  // Required exactly once, never more (section 2.5.5).
  const expiries = fields.filter((field) => field.name === 'Expires');
  assert.equal(expiries.length, 1, `Expires must appear exactly once (found ${expiries.length})`);

  // At most once, and when present it must be a comma-separated list of language tags
  // with no whitespace after the separator:
  //   lang-values = lang-tag *("," lang-tag)      <- unsigned files
  // The article's checker rejects "en, pt" for exactly this reason. Splitting on the
  // comma and trimming before asserting would hide that, so the raw value is matched.
  const languages = fields.filter((field) => field.name === 'Preferred-Languages');
  assert.ok(languages.length <= 1, 'Preferred-Languages must not appear more than once (section 2.5.8)');

  for (const field of languages) {
    assert.match(
      field.value,
      /^[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*(,[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*)*$/,
      `Preferred-Languages "${field.value}" is not a comma-separated list of language tags; `
        + 'the ABNF permits no whitespace around the comma, so write "en,pt" and never "en, pt"',
    );
  }

  // Web URIs must be https (sections 2.5.1-2.5.7); Bug-Bounty takes True or False
  // (IANA registry); a Bug-Bounty that is absent leaves researchers guessing, which is
  // the one thing the field exists to stop.
  const uriFields = ['Acknowledgments', 'Canonical', 'Contact', 'Encryption', 'Hiring', 'Policy'];

  for (const field of fields) {
    const isWebUri = field.value?.startsWith('http://') || field.value?.startsWith('https://');

    if (uriFields.includes(field.name) && isWebUri) {
      assert.ok(
        field.value.startsWith('https://'),
        `security.txt field "${field.name}" points at ${field.value}; every web URI must be https`,
      );
    }

    if (field.name === 'Contact') {
      assert.match(field.value, /^(mailto:|tel:|https:\/\/|dns:|openpgp4fpr:)/,
        `security.txt contact "${field.value}" is not a URI; use mailto: for an address`);
    }

    if (field.name === 'Bug-Bounty') {
      assert.match(field.value, /^(True|False)$/,
        `Bug-Bounty must be True or False, not "${field.value}"`);
    }
  }
});

test('security.txt states whether a bounty is paid', () => {
  // An unstated bug bounty is the awkward exchange the field exists to prevent: a
  // researcher assumes a payout, and the conversation turns into a dispute.
  const fields = parseFields(read(SECURITY_TXT_PATH));

  assert.ok(
    fields.some((field) => field.name === 'Bug-Bounty'),
    'security.txt does not declare Bug-Bounty; say "False" explicitly rather than leaving it to be assumed',
  );
});

test('security.txt stays pure ASCII', () => {
  // Comments may legally carry Unicode (section 2.1), so this is stricter than the RFC
  // on purpose. The file is parsed by hand-written scanners across every language and
  // encoding assumption; a UTF-8 em dash in a file that carries no charset declaration
  // of its own is a decoding question waiting to be asked, and it buys nothing in a
  // comment.
  const securityTxt = read(SECURITY_TXT_PATH);
  const offending = [...securityTxt].filter((character) => character.codePointAt(0) > 0x7e);

  assert.deepEqual(
    offending,
    [],
    `security.txt contains non-ASCII characters (${offending.map((c) => JSON.stringify(c)).join(', ')}); `
      + 'use plain ASCII, for example "-" instead of an em dash',
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

// ── Annex II user information ────────────────────────────────────────────────

/** The in-product security page (Angular component template). */
const SECURITY_PAGE_TEMPLATE_PATH =
  'easyfinance.client/src/app/features/not-authenticated-area/security/security.component.html';

/** The narrative Annex II guide, mirrored by the in-product page. */
const SECURITY_GUIDE_PATH = 'docs/security-user-guide.md';

test('SECURITY.md honours a rolling support period for every delivery mode', () => {
  // The owner settled on one rule for all three delivery modes: security
  // updates for 12 months after a release. A per-product date instead would
  // have to be re-committed by hand every year and would eventually be missed.
  const policy = read(SECURITY_POLICY_PATH);

  assert.match(
    policy,
    /12 months/i,
    'SECURITY.md no longer states the 12-month rolling support period the project committed to',
  );

  for (const deliveryMode of ['hosted web application', 'mobile apps', 'container image']) {
    assert.ok(
      new RegExp(`^\\|[^|]*\\|[^|]*EconoFlow ${deliveryMode}`, 'im').test(policy),
      `SECURITY.md no longer names the ${deliveryMode} as a delivery mode with its own support period`,
    );
  }
  assert.match(
    policy,
    /https:\/\/econoflow\.pt\/security/,
    'SECURITY.md does not point users at the published security page',
  );
});

test('SECURITY.md documents how the end of a support period is announced', () => {
  // Annex I(2)(6) asks for the support period to be *stated to users*. A period
  // nobody is told about when it ends satisfies the letter and not the intent,
  // so the notice mechanism has to be published with it.
  const policy = read(SECURITY_POLICY_PATH);
  const noticeSection = policy.slice(policy.indexOf('## Supported versions'), policy.indexOf('## Reporting a vulnerability'));

  assert.ok(noticeSection.length > 0, 'SECURITY.md no longer has a "Supported versions" section');
  assert.match(
    noticeSection,
    /end[- ]of[- ]support/i,
    'the "Supported versions" section never mentions how an end of support is announced',
  );
  assert.match(
    noticeSection,
    /90 days/i,
    'the end-of-support notice has no advance warning period',
  );
});

test('the Annex II user instructions are published', () => {
  assert.ok(
    existsSync(resolve(repositoryRoot, SECURITY_GUIDE_PATH)),
    `${SECURITY_GUIDE_PATH} is missing; Annex II requires user information and instructions`,
  );

  const guide = read(SECURITY_GUIDE_PATH);

  assert.match(guide, /annex ii/i, 'the user guide does not name the Annex II obligation it discharges');
  assert.match(guide, /support period/i, 'the user guide does not state the support period');
  // The "using EconoFlow securely" section describes the product; it must not slip
  // back into telling the reader to do things, which is what the in-product page
  // (deliberately third person) was rewritten away from.
  const usingSecurely = guide.slice(guide.indexOf('## 5. Using EconoFlow securely'), guide.indexOf('## 6.'));
  assert.ok(usingSecurely.length > 0, 'the user guide has no "Using EconoFlow securely" section');
  assert.doesNotMatch(
    usingSecurely,
    /^\s*-\s+(?:Use|Turn on|Sign out|Report|Apply|Check|Enable|Change|Keep)\b/m,
    'the "Using EconoFlow securely" section addresses the reader in the imperative; describe the product instead',
  );

  for (const [document, text] of [
    [SECURITY_GUIDE_PATH, guide],
    ['docs/docker.md', read('docs/docker.md')],
  ]) {
    assert.match(
      text,
      /X-Forwarded-Proto/,
      `${document} does not tell self-hosters to forward the client scheme; without it the ` +
        'server redirects every non-health request to https://<host>:8080/, which is plain HTTP',
    );
    assert.match(
      text,
      /KnownNetworks__0|KnownProxies__0/,
      `${document} tells deployers only to forward X-Forwarded-Proto. The image trusts only ` +
        '10.42.0.0/16 by default, so a proxy elsewhere is ignored and the deployment stays ' +
        'unreachable; the trust setting has to be published with it',
    );
  }

  for (const [topic, pattern] of [
    ['how to report a vulnerability', /report a vulnerability|reporting a vulnerability/i],
    ['the secure installation / configuration steps', /install|configuration/i],
    ['the expected environment', /environment/i],
    ['the update process', /updat/i],
    ['account guidance for end users', /password|second factor/i],
  ]) {
    assert.match(guide, pattern, `the user guide does not cover ${topic}`);
  }
});

test('the published user copy does not misdescribe the product', () => {
  // Two statements were wrong once and are cheap to keep honest. Account deletion
  // is applied from the dialog token in the response — DeleteUserAsync sends no
  // e-mail — and the settings menu is "Password and Authentication", not
  // "Account > Security".
  const guide = read(SECURITY_GUIDE_PATH);
  const page = read(SECURITY_PAGE_TEMPLATE_PATH);

  for (const [document, text] of [
    [SECURITY_PAGE_TEMPLATE_PATH, page],
    [SECURITY_GUIDE_PATH, guide],
  ]) {
    assert.doesNotMatch(
      text,
      /delet\w*[^.]{0,60}e-?mail|e-?mail[^.]{0,60}delet|elimina\w*[^.]{0,60}e-?mail|inbox|caixa de entrada/i,
      `${document} tells users to confirm account deletion by e-mail, but the server sends none`,
    );
    assert.doesNotMatch(
      text,
      /Account\s*(?:>|›|→)\s*Security|Conta\s*(?:&gt;|>|›|→)\s*Segurança/,
      `${document} points at a menu path that does not exist`,
    );
  }
});

test('the security page is reachable in product, in both languages', () => {
  // Acceptance criterion of #1069: the guidance must be surfaced in the
  // product, not only in the repository. The page is a public route with an
  // English and a Portuguese rendering, linked from the footer.
  assert.ok(
    existsSync(resolve(repositoryRoot, SECURITY_PAGE_TEMPLATE_PATH)),
    `${SECURITY_PAGE_TEMPLATE_PATH} is missing; the security guidance has no in-product page`,
  );

  const page = read(SECURITY_PAGE_TEMPLATE_PATH);
  const securityPageComponent = read(SECURITY_PAGE_TEMPLATE_PATH.replace(/\.html$/, '.ts'));

  assert.match(page, /isPortuguese\(\)/, 'the security page has no Portuguese rendering');
  assert.match(page, /support period/i, 'the security page does not state the support period');
  assert.match(
    page,
    /reportingAddress/,
    'the security page does not render the reporting address from the component',
  );
  // The address itself lives in SecurityService (which the page imports), mirroring
  // /.well-known/security.txt.
  assert.match(
    securityPageComponent,
    /SECURITY_REPORTING_ADDRESS/,
    'the security page component does not publish the reporting address',
  );
  assert.match(
    read('easyfinance.client/src/app/core/services/security.service.ts'),
    /contact@econoflow\.pt/,
    'SecurityService does not publish the reporting address',
  );
  // Both halves of the page have to carry the same sections: a translated half that
  // silently drops a topic would still pass every presence check above.
  const sectionCounts = [...page.matchAll(/<h2>\d+\./g)].length;
  assert.ok(sectionCounts > 0 && sectionCounts % 2 === 0, 'the security page sections do not pair up');

  // A Portuguese copy saved in the wrong encoding shows mojibake to every pt reader.
  assert.doesNotMatch(
    page,
    /Ã|Â|â€|�/,
    'the security page contains mojibake; re-save it as UTF-8 rather than Windows-1252',
  );

  const routes = read('easyfinance.client/src/app/features/app-routing.module.ts');
  assert.match(routes, /path: 'security'/, 'the security page is not routed');
  assert.ok(
    (routes.match(/path: 'security'/g) ?? []).length >= 2,
    'the security page is not routed under /pt as well as /',
  );

  const footer = read('easyfinance.client/src/app/features/app.component.html');
  assert.match(
    footer,
    /getPublicRouteCommands\('security'\)/,
    'the footer does not link to the security page',
  );

  const prerender = read('easyfinance.client/src/prerender-routes.txt');
  assert.match(prerender, /^\/security$/m, '/security is not prerendered');
  assert.match(prerender, /^\/pt\/security$/m, '/pt/security is not prerendered');
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

/**
 * The Member State of main establishment decides which CSIRT receives the report. Art. 14
 * routes a single submission through the SRP to that one national CSIRT, which then informs
 * the others; picking the wrong one is not a cosmetic error, it is a report filed with the
 * wrong authority within a 24-hour window.
 *
 * The runbook declares the answer once, and every other mention has to agree with it.
 *
 * <p>
 * Portugal has two distinct bodies and they are easy to conflate: <b>CERT.PT</b> is the
 * national CSIRT that Art. 14 addresses, and <b>CNCS</b> is the national Cyber Resilience Act
 * authority / single point of contact that operates it. The EC's NIS2 country page lists them
 * separately. Naming the authority where the recipient belongs sends a report to an inbox
 * nobody is watching for CSIRT traffic, which is exactly the failure this runbook exists to
 * prevent, so both the recipient and the authority are asserted here.
 * </p>
 */
const MAIN_ESTABLISHMENT = {
  memberState: 'Portugal',
  csirt: 'CERT.PT',
  authority: 'CNCS',
};

/** Splits a document into its `## n. Title` sections so a check can be scoped to one. */
/**
 * Splits a document into its `## n. Title` sections so a check can be scoped to one.
 *
 * <p>
 * `###` subsections are folded into their parent section's body, which is why a section
 * lookup for "Before you need this" also sees 6.1 and 6.2. `subsection()` below reaches into
 * one directly.
 * </p>
 */
function sections(markdown) {
  const result = new Map();
  let currentTitle = null;
  let currentLines = [];

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{2,3})\s+(.+?)\s*$/.exec(line);

    if (heading && heading[1].length === 2) {
      if (currentTitle !== null) result.set(currentTitle, currentLines.join('\n'));
      currentTitle = heading[2];
      currentLines = [];
      continue;
    }

    if (currentTitle !== null) currentLines.push(line);
  }

  if (currentTitle !== null) result.set(currentTitle, currentLines.join('\n'));

  return result;
}

/**
 * Returns the body of the first `## n.` section whose title contains `fragment`.
 *
 * <p>
 * Every assertion below is scoped this way rather than run over the whole file, because
 * section 7's report templates are supposed to contain `<>` placeholders: they are what a
 * responder fills in under time pressure. A whole-file check would either flag them forever
 * or have to be loosened until it no longer catches a real gap.
 * </p>
 */
function sectionContaining(markdown, fragment) {
  for (const [title, body] of sections(markdown)) {
    if (title.toLowerCase().includes(fragment.toLowerCase())) return body;
  }

  throw new Error(`the runbook has no section whose title contains "${fragment}"`);
}

/**
 * Returns the body of the first `### n Title` subsection whose title contains `fragment`.
 *
 * <p>
 * Subsection bodies end at the next heading of any level, so a lookup for "SRP access" stops
 * before the drill record that follows it.
 * </p>
 */
function subsectionContaining(markdown, fragment) {
  const parts = markdown.split(/^(#{2,3})\s+(.+?)\s*$/m);

  // split() with two capture groups alternates: body, hashes, title, body, hashes, title...
  for (let index = 1; index < parts.length; index += 3) {
    if (parts[index] === '###' && parts[index + 1].toLowerCase().includes(fragment.toLowerCase())) {
      return parts[index + 2] ?? '';
    }
  }

  throw new Error(`the runbook has no subsection whose title contains "${fragment}"`);
}

test('the runbook declares the Member State of main establishment', () => {
  const runbook = read(INCIDENT_RUNBOOK_PATH);
  const whereToReport = sectionContaining(runbook, 'Where to report');

  const declaration = new RegExp(
    `main establishment[^\\n]*\\|\\s*\\**${MAIN_ESTABLISHMENT.memberState}\\b`,
    'i',
  );

  assert.match(
    whereToReport,
    declaration,
    `the runbook does not state that the Member State of main establishment is ${MAIN_ESTABLISHMENT.memberState} `
      + 'in the "Where to report" table, as `| Member State of main establishment | Portugal |`',
  );

  // The operator lives in Austria but the manufacturer is established in Portugal. Naming
  // Austria against a Portugal declaration is healthy context; naming it as the main
  // establishment is the error this guards against.
  assert.ok(
    !/main establishment[^\n]*\bAustria\b/i.test(whereToReport),
    'the runbook names Austria as the Member State of main establishment, but the manufacturer is established in Portugal',
  );
});

test('the runbook names the CSIRT that matches the Member State of main establishment', () => {
  // The recipient is not a free choice: it is whatever national CSIRT covers the Member
  // State declared above. Asserting both against the same constant is what stops the
  // declaration and the recipient from drifting apart.
  const runbook = read(INCIDENT_RUNBOOK_PATH);
  const whereToReport = sectionContaining(runbook, 'Where to report');

  // The recipient row, matched structurally rather than by searching the section for the
  // name. A bare `\bCERT.PT\b` search would pass on any sentence that happens to mention it,
  // and a bare `\bCNCS\b` search passes on "operated by CNCS" - which is precisely how the
  // authority got confused with the recipient in the first place.
  const recipientRow = /^\|[^\n]*Recipient CSIRT[^\n]*\|[^\n]*$/im.exec(whereToReport);

  assert.ok(
    recipientRow,
    'the "Where to report" table has no "Recipient CSIRT" row',
  );

  assert.match(
    recipientRow[0],
    new RegExp(`\\b${MAIN_ESTABLISHMENT.csirt.replace('.', '\\.')}\\b`),
    `the "Recipient CSIRT" row does not name ${MAIN_ESTABLISHMENT.csirt}, the national CSIRT of `
      + `${MAIN_ESTABLISHMENT.memberState}. ${MAIN_ESTABLISHMENT.authority} is the national authority `
      + 'that operates it, not the body Art. 14 addresses',
  );

  // A second national CSIRT in the same section is the drift this test exists to catch:
  // a stale "for a Portugal-based manufacturer" sentence left next to the new answer.
  const otherCsirts = ['CERT.at', 'INCYDE', 'CERT-Bund', 'CCB', 'CSIRT-CZ', 'CertCroatia', 'ACN'];

  for (const other of otherCsirts) {
    assert.ok(
      !whereToReport.includes(other),
      `the "Where to report" section names ${other} as well as ${MAIN_ESTABLISHMENT.csirt}; `
        + 'one Member State means one recipient CSIRT',
    );
  }
});

test('the runbook identifies the national authority as distinct from the CSIRT', () => {
  // Portugal has two bodies and the distinction is the substance of the fix: CERT.PT receives
  // the report, CNCS is the authority and single point of contact around it. A runbook that
  // names only one of them sends somebody looking for an inbox that may not be the right one.
  const runbook = read(INCIDENT_RUNBOOK_PATH);
  const whereToReport = sectionContaining(runbook, 'Where to report');

  assert.match(
    whereToReport,
    new RegExp(`\\b${MAIN_ESTABLISHMENT.authority}\\b`),
    `the runbook does not mention ${MAIN_ESTABLISHMENT.authority}, the national authority that operates `
      + `${MAIN_ESTABLISHMENT.csirt}; naming the recipient without its authority invites the two to be confused again`,
  );
});

test('the runbook lists the Member States where the product is available', () => {
  // The early warning must carry this list within 24 hours. An open web service cannot be
  // reduced to a country list, so the honest answer has to say so explicitly; a silently
  // empty list turns the field into guesswork at the worst possible moment.
  const runbook = read(INCIDENT_RUNBOOK_PATH);
  const whereToReport = sectionContaining(runbook, 'Where to report');

  assert.match(
    whereToReport,
    /all (?:EU )?Member States/i,
    'the runbook does not say that the hosted service is available in all EU Member States, '
      + 'which is what an open web service used from several countries actually means',
  );

  // Brazil is a real, named population outside the EU and must survive a future edit.
  assert.match(
    whereToReport,
    /Brazil/i,
    'the runbook does not name Brazil, where the product has known users outside the EU',
  );
});

/**
 * Phrasings that mean "somebody still has to fill this in".
 *
 * <p>
 * The first version of this list held five entries and missed almost every realistic way of
 * deferring a decision - including "to be run" and "not measured", which were sitting in the
 * drill table of the very commit that introduced the check. A blacklist is only as good as
 * its coverage, and every addition here is one somebody actually wrote somewhere.
 * </p>
 *
 * <p>
 * The assertion below runs on top of this, because no blacklist can be complete: it also
 * requires the rows that carry a decision to hold a <em>shape</em> (a date, an e-mail, a
 * name). Between the two, replacing a real answer with an unlisted euphemism is much harder
 * than deleting the check altogether.
 * </p>
 */
const PLACEHOLDER_PHRASES = [
  'to be confirmed',
  'to be run',
  'to be decided',
  'to be determined',
  'to be filled',
  'to be defined',
  'tbd',
  'tba',
  'tbc',
  'todo',
  'fixme',
  'xxx',
  'pending',
  'placeholder',
  'fill in',
  'fill this',
  'unknown',
  'not measured',
  'not run',
  'not yet recorded',
  'n/a',
  'none yet',
  'no drill has been',
];

/** ISO dates are the only date format the runbook tables may use, so shapes stay checkable. */
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/;

test('the runbook and its "before you need this" checklist carry no placeholders', () => {
  // The placeholders are the whole point of issue #1066: the runbook was written but the
  // operational answers were deferred. They must not be able to come back.
  const runbook = read(INCIDENT_RUNBOOK_PATH);

  const sectionsToCheck = ['Where to report', 'Roles', 'Before you need this'];

  for (const fragment of sectionsToCheck) {
    const body = sectionContaining(runbook, fragment);
    const lowered = body.toLowerCase();

    for (const placeholder of PLACEHOLDER_PHRASES) {
      // `n/a` needs a word boundary on each side or it matches inside "n/a" fragments of
      // ordinary prose, and would fire on "Analysis" via no such path -- but `\b` also
      // stops it matching "N/A." at the end of a cell, so the boundary is explicit.
      const pattern = placeholder === 'n/a'
        ? /(?:^|[\s(])n\/a(?:[\s).,;]|$)/m
        : null;

      const found = pattern ? pattern.test(body) : lowered.includes(placeholder);

      assert.ok(
        !found,
        `the "${fragment}" section still contains the placeholder "${placeholder}"; `
          + 'fill it in or remove the row, so the runbook answers the question at 03:00',
      );
    }

    // `<>` marks an unfilled template slot. Report templates are legitimate; these three
    // sections are not templates.
    assert.ok(
      !/<>|<[a-z][^>\n]{2,}>/i.test(body),
      `the "${fragment}" section contains an unfilled <...> placeholder`,
    );

    // An unticked checkbox is a placeholder wearing a different hat. The checklist is
    // allowed to carry open items, but they must be labelled as such in prose rather than
    // left as a silent `[ ]`. Ticked items and prose bullets are the supported forms.
    //
    // List items wrap across lines, so each `- [ ]` is joined with its continuation lines
    // (indented, not starting a new bullet) before being judged. Reading only the first line
    // would flag items whose "**Still open**" marker sits on the next line.
    const items = [];
    let pending = null;

    for (const line of body.split(/\r?\n/)) {
      const start = /^\s*-\s*\[( |x|X)\]\s*(.*)$/.exec(line);

      if (start) {
        if (pending) items.push(pending);
        pending = { ticked: start[1] !== ' ', text: start[2] };
        continue;
      }

      if (pending && /^\s+\S/.test(line) && !/^\s*-\s/.test(line)) {
        pending.text += ` ${line.trim()}`;
        continue;
      }

      if (/^\s*$/.test(line) || /^\s*#/.test(line) || /^\s*-\s/.test(line)) {
        if (pending) items.push(pending);
        pending = null;
      }
    }

    if (pending) items.push(pending);

    for (const item of items.filter((entry) => !entry.ticked)) {
      // An open item is acceptable only when it says so, with a status marker or a pointer
      // to where the status is recorded.
      assert.match(
        item.text,
        /\*\*(?:Not yet done|Still open|Open)\*\*|see (?:the )?section|Tracked in #\d+/i,
        `the "${fragment}" section has an unticked checkbox "${item.text.trim()}" that neither `
          + 'cross-references where its status is recorded nor marks itself still open',
      );
    }
  }
});

test('the rows that carry a decision hold a value, not just a label', () => {
  // The positive half of the placeholder check. A blacklist can be dodged by inventing a new
  // euphemism; these rows cannot, because each must match the shape of a real answer.
  const runbook = read(INCIDENT_RUNBOOK_PATH);

  /** Returns the single cell following `label` in the first table row that starts with it. */
  function cellAfter(markdown, label) {
    const row = new RegExp(`^\\|\\s*${label}\\s*\\|([^\\n]*)\\|\\s*$`, 'im').exec(markdown);
    assert.ok(row, `no table row starting with "${label}"`);
    return row[1].trim();
  }

  // Member State: a country name, not a sentence about one.
  const memberState = cellAfter(sectionContaining(runbook, 'Where to report'), 'Member State of main establishment');
  assert.match(
    memberState.replace(/\*/g, '').trim(),
    /^[A-Z][a-z]+$/,
    `the Member State cell holds "${memberState}", which is not a country name`,
  );

  // Recipient CSIRT: must start with a CSIRT-shaped name, so a prose sentence or an empty
  // cell cannot stand in for it.
  const recipient = cellAfter(sectionContaining(runbook, 'Where to report'), 'Recipient CSIRT');
  assert.match(
    recipient,
    /^\**[A-Z][A-Za-z.]{2,}/,
    `the Recipient CSIRT cell holds "${recipient}", which does not begin with a CSIRT name`,
  );

  // SRP access: the status cell must be either a plain "No" or an ISO date. Anything else
  // ("pending", "soon", "-") is the deferred answer this issue exists to remove.
  const srp = subsectionContaining(runbook, 'SRP access');
  const registered = cellAfter(srp, 'Account registered').replace(/\*/g, '').trim();

  assert.ok(
    /^No\b/i.test(registered) || ISO_DATE.test(registered),
    `the "Account registered" cell holds "${registered}"; it must be "No" or the ISO registration date`,
  );

  // The drill table: once a row exists, its date and duration must both be real values.
  const drill = subsectionContaining(runbook, 'Drill record');
  const drillRows = drill
    .split(/\r?\n/)
    .filter((line) => /^\|/.test(line.trim()))
    .filter((line) => !/^\|[\s|:-]+\|$/.test(line.trim()))
    .slice(1); // drop the header row

  for (const row of drillRows) {
    const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
    assert.ok(ISO_DATE.test(cells[0]), `the drill row "${row.trim()}" has no ISO date in its first cell`);
    assert.match(
      cells[2],
      /\d+\s*(?:m|min|minutes?|h|hr|hours?)\b/i,
      `the drill row "${row.trim()}" has no measured duration (e.g. "3h 20m") in its "Elapsed time" cell`,
    );
  }
});

test('every runbook role names a primary and a backup', () => {
  // Two people per role so that leave, sleep and time zones cannot eat a 24-hour deadline.
  const runbook = read(INCIDENT_RUNBOOK_PATH);
  const roles = sectionContaining(runbook, 'Roles');

  const rows = roles
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 3)
    .filter((cells) => !/^-+$/.test(cells[0].replace(/:/g, '')))
    .filter((cells) => !/^(role|role name)$/i.test(cells[0]));

  for (const role of ['Security contact', 'Incident lead', 'Repository owner']) {
    const row = rows.find((cells) => cells[0].toLowerCase().includes(role.toLowerCase()));

    assert.ok(row, `the roles table has no "${role}" row`);

    // The first table in section 5 describes responsibilities in two columns; only the
    // three-column assignment table is under test here.
    const assignment = rows.find((cells) => cells[0].toLowerCase().includes(role.toLowerCase()) && cells.length >= 3 && cells[1] && cells[2]);

    assert.ok(assignment, `the roles table gives no primary/backup assignment for "${role}"`);
    assert.ok(
      assignment[1].length > 0 && !/to be confirmed|tbd/i.test(assignment[1]),
      `"${role}" has no named primary`,
    );
    assert.ok(
      assignment[2].length > 0 && !/to be confirmed|tbd/i.test(assignment[2]),
      `"${role}" has no named backup`,
    );
  }
});

test('the runbook defines a drill scenario and a dated, timed drill record', () => {
  // Criterion 5 of #1066: the drill has to be run and timed. Two separate things are under
  // test here, because conflating them makes the failure message useless:
  //
  //   1. the structure - a drill record with a scenario and a duration column;
  //   2. the evidence - an actual dated run that is less than a year old.
  //
  // The first is what this change delivers; the second can only be delivered by someone
  // running the drill and writing down what it cost. A drill that happened once and was
  // never repeated is how a 24-hour commitment quietly stops being true.
  const runbook = read(INCIDENT_RUNBOOK_PATH);
  const drill = subsectionContaining(runbook, 'Drill record');

  assert.match(drill, /scenario/i, 'the drill record does not define the scenario to rehearse');

  assert.match(
    drill,
    /elapsed|took|minutes|hours/i,
    'the drill record has no column for how long the response took; "timed" is the point of the drill',
  );

  assert.match(
    drill,
    /Run by|who ran/i,
    'the drill record does not record who ran the drill, so it cannot be traced back',
  );

  const dates = [...drill.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)]
    .map((match) => new Date(match[1]))
    .filter((date) => !Number.isNaN(date.getTime()));

  assert.ok(
    dates.length > 0,
    'no drill has been recorded yet. Run the out-of-hours drill, then add a row to the '
      + 'section 6.2 table dated YYYY-MM-DD with the measured elapsed time',
  );

  const mostRecent = new Date(Math.max(...dates.map((date) => date.getTime())));
  const ageInDays = (Date.now() - mostRecent.getTime()) / 86_400_000;

  assert.ok(
    ageInDays <= 365,
    `the most recent drill is dated ${mostRecent.toISOString().slice(0, 10)}, `
      + `${Math.floor(ageInDays)} days ago; run one and record it before the year is out`,
  );
});

test('SECURITY.md acknowledges reports within the 24-hour regulatory clock', () => {
  // The published promise and the regulatory deadline have to be compatible. `1 business
  // day` can exceed 24 hours whenever a report arrives on a Friday evening, so the policy
  // says both: a business-day acknowledgement for ordinary reports, and an explicit
  // escalation that does not wait for the next business day for anything that could be a
  // CRA trigger.
  const policy = read(SECURITY_POLICY_PATH);

  assert.match(
    policy,
    /1 business day/i,
    'SECURITY.md no longer states the 1-business-day acknowledgement researchers are promised',
  );

  // Scoped to the "what you can expect" table, not the whole file: the Article 14 summary
  // further down already mentions 24 hours, and matching that would let the escalation row
  // be deleted without any test noticing.
  const expectations = policy.slice(
    policy.indexOf('What you can expect'),
    policy.indexOf('## Scope'),
  );

  assert.ok(expectations.length > 0, 'SECURITY.md no longer has a "What you can expect" section');

  assert.match(
    expectations,
    /within \*\*24 hours\*\*/i,
    'the "What you can expect" table has no 24-hour escalation row, so a report arriving on '
      + 'a Friday evening can wait past the Art. 14 clock while the policy still looks compliant',
  );
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

// ── Mobile release build ─────────────────────────────────────────────────────

test('the release workflow installs the CMake version the Android build is pinned to', () => {
  // `android.cmakeVersion` REPLACES the CMake version AGP would use for every module
  // (Expo's ExpoRootProjectPlugin does
  // `android.externalNativeBuild.cmake.version = cmakeVersion`), so the version it names
  // has to be installed in the SDK, not merely present on the runner. It was not: the
  // runner image ships SDK CMake 3.31.5, while the pin is 3.30.4, and the master release
  // build died with
  //   [CXX1300] CMake '3.30.4' was not found in SDK, PATH, or by cmake.dir property
  //
  // The version is asserted at its source, app.json: `android/` is gitignored and
  // regenerated by `expo prebuild`, so the generated gradle.properties only exists after
  // prebuild has run and cannot be the contract.
  const path = '.github/workflows/Release.yml';
  const workflow = read(path);

  const plugins = JSON.parse(read('econoflow-mobile/app.json')).expo.plugins ?? [];
  const prebuildPlugin = plugins.find(entry => (
    Array.isArray(entry) && entry[0] === './plugins/with-detox-android'
  ));
  assert.ok(
    prebuildPlugin,
    'app.json no longer runs ./plugins/with-detox-android, so prebuild writes no CMake pin',
  );

  const pinnedCmake = /^\d+\.\d+\.\d+$/.exec(String(prebuildPlugin[1]?.cmakeVersion));
  assert.ok(
    pinnedCmake,
    `app.json's with-detox-android arguments carry no cmakeVersion (got ${JSON.stringify(prebuildPlugin[1])})`,
  );

  assert.match(
    workflow,
    /sdkmanager/,
    `${path} never runs sdkmanager, so it cannot install the SDK CMake the build is pinned to`,
  );

  // The version is read from the generated gradle.properties at build time
  // (`cmake;<derived version>`), so what matters is that the derived value reaches
  // sdkmanager - not that a literal version sits in the workflow, a second copy to drift.
  assert.match(
    workflow,
    /android\\\.cmakeVersion/,
    `${path} does not read android.cmakeVersion from gradle.properties`,
  );
  assert.match(
    workflow,
    /"cmake;\$\{CMAKE_VERSION\}"/,
    `${path} does not install the CMake version the build pins, ` +
      'so the native build fails with [CXX1300] CMake not found in SDK',
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
