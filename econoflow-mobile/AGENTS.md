# econoflow-mobile

## MANDATORY Development Workflow

> **Every code change — no matter how small — must complete all four steps in order. There are no exceptions. A task is not done when the code compiles or looks correct. A task is done only when all four steps below are fully satisfied.**

**Definition of "done":**
- [ ] Failing tests were written and confirmed red before any implementation code was touched
- [ ] Implementation is complete
- [ ] All tests pass, typecheck is clean, and lint is clean
- [ ] Architecture compliance self-review passed with no violations

Skipping any step means the task is incomplete, regardless of whether the code appears to work.

---

### Step 1 — Write failing tests FIRST

**STOP. Do not open any implementation file yet.**

- Find the existing test file alongside the file you are about to change (`*.test.ts` / `*.test.tsx`).
- Write or update the tests that cover the new or modified behaviour.
- Run them and confirm they **fail**:
  ```bash
  cd econoflow-mobile && npm test
  ```
  Tests that were never red prove nothing — a green test written after the implementation does not count.

Only after you have a failing test may you move to Step 2.

### Step 2 — Implement the change

- Follow all architecture patterns documented in this file.
- Keep changes focused: do not refactor unrelated code in the same commit.

### Step 3 — Run tests, typecheck, and lint

```bash
cd econoflow-mobile && npm test && npm run typecheck && npm run lint
```

**STOP. Do not proceed to Step 4 if any test fails, any type error exists, or any lint warning exists** (`--max-warnings 0` is enforced). Fix every failure first.

### Step 4 — Architecture compliance self-review

Verify every item below before marking the task done — quote the offending line when a violation is found:

- [ ] No hard-coded user-visible strings — use `react-i18next` (`useTranslation` / `i18next.t()`); translation keys added to `src/i18n/locales/`
- [ ] No hard-coded colour values — all colours come from `useAppTheme()` (`theme.colors.*` / `theme.customColors.*`)
- [ ] Global auth/project state lives in Zustand stores under `src/store/`; remote state uses React Query
- [ ] All HTTP goes through the Axios instance in `src/api/client.ts`
- [ ] API URL read from `EXPO_PUBLIC_API_URL` — never hard-coded
- [ ] New screens registered in `src/navigation/` — no ad-hoc navigation
- [ ] User-facing errors use `ErrorBanner` (`src/components/common/ErrorBanner.tsx`)
- [ ] Sensitive data stored via `expo-secure-store`, not `AsyncStorage`
- [ ] No API keys, tokens, or secrets in source files, `app.json`, or `EXPO_PUBLIC_*` variables
- [ ] Every new exported function or component has a corresponding Jest test
- [ ] `econoflow-mobile/AGENTS.md` or repo-root `AGENTS.md` updated if the change introduces new patterns or configuration

**The task is not complete until tests are green, typecheck and lint are clean, and every checklist item above is confirmed.**

---

React Native 0.85 + Expo SDK 56 app. Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## Build (release APK)

The release build uses `expo prebuild --clean` to regenerate the native project from scratch, which wipes all manual additions to `android/` (emulator cert, network security config, etc.). That is intentional — the release APK targets production and must not contain dev certs.

```powershell
cd econoflow-mobile

# 1. Regenerate native Android project from app.json (wipes android/)
$env:EXPO_PUBLIC_API_URL = "https://econoflow.pt"
npx expo prebuild --platform android --no-install --clean

# 2. Generate a release signing keystore (one-time)
keytool -genkey -v `
  -keystore "$env:USERPROFILE\.android\release.keystore" `
  -storepass android -alias econoflow -keypass android `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -dname "CN=EconoFlow,O=EconoFlow,C=PT"

# 3. Build release APK — MUST override reactNativeArchitectures for ARM devices
$env:JAVA_HOME = "C:\tools\jdk-17.0.13+11"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$env:EXPO_PUBLIC_API_URL = "https://econoflow.pt"
$keystore = "$env:USERPROFILE\.android\release.keystore"

