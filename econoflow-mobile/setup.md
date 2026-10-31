# econoflow-mobile — Local Dev Setup

> This file is referenced by `econoflow-mobile/AGENTS.md`. It contains the detailed
> emulator + local API setup guide that was previously inline in that file.

## Dev server (Expo Go + QR scan)

```powershell
cd econoflow-mobile
npx expo start --tunnel -c
```

`.env.local` is applied when Metro serves the bundle, and it currently points at
`https://localhost:7003`. That address is unreachable from Expo Go on a physical phone, so for a
phone run point it at production instead — `.env.local` is git-ignored:

```env
EXPO_PUBLIC_API_URL=https://econoflow.pt
```

Restart Metro after changing it (there is no hot-reload for `EXPO_PUBLIC_*`). This is why the
production domain is one env line away rather than a code change.

**A local backend running on your machine is not reachable from the phone.** Two independent
things have to change:

1. **`appsettings.Development.json`** binds `https://0.0.0.0:7003` (already set up for the
   emulator), but the app under `econoflow.dev` publishes it as `127.0.0.1:7003` — Docker Desktop
   forwards to loopback only. `127.0.0.1` is not an address a phone can connect to.
2. **Windows Firewall** blocks inbound TCP 7003 on a `Public` network profile (Wi-Fi usually is),
   so even a 0.0.0.0-bound process is unreachable from the LAN.

If you really need the phone talking to the local backend:

```powershell
# terminal 1 — backend on every interface
dotnet run --project ./EasyFinance.Server --urls https://0.0.0.0:7003/

# terminal 2 — allow the LAN in on the Wi-Fi profile (admin shell)
New-NetFirewallRule -DisplayName "EconoFlow API 7003" -Direction Inbound -Protocol TCP `
  -LocalPort 7003 -Action Allow -Profile Private

