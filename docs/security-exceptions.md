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
| GHSA-vfj7-8cjw-p6xm | high | braces, @angular/build, chokidar, micromatch, jest-editor-support, jest-message-util, @jest/console, @jest/test-result, karma, karma-jasmine, karma-jasmine-html-reporter | `braces@3.0.3` (published 2024-05-21) is the newest release and the advisory covers `*`, so no fixed version exists upstream. It reaches the client lock file only through build and test tooling (`karma` → `chokidar`/`micromatch`, and the `@angular/build` watcher) as a devDependency, and application code never processes brace patterns. |
| GHSA-vcc3-ghjq-m6fr | moderate | decode-uri-component, query-string, @react-navigation/core | The only patched release, `decode-uri-component@0.5.0`, is ESM-only and breaks `query-string` under the CommonJS Jest environment. The parent chain (`@react-navigation/core` → `query-string` → `decode-uri-component@0.2.2`) has no patched release that stays CommonJS-compatible, so the advisory is accepted until React Navigation ships an ESM-ready chain. |
| GHSA-mrhx-c7xc-m3w5 | high | zod, @expo/cli, expo, eslint-plugin-react-hooks, zod-validation-error | `@expo/cli@57.0.15` requires `zod@^3.25.76`, but every release the advisory covers is patched only from `zod@4.6.6` - and `3.25.76` is the newest stable 3.x, so no fixed release exists inside the constraint Expo declares. The copy under `eslint-plugin-react-hooks` is already forced to `4.6.7` by an override; the remaining copy is reached only through the Expo CLI build tooling, not application code. Accepted until Expo CLI moves to zod 4. |

Only the GHSA column, the severity column and the comma-separated package column
are parsed; the last column is human-readable rationale.

## Compatibility floors (not advisories)

`scripts/npm-override-freshness.test.mjs` requires every `overrides` pin to sit on the
latest published release, unless it is listed in that script's `COMPATIBILITY_FLOORS`.
A floor records that a newer major cannot be used, and why.

A floor does **not** suppress anything: the audit gate still fails on every fixable
advisory regardless of what is in this list, so a floor can never be used to silence a
security finding. It only stops the freshness check from demanding a bump that would
break the build.

| Package | Pinned | Latest | Why the newer release cannot be used |
|---------|--------|--------|--------------------------------------|
| `metro`, `metro-config`, `metro-transform-worker` | 0.84.6 | 0.87.1 | Expo SDK 57 / React Native 0.86 request the Metro 0.84 line. 0.84.6 is the first release that drops the `image-size` dependency, and `image-size` 2.x no longer accepts the file-path strings Metro passes to it, which broke `expo export` (and the Android release build). Removable once Expo ships a release on a newer Metro line. |

## Advisories that were fixed

Every other advisory that was open on 2026-10-02 is fixed by pinning the patched
releases in the `overrides` block of `easyfinance.client/package.json` and
`econoflow-mobile/package.json`, together with the version bumps in the
`dependencies`/`devDependencies` blocks:

| Area | Change |
|------|--------|
| Angular SSR | `@angular/*` `22.1.2` → `22.2.1` (SSR XSS, SSRF, DoS, router matrix-parameter DoS) |
| Dev server (Vite) | `vite` → `8.3.5` (launch-editor command execution, `fs.existsSync` bypass on Windows, cross-origin script execution, out-of-scope file disclosure; all cover `8.3.0`–`8.3.2`) |
| HTTP request parsing | `qs` → `6.16.0` |
| URL parsing | `fast-uri@3` → `3.1.8`, `ip-address` → `10.7.3`, `baseline-browser-mapping` → `2.11.27`, `browserslist` → `4.29.3` |
| Build workers | `piscina` → `5.3.2` |
| Dev server / SSR helpers | `hono` → `4.13.12`, `engine.io` → `6.6.11` |
| Brace expansion | `brace-expansion@1` → `1.1.21`, `brace-expansion@5` → `5.0.12` |
| YAML parsing | `js-yaml@3` → `3.15.2` |
| Datetime formatting | `moment` → `^2.31.0` |
| IP spoofing via IPv4-mapped IPv6 trust subnets (`express` → `proxy-addr`) | `proxy-addr` → `2.0.8` |
| Event-loop DoS through indexed source-map sections (`postcss`/`sass` → `source-map-js`) | `source-map-js` → `1.2.2` |
| HTTP client (mobile) | `axios` → `^1.20.0` |
| XML parsing (mobile) | `@xmldom/xmldom@0.8` → `0.8.15`, `@xmldom/xmldom@0.9` → `0.9.12` |
| Fetch/HTTP stack (mobile) | `undici@6` → `6.29.0` |
| YAML parsing (mobile) | `js-yaml@3` → `3.15.2`, `js-yaml@4` → `4.3.2` |
| Image dimension parsing (mobile) | `image-size` → `2.0.4` |
| Response memory-leak DoS (mobile, `@expo/cli` → `compression`) | `compression` → `1.8.2` |
| Command injection in `quote()` (mobile, `react-devtools-core` → `shell-quote`) | `shell-quote` → `1.12.0` |
| Event-loop DoS through indexed source-map sections (mobile, `postcss` → `source-map-js`) | `source-map-js` → `1.2.2` |
| UUID generation (mobile build tooling) | `uuid` → `11.1.1` (via the `@expo/ngrok` and `xcode` overrides) |

## Why `overrides` instead of plain dependabot bumps

Several of the advisories live in packages that no dependency in this repository
requests with a range that admits the patched release (`glob` pins
`brace-expansion@^1.1.7`, `express` requests `qs@^6.14.0`, `@expo/plist` requests
`@xmldom/xmldom@^0.8.8`). npm `overrides` is therefore the supported mechanism to
force the patched release across the whole tree. The lock files remain the
authority for what actually installs, and `npm ci` reproduces it exactly.