cd android
.\gradlew assembleRelease `
  -PreactNativeArchitectures=arm64-v8a,armeabi-v7a `
  "--project-prop=android.injected.signing.store.file=$keystore" `
  "--project-prop=android.injected.signing.store.password=android" `
  "--project-prop=android.injected.signing.key.alias=econoflow" `
  "--project-prop=android.injected.signing.key.password=android" `
  --no-daemon

# APK will be at: android/app/build/outputs/apk/release/app-release.apk
```

**Why `-PreactNativeArchitectures=arm64-v8a,armeabi-v7a` is required:** `android/gradle.properties`
defaults to `x86_64` (for fast emulator builds). Physical Android devices are ARM. Omitting this flag
produces an x86_64-only APK that physical phones refuse to install.

**Why `abiFilters` is NOT in `app.json`:** It was there as `["x86_64"]` which would bake the x86_64
restriction into `build.gradle` after every prebuild, breaking the release APK. It was removed.
`reactNativeArchitectures` in `gradle.properties` is the correct single place to control ABI scope.

## Build (debug APK — no signing needed)

```powershell
cd econoflow-mobile/android
.\gradlew assembleDebug --no-daemon
# APK at: android/app/build/outputs/apk/debug/app-debug.apk
```

## Dev server (Expo Go + QR scan)

```powershell
cd econoflow-mobile
npx expo start
```

## Run on connected device / emulator

```powershell
cd econoflow-mobile
npx expo run:android
```

## Dev on emulator with local API (localhost:7003)

The Android emulator reaches the host machine at `10.0.2.2` (not `localhost`). Three things must
be configured for the app to talk to the local backend over HTTPS.

### 1. Backend: bind to all interfaces with the emulator cert

`EasyFinance.Server/appsettings.Development.json` must use `devcert-emulator.pfx`, NOT `devcert.pfx`:

```json
"Kestrel": {
  "Endpoints": {
    "Https": { "Url": "https://0.0.0.0:7003" }
  },
  "Certificates": {
    "Default": {
      "Path": "C:\\Users\\felip\\.econoflow\\devcert-emulator.pfx",
      "Password": "econoflow"
    }
  }
}
```

**Why `devcert-emulator.pfx` and not `devcert.pfx`:** `devcert.pfx` has `basicConstraints: CA:TRUE`.
Android's Conscrypt TLS stack (API 35) rejects a CA cert when used as a TLS server cert. The symptom
is `net::ERR_FAILED` with 0.0 kB and ~600 ms — requests never reach the backend even though TCP
connectivity to `10.0.2.2:7003` works fine. `devcert-emulator.pfx` is a self-signed end-entity cert
(no CA constraint) with `serverAuth` EKU and SANs covering `10.0.2.2`, `127.0.0.1`, and `localhost`.

**After editing `appsettings.Development.json` the backend must be restarted** — Kestrel reads the
cert at startup only.

Verify before starting the backend:
```powershell
Select-String -Path "EasyFinance.Server\appsettings.Development.json" -Pattern "devcert"
# Expected: devcert-emulator.pfx  (NOT devcert.pfx)
```

### 2. App: trust the dev cert via network security config

The cert is embedded directly in the APK and referenced from the network security config. This is
the only reliable approach on API 35 — the traditional system cert store bind-mount injection does
not work (see Why below).

Files already present in the repo (no action needed unless they were wiped by `prebuild --clean`):

- `android/app/src/main/res/raw/devcert_emulator.pem` — the cert public key
- `android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">10.0.2.2</domain>
    <trust-anchors>
      <certificates src="@raw/devcert_emulator" />
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </domain-config>
</network-security-config>
```

- `android/app/src/main/AndroidManifest.xml` must include:

```xml
<application android:networkSecurityConfig="@xml/network_security_config" ...>
```

**If `npx expo prebuild --clean` was run** (it wipes `android/`), re-apply these three files:
```powershell
# From repo root:
New-Item -ItemType Directory -Force econoflow-mobile\android\app\src\main\res\raw
cp $env:USERPROFILE\.econoflow\devcert-emulator.pem `
   econoflow-mobile\android\app\src\main\res\raw\devcert_emulator.pem
# Then restore network_security_config.xml and AndroidManifest.xml changes manually.
```

