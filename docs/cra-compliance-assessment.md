# Cyber Resilience Act — compliance assessment

**Product:** EconoFlow (internal codebase name: EasyFinance)
**Regulation:** Regulation (EU) 2024/2847 — Cyber Resilience Act ("CRA")
**Assessment date:** 2026-10-23
**Repository state:** branch `refactor/postgres-only-persistence`, commit `96e0fea`

> **This is an engineering readiness assessment, not legal advice.** It records what the
> codebase and delivery pipeline do and do not demonstrate against the requirements of the
> CRA. Product classification, the EU declaration of conformity, CE marking and customer
> documentation are legal/commercial deliverables owned by the manufacturer.

---

## 1. Verdict

**No — EconoFlow does not currently demonstrate compliance with the CRA.** It has a
genuinely strong *engineering* security baseline, but it is missing the *product-safety-file*
layer that the CRA actually turns into a legal obligation, and one obligation is already
binding today.

| Area | Status |
|------|--------|
| Security features in the product (Annex I, Part I) | 🟡 Strong, with hardening gaps |
| Vulnerability handling inside the repo (Annex I, Part II) | 🟢 Largely present |
| **Incident / vulnerability reporting (Art. 14)** | 🟡 **Runbook populated and identified** — SRP account and drill still open (#1066) |
| Technical documentation (Annex VII) | 🔴 Absent (#1073) |
| SBOM | 🟢 **Generated per release** (#1065) |
| Security update support period | 🟡 Stated in `SECURITY.md`; needs owner confirmation (#1069) |
| User instructions (Annex II) | 🔴 Absent (#1069) |
| Conformity assessment & CE marking (Annex VIII) | 🔴 Not performed (#1074) |

### Implemented since the initial assessment

The first remediation pass landed the artefacts that were quickest to build and carried the
most risk:

- `SECURITY.md` and `easyfinance.client/src/.well-known/security.txt` publish the coordinated
  vulnerability disclosure channel (Annex I, Part II, point 2).
- `docs/cra-incident-reporting.md` is the Article 14 runbook: triggers, 24 h / 72 h / 14 d /
  1 month deadlines, the SRP destination, roles and reporting templates.
- `scripts/generate-sbom.mjs` produces a CycloneDX SBOM covering NuGet, both npm trees and the
  base images; `Release.yml` and `docker-publish.yml` publish it as a release artefact.
- The dev server now serves the same CSP directives as production, so the policy is exercised
  during development and by the Cypress suite.
- `scripts/cra-compliance.test.mjs` asserts all of the above in CI.

**Still open and urgent:** the operational side of Article 14. The runbook now names the
Member State of main establishment (Portugal) and the recipient CSIRT (CERT.PT, operated by
CNCS), names a primary
and a backup for every reporting role, and states honestly that the product is available in
all EU Member States (plus Brazil, and every store market for the apps). Two things are still
missing, and the first is the one that matters:

- **The ENISA SRP account does not exist yet.** Until it does, an incident cannot be reported
  within 24 hours at all. `scripts/cra-readiness-report.mjs` prints this as a warning on every
  CI run, because it is a fact about the world rather than a defect a commit can fix.
- **No out-of-hours drill has been run.** The timing structure and scenario are in place; the
  first measured row is not. The test suite fails until one is recorded, and again if the
  most recent one is over a year old.

Tracked in #1066.


---

## 2. Scope: does the CRA apply to EconoFlow?

The CRA applies to "products with digital elements" (PDEs) — any software product placed on
the EU market in the course of a commercial activity. It covers **software sold as a service
or as an application**, not just hardware: the European Commission explicitly lists
"apps" and "mobile applications" among covered products
([EC — Cyber Resilience Act](https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act),
[EC — Conformity assessment](https://digital-strategy.ec.europa.eu/en/policies/cra-conformity-assessment)).

EconoFlow's delivery modes:

| Mode | PDE? | Notes |
|------|------|-------|
| Hosted SaaS at `econoflow.pt` | **Yes** | CRA applies; the commercial activity is the service itself. |
| Mobile app (Expo/React Native) | **Yes** | The Commission names mobile applications explicitly. |
| Docker image (`gitea.fpssoftware.uk/fps-software/econoflow`) | **Yes, if distributed commercially** | Self-hosting by third parties counts as placing on the market. |
| Source code on GitHub (AGPL-style `LICENSE`) | **Conditional** | Free and open-source software is outside the CRA *unless* supplied in the course of a commercial activity. Merely publishing the source is not commercial; selling support, or shipping a paid hosted/mobile product built on it, is. |

**Key point:** the open-source exemption does **not** shelter a commercially operated
EconoFlow. Once users are billed, the software is a PDE regardless of its licence.

### Classification

EconoFlow is a **default-category** PDE. It is not an "important product" (Annex III) or a
"critical product" (Annex IV) — it is a personal/company budgeting application, not an
operating system, firewall, hypervisor, password manager, or browser.

**Consequence:** conformity may be demonstrated by **Module A — internal control**
(Annex VIII) — i.e. self-assessment by the manufacturer, with no notified body required. This
is the lighter path, but it is *not* "no work": it still requires technical documentation, a
risk assessment, an EU declaration of conformity and CE marking.

### Applicable dates

| Date | What becomes binding | Status today |
|------|----------------------|--------------|
| 2024-12-10 | Regulation enters into force | Passed |
| **2026-09-11** | **Art. 14 reporting** of actively exploited vulnerabilities and severe security incidents, via ENISA's Single Reporting Platform (SRP) | **Passed — currently binding** |
| 2027-12-11 | Full obligations: Annex I, technical documentation, conformity assessment, CE marking, support period | 14 months away |

Sources: [EC — CRA overview](https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act),
[EC — Reporting obligations](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting),
[NBÚ — Article 14 comes into force](https://cra.nbu.gov.sk/en/article-14-comes-into-force-what-can-manufacturers-expect-from-11-september-2026/).

---

## 3. The most urgent gap: Article 14 reporting (already binding)

This is the one item that is **legally due now**. The runbook, the recipient CSIRT and the
reporting roles are established; the account needed to actually file a report and the timing
drill are not.

Art. 14 requires, from the moment the manufacturer *becomes aware* of an actively exploited
vulnerability or a severe security incident:

| Deadline | Deliverable |
|----------|-------------|
| **24 hours** | Early warning — that it occurred, suspicion of malicious action, Member States where the product is available |
| **72 hours** | Notification — product info, nature of the vulnerability/incident, corrective or mitigating measures |
| **14 days** *(after a fix is available)* | Final report for actively exploited vulnerabilities |
| **1 month** *(after the 72 h report)* | Final report for severe incidents |

Reports go once, to ENISA's SRP, addressed to the CSIRT of the Member State of the
manufacturer's main establishment. EconoFlow's main establishment is **Portugal**, so the
recipient is **CERT.PT**, the Portuguese national CSIRT operated by the national authority
**CNCS** (Centro Nacional de Cibersegurança). Availability is **all EU Member
States** — the hosted service is open to anyone — plus Brazil, where the product has known
users outside the EU.

The reporting obligation **applies to products already on the market**, not only to new ones.
Critically, it requires knowing *whether a given vulnerability affects your product* — which
depends on an inventory of what the product contains. That inventory now exists:
`scripts/generate-sbom.mjs` produces a per-release CycloneDX SBOM (see #1065).

### Required actions

1. ✅ Determine the Member State of main establishment (Portugal), the national CSIRT
   (CERT.PT) and the national authority (CNCS). ⏳ **Still open:** register the ENISA SRP
   account and confirm access for the primary and backup contacts.
2. ✅ Write an incident-response runbook with 24 h / 72 h / 14 d / 1 month templates, an
   on-call escalation path and a named decision-maker. ⏳ **Still open:** the out-of-hours
   drill that proves it.
3. ✅ Maintain a list of Member States where each PDE is available (all EU Member States, plus
   Brazil and the mobile store markets).
4. ✅ Establish `security@` intake monitoring that feeds the "becomes aware" trigger.

---

## 4. What the codebase already does well

Credit where due — these map directly to CRA Annex I obligations and are already in place:

| CRA theme | Evidence in repo |
|-----------|------------------|
| Secure by default (I.2(1)) | Global `AuthorizeFilter` requiring an authenticated user; only deliberately-marked endpoints are anonymous (`Program.cs`); project-scoped RBAC via `ProjectAuthorizationMiddleware` |
| Secure defaults (I.2(1)) | HSTS with preload + subdomains, HTTPS redirection, CSP with per-request nonce, `frame-ancestors 'none'`, `object-src 'none'` (`SecurityPolicyOptionsFactory.cs`) |
| Protect confidentiality (I.2(2)(e)) | JWT signing keys, SMTP, S3, Turnstile and refresh tokens are all environment-supplied, not committed; `appsettings.json` holds only empty placeholders |
| Authentication hardening | Identity password policy (length 8, mixed case, digit, symbol), lockout 5 attempts / 5 min, TOTP 2FA with recovery codes, step-up (password **+** 2FA) for disabling 2FA, Turnstile CAPTCHA |
| Session hardening | Access and refresh cookies `HttpOnly`, `Secure`, `SameSite=Strict`; short-lived access tokens (900 s) |
| Data at rest | Data Protection keys persisted to the DB (`PersistKeysToDbContext`), optional DPAPI on Windows |
| Reduce attack surface (I.2(1)) | Non-root container user (`USER 1654`), Swagger disabled outside Development |
| Security testing (II.3) | CodeQL (C#, JS/TS, Actions) on push, PR and weekly cron |
| Vulnerability *analysis* (II.1) | `audit-gate.mjs` fails CI on unexcepted high/critical npm advisories; documented, time-boxed exception register in `docs/security-exceptions.md`; `dotnet list package --vulnerable`; Dependabot across npm, NuGet, Actions |
| Coordinated disclosure (II.2) | …**missing** — see §5.2 |

The `docs/security-exceptions.md` register in particular is exactly the kind of documented
risk-acceptance record a CRA assessor wants to see. Keep it.

---

## 5. Gaps, in priority order

### 5.1 🔴 No Software Bill of Materials (critical)

No SBOM is produced anywhere: no CycloneDX or SPDX generation in any workflow, no artifact,
no per-release record. The codebase spans five distinct dependency populations — NuGet,
client npm, mobile npm, the .NET/ASP.NET base images, and the Android/Gradle toolchain.

Without an SBOM, the Art. 14 clock cannot be run: when a CVE drops you cannot answer "are we
affected?" within 24 hours. It is also an explicit input to Annex VII(2)(d) technical
documentation and to enabling Annex I(2).

*Action:* generate a CycloneDX SBOM per release from all five populations, attach it to the
release artifact, and store it with the release. `docker/build-push-action` supports
`sbom: true` / `provenance: true` and neither is currently enabled in `docker-publish.yml`.

### 5.2 🔴 No security policy or vulnerability-disclosure channel

There is no `SECURITY.md`, no `/.well-known/security.txt`, and no reporting address. Annex I
Part II(2) requires a *coordinated vulnerability disclosure policy* — a published way for
researchers to report findings and a process for acknowledging and handling them. This is a
cheap, high-value fix.

### 5.3 🔴 No technical documentation, risk assessment, or support-period declaration

Annex VII requires, at minimum: product description and identification, a cybersecurity risk
assessment, the design/development/maintenance approach, vulnerability handling (including
coordination and disclosure), and records of applied standards or specifications.

Related, and equally absent: **Annex I(2)(6) requires the support period** (the period during
which security updates are provided) to be *defined and stated* to users, and Annex II requires
user information and instructions. `README.md` and the app itself state neither a support
period nor a security-update policy.

*Action:* author a technical file, pick and publish a support period (e.g. "security updates
provided for 5 years from release"), and surface it in the product and on the website.

### 5.4 ✅ Fixed — Secret handling at start-up (secure-defaults failure mode)

> **Status: remediated in #1068.** Every environment-supplied secret is now resolved and
> validated once, before the host is built, on the same terms as SMTP. Outside Development a
> missing, blank or too-short secret fails the start-up with a single message naming every
> offending variable; Development keeps working defaults and logs a warning. See
> [Required secrets](../architecture.md#required-secrets-start-up-validation).
> The original findings are kept below for the record.

Environment-supplied secrets mostly fail *closed*, which is good — but inconsistently and
sometimes only at request time rather than at start-up:

| Variable | Failure mode (before the fix) |
|----------|--------------|
| `EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN` | Throws at request time (`AccessControlController.cs:179`) — a misconfigured production server starts fine and fails in front of users |
| `EconoFlow_USER_KEY_SALT` | **Silently falls back to the literal `"Development_Key"`** (`ApplicationServiceRegistration.cs:38`) — no throw, no warning, even in Production |
| `EconoFlow_UNSUBSCRIBE_HMAC_SECRET` | Correct: throws when unset outside Debug |
| `EconoFlow_TOKEN_SECRET_KEY` | Falls back to the config value, which is empty — **confirmed:** chassis signs with it, and an empty key makes `CreateToken` throw `ArgumentException: IDX10703` at request time, so every login failed on a server that had started "successfully" |

The token secret fallback was the most serious: a server with an empty JWT signing key
started healthy and then failed every login. All secrets are now validated **up front** in
`Program.cs` with the same discipline already used for SMTP, so the start-up fails loudly
rather than degrading silently.

**Clarification on the user key salt:** the default salt looks worse than it is. The key is
`SHA256(userId + ":" + salt)` and *userId* is a per-user random GUID, so a default salt does
**not** make keys guessable, and the key only encrypts non-sensitive UI data in `localStorage`
(see `local.service.ts`). It is still a deployment-hardening gap worth closing, not a
confidentiality breach.

### 5.5 🟡 No rate limiting on authentication endpoints

No rate limiter is configured anywhere in the solution. ASP.NET Identity lockout does cover
password guessing against a *single* account (5 attempts / 5 min), and CAPTCHA is available,
but there is no protection against:

- distributed / credential-stuffing attacks spread across many accounts,
- enumeration or abuse of `forgotPassword`, `resendConfirmEmail`, `search`,
- request flooding generally (a denial-of-service concern under Annex I(2)(3)).

*Action:* add ASP.NET Core `AddRateLimiter` policies, at minimum on
`/api/AccessControl/*` and the support/contact endpoints.

### 5.6 🟡 No automated dependency-uptime monitoring of container base images

Dependabot covers npm, NuGet and Actions — but **not** `mcr.microsoft.com/dotnet/sdk:10.0`
or `dotnet/aspnet:10.0`, and not the Android/Gradle toolchain. A base-image CVE will not
raise an alert. Add a `docker` ecosystem entry to `.github/workflows/dependabot.yml` and a
container scan (Trivy/Grype) on the published image.

### 5.7 🟡 Release provenance gaps

`docker-publish.yml` uses `platforms: linux/amd64` with no `provenance` or `sbom`. Actions are
pinned to floating tags (`@v7`, `@v6`, `@latest`, `ChristopheLav/iis-deploy@v1`). Note that
`anomalyco/opencode/github@latest` runs on `issue_comment` with `id-token: write` — a floating
tag on a token-bearing workflow is an avoidable supply-chain risk (Annex I(2)(1), I(2)(5)).

### 5.8 🟡 Attachment upload validation trusts the client

`AttachmentUploadPolicy` allows PDF/JPEG/PNG/WebP/HEIC by *declared* `Content-Type` only, with
no magic-byte or content sniffing. The 10 MB cap is good; the type check is advisory. Since
files are served back to users, add server-side content verification.

### 5.9 ℹ️ Dev-mode CSP gap (informational)

In Development the app skips `UseSecurityPolicy`, and `proxy.conf.js` carries no headers — so
the CSP is not exercised during local development or Angular unit tests, while the CI Cypress
suite runs against exactly that dev-mode server. CSP regressions are therefore only caught
after deployment.

---

## 6. What is *not* an issue (checked and cleared)

Recording these avoids re-litigating them later:

- **No hard-coded production secrets.** `appsettings.json` is all empty strings; the Sentry DSN
  in `Release.yml` is a public ingest endpoint, correctly documented as such.
- **The mobile CI keystore is not a shipped signing key.** `Release.yml` generates a throwaway
  keystore with password `android` for an artifact APK, and the Android build job is gated on
  mobile changes. Confirm that the *distributed* app is signed with a real, protected key —
  that key must never live in this repository, and the password must not be `android`.
- **Logout is correctly anonymous** so an expired session can still clear its cookie.
- **The beta-tester admin endpoint** uses a constant-time key comparison and fails closed when
  the key is unset. Other anonymous endpoints (`forgotPassword`, `resetPassword`,
  `confirmEmail`, `mobile/login`) are anonymous by design.
- **Login has lockout and optional CAPTCHA**; 2FA disable/regenerate requires password + code.

---

## 7. Remediation sequence

| # | Action | Effort | Why now | Issue | Status |
|---|--------|--------|---------|-------|--------|
| 1 | Establish Art. 14 reporting runbook, CSIRT contact and access, out-of-hours drill | Days | **Binding since 2026-09-11** | #1066 | 🟡 Runbook, CSIRT and roles done; SRP account and drill open |
| 2 | Generate and retain CycloneDX SBOMs per release (NuGet, npm ×2, base images) | Days | Unblocks Art. 14 and Annex VII | #1065 | 🟢 Done |
| 3 | Add `SECURITY.md`, `/.well-known/security.txt`, and a monitored intake address | Hours | Annex I Part II(2) | #1067 | 🟢 Done |
| 4 | Fail start-up on missing/short secrets; remove the `"Development_Key"` fallback | Hours | Annex I(2)(1) | #1068 | 🟢 Done |
| 5 | Publish a security update support period and user security instructions | Days | Annex I(2)(6), Annex II | #1069 | 🟡 Period stated; Annex II instructions open |
| 6 | Add rate limiting on authentication and support endpoints | Days | Annex I(2)(1)(3) | #1070 | 🔴 Open |
| 7 | Container scanning; pin third-party actions to commit SHAs; add Dependabot `docker` ecosystem | Days | Annex I(2)(5), VII | #1071 | 🟡 `provenance`/`sbom` enabled; rest open |
| 8 | Verify uploads by content rather than the declared `Content-Type` | Days | Annex I(2)(1) | #1072 | 🔴 Open |
| 9 | Author the technical file (Annex VII) and risk assessment | Weeks | Required by 2027-12-11 | #1073 | 🔴 Open |
| 10 | Annex VIII Module A self-assessment, EU declaration of conformity, CE marking | Weeks | Required by 2027-12-11 | #1074 | 🔴 Open |

Items 1–3 are the ones that convert "we have decent security engineering" into "we are
actually governed by the CRA". Items 4–8 are hardening on a foundation that is already
better than average. Items 9–10 are the conformity deliverables due in December 2027.

The backlog is tracked in #1075.

