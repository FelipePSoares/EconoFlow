# EconoFlow — security and support for users

This page is the user information and instruction set EconoFlow publishes under **Annex II of
Regulation (EU) 2024/2847 (the Cyber Resilience Act)**: what the product expects from its
environment, how to install, configure and use it securely, how security updates reach you,
and how to tell us about a vulnerability.

The same guidance is published in the product, in English and Portuguese, at
<https://econoflow.pt/security>. This file is the long form; if the two ever disagree, the
in-product page is what a running release shows, and this file explains it.

## 1. Support period

EconoFlow supports one delivery mode per audience — the hosted web application, the mobile
apps and the container image — and applies **one rule to all of them: security updates are
provided for 12 months after a release**.

| You use | You are supported until |
|---------|-------------------------|
| The hosted web application (`econoflow.pt`) | 12 months after the release it currently runs |
| The Android or iOS app | 12 months after the release you installed |
| A container image from `gitea.fpssoftware.uk/fps-software/econoflow` | 12 months after the release of that image |

The current release is the supported one; upgrading to a newer release starts a new period and
the older one stops being supported. Older releases are not backported unless a vulnerability
is severe enough that no upgrade path exists.

**When a support period is coming to an end**, a notice is published at least 90 days before
the end date:

| Delivery mode | Where the notice appears |
|---------------|--------------------------|
| Hosted web application | On <https://econoflow.pt/security>, in the release notes, and by e-mail to the active users of the service |
| Mobile apps | On the page, in the repository's GitHub Security advisories and in the release notes for the store listing |
| Container image | On the page, in the repository's GitHub Security advisories and in the release notes, so an operator learns about it from the release feed they already follow |

The notice names the release, the end date and what to upgrade to. See
[`SECURITY.md`](../SECURITY.md) for the authoritative policy wording.

## 2. What the product expects from its environment

EconoFlow is a web application with an API. Each delivery mode has its own requirements.

### Hosted web application

- A current browser — the last two major versions of Chrome, Edge, Firefox or Safari — with
  JavaScript and `localStorage` enabled. The web client is also installable as a PWA.
- The application is served over HTTPS only; HSTS and a strict Content Security Policy are
  sent by the server.
- Sign-in is protected by Cloudflare Turnstile. Account passwords must be at least 8
  characters and contain an upper-case letter, a lower-case letter, a digit and a symbol, and
  five failed sign-ins lock the account for five minutes. Second-factor authentication is
  available from the account settings but is not enforced by the service.
- Accounts are not required to confirm their e-mail address before signing in; a user who
  wants that assurance should turn on second-factor authentication.

### Mobile apps

- Android or iOS, installed **only from the official store listing**. There is no supported
  side-loading path.
- The app talks only to the server address it is built with; it does not accept a different
  server from a link or a QR code.
- Sign-ins are stored in the platform secure store (the Keychain on iOS, the Keystore on
  Android), never in plain application storage. The optional app PIN and biometric unlock
  protect the session on the device.

### Container image (self-hosted)

The image runs the API and the web client in a single ASP.NET Core process and ships **no
configuration values**. A deployer must provide:

- A PostgreSQL database (the only supported store for production) through
  `EasyFinanceDB='Host=…;Port=5432;Database=…;Username=…;Password=…'`.
- The secrets, each **at least 32 characters and unique per deployment**, generated for that
  deployment and never reused from a sample: `EconoFlow_TOKEN_SECRET_KEY`,
  `EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN`, `EconoFlow_USER_KEY_SALT`,
  `EconoFlow_UNSUBSCRIBE_HMAC_SECRET`.
- SMTP settings (`SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD` and the optional `SMTP_*`
  tuning values) so account and security e-mails can be sent.