**Why the bind-mount approach doesn't work on API 35:** `/apex/com.android.conscrypt/cacerts` is
mounted from its own dm-block device (`dm-46`). Running `mount --bind /data/local/tmp/ca-overlay
/apex/com.android.conscrypt/cacerts` completes without error but is silently superseded by the APEX
block device mount. The cert files appear in the directory listing (persisted from a previous write)
but the trust evaluation uses the APEX-mounted store, not the overlay. Embedding the cert in `@raw`
bypasses the system store entirely.

### 3. API URL in .env.local

```env
EXPO_PUBLIC_API_URL=https://10.0.2.2:7003
```

Metro bakes this into the JS bundle at runtime (debug) or build time (release). The fallback in
`src/api/client.ts` is `https://localhost:7003` which only works for web, not the emulator.

### 4. ABI: build for x86_64 only (fast emulator builds)

`android/gradle.properties` already has:
```
reactNativeArchitectures=x86_64
```

This limits the native build to x86_64 — the Pixel_7_API_35 emulator's ABI. Without it, Gradle
compiles for arm64-v8a + armeabi-v7a too (~15 min). x86_64-only takes ~2 min.

**arm64 APKs crash immediately on x86_64 emulators** with
`SoLoaderDSONotFoundError: couldn't find DSO to load: libreactnative.so` because JNI libraries are
architecture-specific and the emulator cannot translate them. Always build for x86_64 for emulator
dev, and always pass `-PreactNativeArchitectures=arm64-v8a,armeabi-v7a` for release.

### Complete dev workflow

```powershell
# --- Step 0: verify the backend cert config ---
Select-String -Path "EasyFinance.Server\appsettings.Development.json" -Pattern "devcert"
# Must show: devcert-emulator.pfx

# Terminal 1 — start backend
dotnet run --project ./EasyFinance.Server

# Terminal 2 — start emulator
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_7_API_35 -no-boot-anim

# Terminal 2 — build and run (cert trust is embedded in the APK, no adb injection needed)
cd econoflow-mobile
$env:EXPO_PUBLIC_API_URL = "https://10.0.2.2:7003"
npx expo run:android
```

