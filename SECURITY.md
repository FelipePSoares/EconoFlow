# Security Policy

EconoFlow (internal codebase name: EasyFinance) takes the security of the application, the
web client and the mobile apps seriously. This document explains how to report a
vulnerability, what you can expect from us when you do, and the commitments we make as a
manufacturer under the EU Cyber Resilience Act.

## Supported versions

The support period stated below is the period during which EconoFlow provides security
updates for a released version of the product.

| Product | Support period |
|---------|----------------|
| EconoFlow web application (hosted) | Security updates for as long as the service is operated, currently **not before 31 December 2030** |
| EconoFlow mobile apps (Android / iOS) | Security updates **until 31 December 2030** |
| EconoFlow container image (`gitea.fpssoftware.uk/fps-software/econoflow`) | Security updates for any image tag published in the last **12 months** |

Only the latest release of each product receives security updates. Older releases are not
backported unless a vulnerability is severe enough that no upgrade path exists.

When the supported period for a product is coming to an end, a notice is published in this
repository and, where the product is offered as a service, to the affected users.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions
or pull requests.**

Report them privately to:

- **E-mail:** contact@econoflow.pt, with the subject line `SECURITY`
- **Backup:** security@econoflow.pt, if the primary address does not answer in time
- **Encryption:** if you need to send sensitive material, ask for a PGP key in your first
  message and we will reply with one before you send any details.

Please include as much of the following as you can:

- The affected product and version (web, mobile app version, or container image tag).
- A description of the vulnerability and its potential impact.
- Step-by-step instructions to reproduce it.
- Any proof-of-concept code, screenshots or logs.
- Whether you intend to disclose the issue publicly, and the timeline you have in mind.

A machine-readable copy of this reporting channel is published at
[`/.well-known/security.txt`](https://econoflow.pt/.well-known/security.txt), following
[RFC 9116](https://www.rfc-editor.org/rfc/rfc9116).

## What you can expect from us

| When | What happens |
|------|--------------|
| Within **1 business day** | We acknowledge receipt of your report. |
| Within **24 hours** | If your report concerns an actively exploited vulnerability or could be a severe security incident, say so in the subject line. Our Article 14 clock starts when we become aware, so we escalate immediately rather than waiting for the next business day, including at weekends. |
| Within **10 business days** | We confirm the vulnerability (or explain why we believe it is not one) and give you an initial estimate of the fix. |
| When a fix is available | We release it and credit you in the release notes, unless you ask to remain anonymous. |
| Due to regulators | Where an actively exploited vulnerability affects our product, we notify the relevant CSIRT through ENISA's Single Reporting Platform **within 24 hours** of becoming aware, then file the fuller notification **within 72 hours**, in line with Article 14 of the Cyber Resilience Act. |

We ask that you give us a reasonable amount of time to fix the issue before any public
disclosure. We will not take legal action against researchers who act in good faith, and we
will not pursue anyone who follows this policy.

## Scope

This policy covers the EconoFlow codebase and the instances we operate, including:

- `econoflow.pt` and its subdomains
- the Angular web client
- the Android and iOS mobile applications
- the published container image

Out of scope:

- Vulnerabilities in third-party services we consume, unless EconoFlow misuses them.
- Denial-of-service attacks against infrastructure, and automated scanner output without a
  working proof of concept.
- Social engineering, physical attacks, and spam or content reports.
- Reports about missing HTTP security headers that the platform already sets upstream.

## Cyber Resilience Act

EconoFlow is a product with digital elements within the meaning of Regulation (EU) 2024/2847
(the Cyber Resilience Act). This policy is the coordinated vulnerability disclosure policy
required by Annex I, Part II, point 2 of that Regulation.

The related artefacts are:

- [`docs/cra-incident-reporting.md`](docs/cra-incident-reporting.md) — the internal runbook
  for the Article 14 reporting obligations.
- [`docs/cra-compliance-assessment.md`](docs/cra-compliance-assessment.md) — the current
  readiness assessment against the Regulation.
- [`docs/security-exceptions.md`](docs/security-exceptions.md) — the register of dependency
  advisories we have deliberately accepted and why.
- [`.github/dependabot.yml`](.github/dependabot.yml) and
  [`scripts/audit-gate.mjs`](scripts/audit-gate.mjs) — the automated dependency-update and
  audit gate that keeps the vulnerability exposure of the codebase low.

## Thanks

We are grateful to the security researchers and users who report vulnerabilities to us. If
you would like to be credited publicly, let us know in your report.
