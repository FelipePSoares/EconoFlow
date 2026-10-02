# Security exceptions

This document is the single source of truth for the npm advisories that the
repository deliberately accepts. `scripts/audit-gate.mjs` runs on every pull
request for `easyfinance.client` and `econoflow-mobile` and **fails the build**
when `npm audit` reports a `high` or `critical` advisory that is not listed in the
table below. Adding a row here is the only way to accept an advisory, and it
should only ever be done when the advisory genuinely cannot be patched from
inside this repository.

> Adding a row is a documented decision, not a fix. Prefer upgrading.

## Accepted advisories

| GHSA | Severity | Packages | Reason it cannot be patched here |
|------|----------|----------|----------------------------------|
| GHSA-86w9-cpqp-85rv | high | node-forge, @expo/code-signing-certificates, @expo/cli, expo, @react-native-community/datetimepicker, @sentry/react-native | `node-forge@1.4.0` is the newest published release and the advisory covers `<= 1.4.0`, so no fixed version exists upstream. It reaches the mobile lock file transitively through `@expo/code-signing-certificates` (an Expo CLI build-time dependency) and is never invoked by application code. |
| GHSA-vcc3-ghjq-m6fr | moderate | decode-uri-component, query-string, @react-navigation/core | The only patched release, `decode-uri-component@0.5.0`, is ESM-only and breaks `query-string` under the CommonJS Jest environment. The parent chain (`@react-navigation/core` → `query-string` → `decode-uri-component@0.2.2`) has no patched release that stays CommonJS-compatible, so the advisory is accepted until React Navigation ships an ESM-ready chain. |

Only the GHSA column, the severity column and the comma-separated package column
are parsed; the last column is human-readable rationale.

## Advisories that were fixed

Every other advisory that was open on 2026-10-02 is fixed by pinning the patched
releases in the `overrides` block of `easyfinance.client/package.json` and
`econoflow-mobile/package.json`, together with the version bumps in the
`dependencies`/`devDependencies` blocks:

| Area | Change |
|------|--------|
| Angular SSR | `@angular/*` `22.1.2` → `22.2.1` (SSR XSS, SSRF, DoS, router matrix-parameter DoS) |
| HTTP request parsing | `qs` → `6.16.0` |
| URL parsing | `fast-uri@3` → `3.1.8`, `ip-address` → `10.7.3`, `baseline-browser-mapping` → `2.11.27`, `browserslist` → `4.29.3` |
| Build workers | `piscina` → `5.3.2` |
| Dev server / SSR helpers | `hono` → `4.13.12`, `engine.io` → `6.6.11` |
| Brace expansion | `brace-expansion@1` → `1.1.21`, `brace-expansion@5` → `5.0.12` |
| YAML parsing | `js-yaml@3` → `3.15.2` |
| Datetime formatting | `moment` → `^2.31.0` |
| HTTP client (mobile) | `axios` → `^1.20.0` |
| XML parsing (mobile) | `@xmldom/xmldom@0.8` → `0.8.15`, `@xmldom/xmldom@0.9` → `0.9.12` |
| Fetch/HTTP stack (mobile) | `undici@6` → `6.29.0` |
| YAML parsing (mobile) | `js-yaml@3` → `3.15.2`, `js-yaml@4` → `4.3.2` |
| Image dimension parsing (mobile) | `image-size` → `2.0.4` |
| UUID generation (mobile build tooling) | `uuid` → `11.1.1` (via the `@expo/ngrok` and `xcode` overrides) |

## Why `overrides` instead of plain dependabot bumps

Several of the advisories live in packages that no dependency in this repository
requests with a range that admits the patched release (`glob` pins
`brace-expansion@^1.1.7`, `express` requests `qs@^6.14.0`, `@expo/plist` requests
`@xmldom/xmldom@^0.8.8`). npm `overrides` is therefore the supported mechanism to
force the patched release across the whole tree. The lock files remain the
authority for what actually installs, and `npm ci` reproduces it exactly.
