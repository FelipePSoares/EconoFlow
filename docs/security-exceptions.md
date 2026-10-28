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

Every row below was re-checked against the GitHub Advisory Database and against the
lock files on 2026-10-28, after the Expo SDK 58 / React Native 0.88 upgrade.

| GHSA | Severity | Packages | Reason it cannot be patched here |
|------|----------|----------|----------------------------------|
| GHSA-86w9-cpqp-85rv | high | node-forge, @expo/code-signing-certificates, @expo/cli, expo | The advisory covers `node-forge <= 1.4.0` and the database publishes **no patched version at all**; `1.4.2` is what is installed, and it is the newest release on npm. It reaches the mobile lock file only through `@expo/cli` → `@expo/code-signing-certificates` (an Expo CLI build-time dependency of the manifest-signing path) and is never invoked by application code. Removable when node-forge publishes a fix and Expo picks it up. |
| GHSA-vfj7-8cjw-p6xm | high | braces, @angular/build, chokidar, micromatch, jest-editor-support, jest-message-util, @jest/console, @jest/test-result, karma, karma-jasmine, karma-jasmine-html-reporter | `braces@3.0.3` (published 2024-05-21) is the newest release on npm and the advisory covers `<= 3.0.3` with no patched version published. Both lock files resolve that exact version, and it reaches them only through build and test tooling (`karma` → `chokidar`/`micromatch`, and the `@angular/build` watcher) as a devDependency; application code never processes brace patterns. GitHub withdrew this advisory on 2026-10-23, but it is still reported by `npm audit`, so the row has to stay until the withdrawal reaches the registry feed `npm audit` reads. |
| GHSA-mrhx-c7xc-m3w5 | high | zod, @expo/cli, expo | The advisory covers `zod < 4.6.6` and is fixed in `4.6.6`. Both projects already resolve a patched copy at the root: `easyfinance.client` pins `4.6.6` and `econoflow-mobile` overrides `zod@4` to `4.6.7`. The single leftover copy is `zod@3.25.76` nested under `expo/node_modules`, because `@expo/cli@58.1.16` still requires `zod@^3.25.76` and `3.25.76` is the newest 3.x release. Only Expo CLI build tooling loads it; application code never does. Removable once Expo CLI moves to zod 4. |
| GHSA-vcc3-ghjq-m6fr | moderate | decode-uri-component, query-string, @react-navigation/core | The patched releases, `decode-uri-component` `0.4.0` and later, are ESM-only (`"type": "module"`) and `query-string@7` loads it with `require()`, so forcing a patched copy from the `overrides` block breaks the CommonJS Jest environment the mobile tests run in. The chain is `@react-navigation/core@7.21.12` → `query-string@^7.1.3` → `decode-uri-component@0.2.2`; `@react-navigation/core@7.22.1` drops `query-string` entirely, so this row disappears once `@react-navigation/native` is bumped. |

Only the GHSA column, the severity column and the comma-separated package column
are parsed; the last column is human-readable rationale.

`@expo/cli` and `expo` are listed against the node-forge and zod rows because
`npm audit` traces through them to reach those packages. They are carriers, not
separate findings - the two packages that actually carry an advisory are
`node-forge` and `zod`.

## Advisories that need no exception

The `easyfinance.client` lock file is currently **free of every advisory**, so the
audit gate there accepts nothing at all. The mobile lock file has no accepted
`critical` advisory, and nothing besides the rows above.

A row should be deleted rather than rewritten when its advisory stops being
reported - the gate fails on anything not listed, so a stale row costs nothing
until somebody assumes it is still accurate.

## Compatibility floors (not advisories)

`scripts/npm-override-freshness.test.mjs` requires every `overrides` pin to sit on the
latest published release, unless it is listed in that script's `COMPATIBILITY_FLOORS`.
A floor records that a newer major cannot be used, and why.

A floor does **not** suppress anything: the audit gate still fails on every fixable
advisory regardless of what is in this list, so a floor can never be used to silence a
security finding. It only stops the freshness check from demanding a bump that would
break the build.

There are currently **no** compatibility floors. The three Metro floors that used to
live here were removed with the Expo SDK 58 / React Native 0.88 upgrade, which moved
Expo onto a Metro line that no longer needs them.

## Advisories that were fixed

Every other advisory that was open on 2026-10-02 is fixed by pinning the patched
releases in the `overrides` block of `easyfinance.client/package.json` and
`econoflow-mobile/package.json`, together with the version bumps in the
`dependencies`/`devDependencies` blocks:

| Area | Change |
|------|--------|
| Angular SSR | `@angular/*` `22.1.2` → `22.2.1` (SSR XSS, SSRF, DoS, router matrix-parameter DoS) |
| Dev server (Vite) | `vite` → `8.3.5` (launch-editor command execution, `fs.existsSync` bypass on Windows, cross-origin script execution, out-of-scope file disclosure; all cover `8.3.0`–`8.3.2`) |
| HTTP request parsing | `qs` → `6.17.0` |
| URL parsing | `fast-uri@3` → `3.1.9`, `browserslist` → `4.29.5`, `baseline-browser-mapping` → `2.11.34` |
| Build workers | `piscina` → `5.3.2` |
| Dev server / SSR helpers | `engine.io` → `6.6.11` |
| Brace expansion | `brace-expansion@1` → `1.1.21`, `brace-expansion@5` → `5.0.12` |
| YAML parsing | `js-yaml@3` → `3.15.2` |
| Datetime formatting | `moment` → `^2.31.0` |
| IP spoofing via IPv4-mapped IPv6 trust subnets (`express` → `proxy-addr`) | `proxy-addr` → `2.0.8` |
| Event-loop DoS through indexed source-map sections (`postcss`/`sass` → `source-map-js`) | `source-map-js` → `1.2.2` |
| HTTP client (mobile) | `axios` → `^1.20.0` |
| XML parsing (mobile) | `@xmldom/xmldom@0.8` → `0.8.15`, `@xmldom/xmldom@0.9` → `0.9.12` |
| Fetch/HTTP stack (mobile) | `undici@6` → `6.29.0` |
| YAML parsing (mobile) | `js-yaml@3` → `3.15.2`, `js-yaml@4` → `4.3.2` |
| Response memory-leak DoS (mobile, `@expo/cli` → `compression`) | `compression` → `1.8.2` |
| Command injection in `quote()` (mobile, `react-devtools-core` → `shell-quote`) | `shell-quote` → `1.12.0` |
| Event-loop DoS through indexed source-map sections (mobile, `postcss` → `source-map-js`) | `source-map-js` → `1.2.2` |
| UUID generation (mobile build tooling) | `uuid` → `14.0.3` (via the `@expo/ngrok` and `xcode` overrides) |

## Dead pins

The `overrides` block of `easyfinance.client/package.json` still carries pins for
packages that no longer exist anywhere in the dependency graph: `hono` and
`ip-address`, and perhaps others, after the `express` 5 / `@angular/build` bumps moved
their parents. npm ignores an override that matches nothing, so they are harmless,
but they are dead weight and they mislead anyone reading the block as a current
inventory of what is pinned and why. They should be deleted when the block is next
touched, not kept as a record of past fixes.

## Why `overrides` instead of plain dependabot bumps

Several of the advisories live in packages that no dependency in this repository
requests with a range that admits the patched release (`glob` pins
`brace-expansion@^1.1.7`, `express` requests `qs@^6.14.0`, `@expo/plist` requests
`@xmldom/xmldom@^0.8.8`). npm `overrides` is therefore the supported mechanism to
force the patched release across the whole tree. The lock files remain the
authority for what actually installs, and `npm ci` reproduces it exactly.