# terminal 3 — point the app at the host's LAN IP (phone must be on the same Wi-Fi)
# .env.local: EXPO_PUBLIC_API_URL=https://192.168.0.234:7003
```

Android then rejects `devcert-emulator.pfx` (its SANs are `10.0.2.2`, `127.0.0.1`, `localhost`) with
`ERR_CERT_COMMON_NAME_INVALID`, so the phone needs one of:

- a per-network dev cert whose SAN includes the LAN IP **and** an Android trust anchor for it
  (Expo Go does not read user-installed CAs, so this effectively means a dev build), or
- a public-CA certificate for the LAN IP, or
- `adb reverse tcp:7003 tcp:7003` plus `EXPO_PUBLIC_API_URL=https://localhost:7003` — this gives
  the phone a tunnel over USB, and the only extra step is trusting the dev cert (Installed CA on
  the phone; Expo Go still won't accept it).

Against production, none of this applies: `https://econoflow.pt` has a real certificate.

---

## Run on connected device / emulator

```powershell
cd econoflow-mobile
npx expo run:android
```

---

## Dev on emulator with local API (localhost:7003)

The Android emulator reaches the host machine at `10.0.2.2` (not `localhost`). Three things must
be configured for the app to talk to the local backend over HTTPS.

### 1. Backend: bind to all interfaces with the emulator cert

`EasyFinance.Server/appsettings.Development.json` must use `devcert-emulator.pfx`, NOT `devcert.pfx`.
This file may not exist by default — if missing, create it with the content below (it's `.gitignore`d so safe to create locally):

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

Files already present in the repo (no action needed unless they were wiped by `npx expo prebuild --clean`):

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
mounted from its own dm-block device. Running `mount --bind` completes without error but is silently
superseded by the APEX block device mount. Embedding the cert in `@raw` bypasses the system store
entirely.

### 3. API URL in .env.local

```env
EXPO_PUBLIC_API_URL=https://10.0.2.2:7003
```

Metro reads this when the JS bundle is served (runtime for debug, build time for release). The fallback in
`src/api/client.ts` is `https://localhost:7003` which only works for web, not the emulator.

**Important:** If Metro is already running when you change this variable, you must restart Metro
for the change to take effect. There is no hot-reload for `EXPO_PUBLIC_*` vars.

### 4. ABI: build for x86_64 only (fast emulator builds)

`android/gradle.properties` already has:
```
reactNativeArchitectures=x86_64
```

This limits the native build to x86_64 — the Pixel_7_API_35 emulator's ABI. Without it, Gradle
compiles for arm64-v8a + armeabi-v7a too (~15 min). x86_64-only takes ~2 min.

## Complete dev workflow

Open **three separate PowerShell windows** and do NOT close them until you're done.

### Terminal 1 — Backend

First, ensure `appsettings.Development.json` exists at `EasyFinance.Server/appsettings.Development.json`:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
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
}
```

Then:

```powershell
# Verify cert config first
Select-String -Path "EasyFinance.Server\appsettings.Development.json" -Pattern "devcert"
# Must show: devcert-emulator.pfx  (NOT devcert.pfx)

# Start backend — do NOT pass --urls flag, let appsettings.Development.json handle binding
dotnet run --project ./EasyFinance.Server
```

### Terminal 2 — Android emulator

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_7_API_35 -no-boot-anim
```

Wait for the emulator to fully boot before moving to Terminal 3 (check with `adb shell getprop sys.boot_completed`).

### Terminal 3 — Build, install & Metro

```powershell
cd econoflow-mobile
$env:EXPO_PUBLIC_API_URL = "https://10.0.2.2:7003"
npx expo run:android
```

This will build the APK (~2-10 min on first run, faster after cached), install it on the emulator, **and start Metro**. Keep this window open — Metro must stay running for the app to load its JavaScript bundle.

### If Metro window was closed (restart Metro without rebuilding)

If the APK is already installed and you only need Metro:

```powershell
cd econoflow-mobile
$env:EXPO_PUBLIC_API_URL = "https://10.0.2.2:7003"
npx expo start --dev-client
```

Then relaunch the app on the emulator:

```powershell
adb shell am start -n pt.econoflow.mobile/.MainActivity
```

If `npx expo run:android` fails during install (Broken pipe / Can't find service: package) —
see Troubleshooting below.

## Integration tests with Detox

The `e2e/` suite drives the real app on a real device and checks the flows the unit tests
cannot: logging in, registering, the PIN, biometrics, and what a restart or a sign-out does
to the stored session. It runs against the **native debug build** — Detox starts the app
through an instrumentation runner that only exists in the androidTest APK — and against the
**local API stack**, because every spec signs in, registers or creates a session for real.

### One-time setup

```powershell
cd econoflow-mobile
npm install
npm run e2e:build                # app-debug.apk + app-debug-androidTest.apk
```

`npm run e2e:build` runs `assembleDebug assembleDebugAndroidTest`. The Detox runner ships as
an `androidTestImplementation` in `android/app/build.gradle`, so the second APK is the one
that connects Detox to the app — building only `assembleDebug` leaves Detox reporting
`No instrumentation runner found on device`.

**Windows and the 260-character path limit — read this first.** The native build of this
checkout (`D:\Sources\EconoFlow\econoflow-mobile`, 38 characters deep) fails on Windows:

```text
ninja: error: Stat(...react-native-safe-area-context/.../ComponentDescriptors.cpp.o):
            Filename longer than 260 characters
```

CMake derives that object-file name from the absolute path of the generated JNI sources under
`node_modules`. Everything tried on this machine failed, and each fix was reverted:

| Attempt | Result |
|---------|--------|
| `npm run android:short-paths` (junction of `node_modules` into `C:\n\econoflow-mobile`) | The AAR and its codegen outputs still resolve to the real `D:\…` path, so `CMakeFiles/…/D_/Sources/…` is unchanged |
| `android.cmakeVersion=3.30.4` (Expo's override; install with `sdkmanager "cmake;3.30.4"`) | Its Ninja handles long *paths*, but the truncation happens in the VS 2008 express-edition CRT parser ninja uses for this, so it still reports the literal `Filename longer than 260 characters` |
| Rewriting `build.ninja` to prefix the offending outputs with a ninja `$` escape | `ninja: error: expected newline, got ':'` — the same CRT truncation is in the MSVC printf used for the parse error itself (reproduced in isolation in `C:\nbuild`) |
| `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled=1` | Already enabled; it only covers tools that opt in |

The path that works is a short one. **This repo on this machine was already set up that way
before Detox was added** (`econoflow-mobile/android` is a junction to
`C:\n\econoflow-mobile\android`, 26 characters deep). To get the APKs:

```powershell
# from the short root, with a short node_modules there (npm run android:short-paths), so the
# generated sources and their object files both live under C:\n\
cd C:\n\econoflow-mobile\android
.\gradlew.bat assembleDebug assembleDebugAndroidTest -PreactNativeArchitectures=x86_64
```

That route was not verified end to end in this environment: the `node_modules` copy under
`C:\n\` was left in an inconsistent state by the sandbox. The alternative — and what most
Detox setups do — is a Linux or macOS CI runner or a CI Docker image, where the limit does
not exist.

### Running the suite

```powershell
# terminal 1 — the API and database the specs use
docker compose -f docker-compose.dev.yml up -d

# terminal 2 — the emulator, and the port bridge the app's EXPO_PUBLIC_API_URL needs
emulator -avd Pixel_7_API_35 &
adb reverse tcp:7003 tcp:7003

# terminal 3
cd econoflow-mobile
npm run e2e:test                       # the whole suite
npx detox test -c android.emu.debug e2e/auth/login.e2e.js   # one spec
npm run e2e:build && npm run e2e:test  # after source changes
```

| Command | What it does |
|---------|--------------|
| `npm run e2e:build` | `assembleDebug` + `assembleDebugAndroidTest` for the emulator's ABI |
| `npm run e2e:test` | builds nothing, installs both APKs and runs `e2e/**/*.e2e.js` |
| `npx detox test -c android.emu.debug --record-logs all` | keeps device logs of passing tests too |
| `npx detox test -c android.emu.debug -r` | reuses the installed build (fastest loop) |

Failure artifacts (screenshots, device log, view hierarchy) land in `e2e/artifacts/`, which is
git-ignored. `DETOX_AVD_NAME` overrides the emulator (`Pixel_7_API_35` by default).

### What the specs assume

- **A device with no PIN.** `signUp.e2e.js` creates the device PIN; the "create a PIN" steps
  of `login.e2e.js` only run on a device that has none. The PIN is stored per device
  (`pinStore`), not per account. After the first full run the PIN belongs to the device, so
  a second run of `e2e/auth/login.e2e.js` alone starts at the PIN screen — wipe the
  emulator (`adb shell pm clear pt.econoflow.mobile`) or install a fresh AVD to repeat it
  exactly.
- **The local stack**, seeded with `EconoFlow_SEED_DEVELOPMENT_DATA=true`: the specs sign in
  as `test1@test.com` / `Passw0rd!`. Registration uses a fresh `e2e+…@econoflow.test`
  address on every run and leaves the account behind, like a real customer would.
- **Notifications are denied** by the specs (`permissions: { notifications: 'deny' }`), so
  the post-login prompt shows its rationale and the specs dismiss it. A biometric prompt is
  never shown: the specs decline biometrics on every path that offers it.
- **The command that starts each spec has to say where.** The app decides its first screen
  from what the device stores, and the activity is `singleTask`, so a plain relaunch keeps
  the navigator that is already up. The specs therefore relaunch at a start URL
  (`econoflow://econoflow-start`) instead of `launchApp`.
- **Specs run in filename order** (`login.e2e.js`, then `signUp.e2e.js`) because the PIN is
  per device: the first spec is the one that signs out of the session left on the emulator
  and creates a PIN for its account, and `signUp.e2e.js` runs its registration after that.

### Troubleshooting

- **`ninja: error: ... Filename longer than 260 characters`** — see the Windows section
  above; the build must run from a short path (or on Linux/macOS).
- **`mergeDebugAndroidTestNativeLibs … libc++_shared.so` from a library module** — the
  `androidTest` variants of the native libraries are not needed (Detox's runner comes from
  the app's androidTest APK); `android/build.gradle` disables their merge task.
- **`Could not get unknown property` / `Failed to apply plugin` in `build.gradle`** — the
  Android project is generated by `npx expo prebuild`; a clean prebuild drops the Detox
  wiring from `android/app/build.gradle` and `android/build.gradle`. Prefer
  `npx expo run:android` normally: it reuses `android/` and keeps both.
- **`No instrumentation runner found on device`** — only the app APK was installed. Run
  `npm run e2e:build` (it also builds `app-debug-androidTest.apk`).
- **A spec times out on the Login screen while the app shows a PIN pad** — the device has
  a PIN from an earlier session. `adb shell pm clear pt.econoflow.mobile`, then launch the
  app once by hand; the next `npm run e2e:test` starts from a fresh state.

## Troubleshooting

**`net::ERR_FAILED`, 0.0 kB, ~600 ms — request never reaches backend**
Backend is serving `devcert.pfx` (CA:TRUE). Fix: update `appsettings.Development.json` to
`devcert-emulator.pfx` and restart the backend process (not just reload config).

**App crashes immediately: `SoLoaderDSONotFoundError: couldn't find DSO to load: libreactnative.so`**
APK was built for ARM but the emulator is x86_64. Fix: ensure `gradle.properties` has
`reactNativeArchitectures=x86_64` and run `npx expo run:android` again.

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

**App launches but shows a blank/white screen or "Cannot connect to Metro"**
Metro is not running or was started without `--dev-client` flag. Fix:
```powershell
# Kill any stale Metro
Get-Process -Name "node" | Where-Object CommandLine -match "expo.*start" | Stop-Process -Force
# Restart Metro with dev-client flag
cd econoflow-mobile
$env:EXPO_PUBLIC_API_URL = "https://10.0.2.2:7003"
npx expo start --dev-client
# Then relaunch app
adb shell am start -n pt.econoflow.mobile/.MainActivity
```

**Backend fails to start or immediately exits (port already in use)**
A stale dotnet process is holding port 7003. Fix:
```powershell
$pid = netstat -ano | Select-String "0.0.0.0:7003.*LISTENING" | ForEach-Object { $_ -replace '.*\s+(\d+)\s*$', '$1' }
if ($pid) { Stop-Process -Id $pid -Force; Start-Sleep -Seconds 3 }
dotnet run --project ./EasyFinance.Server
```

## Cert file reference

| File | Type | SAN | CA:TRUE? | Role |
|------|------|-----|----------|------|
| `~/.econoflow/devcert.pfx` | Self-signed CA | `localhost`, `10.0.2.2`, `127.0.0.1` | Yes | **Do NOT use for Kestrel** — Android rejects it as a server cert |
| `~/.econoflow/devcert-emulator.pfx` | Self-signed end-entity | `localhost`, `10.0.2.2`, `127.0.0.1` | No | Kestrel server cert for emulator dev |
| `~/.econoflow/devcert-emulator.pem` | Public key (PEM) | — | — | Bundled in APK as `@raw/devcert_emulator` |