**The server refuses to start** when a required secret is missing, blank or shorter than 32
characters, and names every offending variable in one message. That failure is deliberate: a
deployment that starts without them is not secure. See
[`docs/docker.md`](docker.md#runtime-environment-variables) for the complete list.

The image listens on plain HTTP on port `8080` and runs as a non-root user. It redirects
every request that it does not already see as HTTPS, so a deployment behind a TLS-terminating
proxy **must** forward the original scheme (`X-Forwarded-Proto`) **from an address the
application trusts**. The image trusts only `10.42.0.0/16` by default, so a compose, nginx or
other proxy outside that range must be added explicitly:

- `ForwardedHeaders__KnownNetworks__0=<proxy CIDR>` for a proxy address range, or
- `ForwardedHeaders__KnownProxies__0=<proxy address>` for a single address.

Without a scheme header — or with one sent from an untrusted address — the browser is
redirected to `https://<host>:8080/`, which is plain HTTP on that port, and the application is
unreachable. See [`docs/docker.md`](docker.md#runtime-environment-variables).

## 3. Secure installation and configuration

1. **Pin the image by digest**, not by a mutable tag. `:latest` is what the cluster's image
   updater tracks; every published image also carries an immutable commit-SHA tag and a
   digest that is recorded in the release.
2. **Keep secrets in the platform's secret store** (a Kubernetes `Secret`, a SealedSecret, or
   the equivalent) — never in the image, a Compose file checked into a repository, or an
   environment file committed by mistake. Rotating a secret is a plain redeploy with the new
   value; except for the delete token there is no re-encryption step.
3. **Terminate TLS upstream, forward the client scheme and trust the proxy** — the server
   must receive `X-Forwarded-Proto: https` from an address listed in
   `ForwardedHeaders:KnownNetworks` (or `KnownProxies`; the defaults cover only
   `10.42.0.0/16`), set with `ForwardedHeaders__KnownNetworks__0=<proxy CIDR>` or
   `ForwardedHeaders__KnownProxies__0=<proxy address>`. Without it, every non-health request
   is redirected to `https://<host>:8080/`, and the deployment is unusable.
4. **Configure SMTP** so the security-relevant e-mails (password reset, email verification,
   security notifications) can actually reach users.
5. **Give the database its own least-privilege credentials** and back it up; the backups
   contain personal and financial data and are as sensitive as the database itself.
6. **Storage of attachments** is either the local filesystem (a mounted volume) or an
   S3/MinIO bucket. Keep the volume private to the service and the bucket's credentials
   scoped to that bucket.
7. **Health probes** are `/api/health/live` and `/api/health/ready`; keep them reachable from
   the orchestrator and from nothing else.
8. **Never enable the development seed data in production.** `EconoFlow_SEED_DEVELOPMENT_DATA`
   only has an effect in the Development environment, and the Development image is not the
   one to deploy.

## 4. Security updates

- Security updates are published as **new releases**. For the container image, that is a
  new push to `master` — a new `:latest` plus a new immutable commit-SHA tag and digest, built
  from the fixed source and announced in the release notes with its SBOM.
- The hosted service and the mobile apps are updated by us: the hosted deployment is rolled
  by the image updater as soon as a fixed release exists, and the store releases are published
  with the fix. The web client also checks the running version against the published one and
  tells you when a refresh will install a newer one.
- **Installing an update** for a self-hosted container is a redeploy of the new digest with
  the same configuration. No database migration step is separate from start-up: the image
  applies its own migrations when it starts.
- The dependency exposure of every release is gated in CI (audit gate and Dependabot), and
  each release publishes a CycloneDX SBOM (see `docs/cra-compliance-assessment.md`).
- **Apply a security release within a month of its publication.** If you cannot, say so at
  the address below so we can tell you what the exposure is and, where possible, offer a
  backport.

## 5. Using EconoFlow securely

This section describes the protections EconoFlow offers and how they are used, in the same
third person as the in-product page. Several of them are only as effective as the habit around
them, which is why the habit that goes with each one is stated too.

- A **unique password**, kept in a password manager, is the first line of defence; the password
  policy the account is held to is the one in §2.1.
- **Second-factor authentication** is available in
  **Settings → Password and Authentication → Authenticator App (TOTP)** (on mobile:
  **Profile → Password and Authentication → Authenticator App (TOTP)**), and the recovery
  codes are only useful if they are kept somewhere other than the device with the
  authenticator. Accounts are not required to confirm their e-mail address, so this is the
  optional control that adds a second factor.
- On a shared device, the **sign-out** action and — on mobile — the app PIN and biometric
  unlock are what keep the session private.
- EconoFlow never asks for a password by e-mail, chat or phone, and never asks anyone to
  install something to receive a security update. Such a message is phishing and belongs at
  the reporting address below.
- A new-sign-in notice the user does not recognise is a reason to change the password.
- **Deleting the account** is done from **Settings → Account**. The app shows a confirmation
  dialog listing the projects that will be deleted with the account, and nothing is deleted
  until you confirm it there — the confirmation expires after a couple of minutes, so the
  deletion cannot happen by accident later. Deleting the account also deletes the projects
  you are the only administrator of; projects you share are kept and stay with their other
  administrators.

## 6. How to report a vulnerability

**Do not report security vulnerabilities through public GitHub issues, discussions or pull
requests.**

- **E-mail:** contact@econoflow.pt with the subject line `SECURITY`
- **Backup:** security@econoflow.pt if the primary address does not answer in time
- **Machine-readable:** <https://econoflow.pt/.well-known/security.txt> (RFC 9116)

Include the affected product and version, a description and impact, the steps to reproduce,
and any proof of concept or logs. We acknowledge reports within one business day, and
escalate immediately — including at weekends — for anything that could be an actively
exploited vulnerability, which is what starts the 24-hour reporting clock of Article 14.
The full policy is in [`SECURITY.md`](../SECURITY.md).

## 7. Keeping users informed

The support period, the end-of-support dates and this instruction set are always published
together on <https://econoflow.pt/security> (English) and <https://econoflow.pt/pt/security>
(Portuguese). A change to the support period is published there before it takes effect.

_Last updated: 2026-10-29._
