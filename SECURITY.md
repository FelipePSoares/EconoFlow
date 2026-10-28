# Security Policy

EconoFlow (internal codebase name: EasyFinance) takes the security of the application, the
web client and the mobile apps seriously. This document explains how to report a
vulnerability, what you can expect from us when you do, and the commitments we make as a
manufacturer under the EU Cyber Resilience Act.

## Supported versions

The **support period** is the period during which EconoFlow provides security updates for a
released version of the product. It is defined per delivery mode and is the same rule for all
of them: **security updates are provided for 12 months after a release**.

| Delivery mode | Product | Support period |
|---------------|---------|----------------|
| Hosted service | EconoFlow hosted web application (`econoflow.pt`) | 12 months from the release, then rolled over by the next release. The service is only offered while its current release is supported. |
| Mobile apps | EconoFlow mobile apps for Android and iOS | 12 months from the release (each store release starts a new period, which supersedes the previous one). |
| Container image | EconoFlow container image `gitea.fpssoftware.uk/fps-software/econoflow` | 12 months from the release of the image. A release is the push to `master` that produces the `latest` tag; its immutable handle is the commit-SHA tag (`:<sha>`) and digest. |

What that means in practice:

- The release the product is running today is supported until **12 months after that release**.
  The end date therefore moves with every release, which is why the period is stated as a rule
  rather than as a fixed date: a fixed date would have to be re-committed annually and would
  eventually be missed.
- Only the current release of each delivery mode receives security updates. A superseded
  release stops being supported when its successor is released.
- Older releases are not backported unless a vulnerability is severe enough that no upgrade
  path exists — for example an operator who cannot upgrade the container image before the
  current release reaches the end of its period.
- The rule is reviewed at least once a year together with this document. If it changes, the
  new period is published here before it takes effect, and applies to releases made from that
  date.

### End-of-support notices

Users are told when a support period is ending. **At least 90 days before the end of a
period**, a notice is published, in every channel that reaches the users of that delivery mode:

| Delivery mode | Where the end-of-support notice appears |
|---------------|-----------------------------------------|
| Hosted web application | On the [security and support page](https://econoflow.pt/security), in the release notes, and by e-mail to the active users of the service |
| Mobile apps | On the security and support page, in this repository's GitHub Security advisories, and in the release notes for the store listing |
| Container image | On the security and support page, in this repository's GitHub Security advisories, and in the release notes, so an operator sees it in the release feed they already follow |

The notice names the release, the end date, and the upgrade path (the new release to move
to, or — for the container image — the deployment change required), and it stays on the
security and support page until the period has ended, so the current status is always
available in the product.

The same page publishes the user-facing instructions for the secure installation, configuration
and use of the product that Annex II of the Regulation requires; the long form lives in
[`docs/security-user-guide.md`](docs/security-user-guide.md).

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

- [`docs/security-user-guide.md`](docs/security-user-guide.md) — the user information and
  instructions for the secure installation, configuration and use of the product required by
  Annex II, published for users at [`econoflow.pt/security`](https://econoflow.pt/security).
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
