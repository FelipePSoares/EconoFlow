# econoflow-mobile — Local Dev Setup

> This file is referenced by `econoflow-mobile/AGENTS.md`. It contains the detailed
> emulator + local API setup guide that was previously inline in that file.

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