If `npx expo run:android` fails during install (Broken pipe / Can't find service: package) —
see Troubleshooting below.

### Troubleshooting

**`net::ERR_FAILED`, 0.0 kB, ~600 ms — request never reaches backend**
Backend is serving `devcert.pfx` (CA:TRUE). Fix: update `appsettings.Development.json` to
`devcert-emulator.pfx` and restart the backend process (not just reload config).

**App crashes immediately: `SoLoaderDSONotFoundError: couldn't find DSO to load: libreactnative.so`**
APK was built for ARM (`arm64-v8a`) but the emulator is x86_64. Fix: rebuild with
`-PreactNativeArchitectures=x86_64` or ensure `gradle.properties` has `reactNativeArchitectures=x86_64`.

**`adb install` fails: `Broken pipe (32)` or `Can't find service: package`**
Package manager crashed mid-transfer. Fix: cold-boot the emulator, then install manually:
```powershell
adb emu kill
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_7_API_35 -no-boot-anim -no-snapshot-load
# wait for boot, then:
adb install -r -d "econoflow-mobile\android\app\build\outputs\apk\debug\app-debug.apk"
cd econoflow-mobile; npx expo start --dev-client
adb shell am start -n pt.econoflow.mobile/.MainActivity
```

**`adb install` is interrupted mid-way — never force-kill it.** The package becomes frozen
(`SecurityException: Package is currently frozen`) and the only fix is a cold boot.

### Cert file reference

| File | Type | SAN | CA:TRUE? | Role |
|------|------|-----|----------|------|
| `~/.econoflow/devcert.pfx` | Self-signed CA | `localhost`, `10.0.2.2`, `127.0.0.1` | Yes | **Do NOT use for Kestrel** — Android rejects it as a server cert |
| `~/.econoflow/devcert-emulator.pfx` | Self-signed end-entity | `localhost`, `10.0.2.2`, `127.0.0.1` | No | Kestrel server cert for emulator dev |
| `~/.econoflow/devcert-emulator.pem` | Public key (PEM) | — | — | Bundled in APK as `@raw/devcert_emulator` |

## Theme

The app uses react-native-paper MD3 theming with custom semantic colours defined in `App.tsx`:

| Role        | Light      | Dark       |
|-------------|------------|------------|
| primary     | `#0f76a8`  | `#4da7d6`  |
| secondary   | `#0c628c`  | `#6db8df`  |
| tertiary    | `#2ecc71`  | `#2ecc71`  |
| error       | `#e74c3c`  | `#e74c3c`  |
| background  | `#f5f8fc`  | `#0f1724`  |
| surface     | `#ffffff`  | `#172233`  |
| onSurface   | `#0d2137`  | `#e6edf3`  |

Custom tokens (`theme.customColors` from `useAppTheme()` hook):
`success`, `warning`, `income`, `expense`, `accentGreen`

## Key patterns

- **API client**: `src/api/client.ts` — Axios instance with token refresh interceptor
- **Env var for API URL**: `EXPO_PUBLIC_API_URL` (default: `https://localhost:7003`, no `/api` suffix)
- **State**: Zustand stores in `src/store/` for auth & project; React Query for server state
- **Navigation**: `@react-navigation/native-stack` + `bottom-tabs` in `src/navigation/`
- **i18n**: `react-i18next` with JSON files in `src/i18n/locales/`
- **Theme hook**: `useAppTheme()` from `src/theme/useAppTheme.ts` — wraps Paper's `useTheme` with custom colour types
- **Error handling**: `ErrorBanner` component at `src/components/common/ErrorBanner.tsx`

## Monitoring (Sentry)

Package: `@sentry/react-native` (~7.11.0).  
Central module: `src/monitoring/sentry.ts` — all Sentry interactions go through here.

### Env vars

| Variable | Where to set | Purpose |
|---|---|---|
| `EXPO_PUBLIC_SENTRY_DSN` | `.env.local` (dev) / PowerShell session (release) | Sentry ingest endpoint |

The DSN is a **public** identifier (not a secret). It is intentionally embedded in the JS bundle.  
Sentry is **disabled in development** (`enabled: !__DEV__`), so no events are sent during local runs.

### Release build — add to the PowerShell session before Gradle

```powershell
$env:EXPO_PUBLIC_API_URL    = "https://econoflow.pt"
$env:EXPO_PUBLIC_SENTRY_DSN = "https://..."   # ← required for crash reporting
```

### Usage in application code

```typescript
import { captureError, addBreadcrumb } from '../monitoring/sentry';

// In a try/catch:
try {
  await riskyOperation();
} catch (err) {
  captureError(err, { screen: 'ExpenseFormScreen', action: 'submit' });
}

// Manual breadcrumb (optional context for the next error):
addBreadcrumb('User opened QuickAdd modal', 'ui');
```

### Privacy rules
- **Never** pass financial amounts, email, name, or any PII into `captureError` context or `addBreadcrumb` data.
- The `beforeSend` hook in `sentry.ts` strips `Authorization` headers automatically.
- User context is set to the **user ID only** (`setUserContext(user.id)`) — no email, no name.
- HTTP breadcrumbs log **method + URL** only — never request or response bodies.
