# Running the mobile e2e suite on WSL

The Detox suite in [`econoflow-mobile/e2e/`](../../e2e/) drives the real app on a real Android
emulator against the real API stack. On this machine it runs **entirely inside the Ubuntu WSL
distro**: the API stack (Docker), the emulator (KVM), Metro, the APK build and the suite. Windows
is only the editor — nothing on the Windows side is needed at run time.

> **Read this before you start.** Sections 1–7 were executed on this machine, in this order, and
> work as written (re-verified end to end after the emulator was restarted). For what used to
> stop the suite and what was wrong with it, see
> [Root causes found and fixed](#root-causes-found-and-fixed).

**How to drive this from an agent.** Every command below is written for that agent: one
`wsl -d Ubuntu -- bash -lc '<command>'` call per step, self-contained. Two things bite:

- **Never nest `$(...)` or pipes inside an inline command** — the Windows → bash quoting mangles
  them. Put anything non-trivial in a small `.sh` file and run that file instead.
- An agent needs the user's sudo password for two steps (swappiness, swap). Substitute the real
  password for `<SUDO_PASSWORD>`.

---

## 0. Facts worth knowing first (each one cost time to find)

| Fact | Why it matters |
|------|----------------|
| The build **cannot** happen on Windows (CMake object names pass 260 characters) | Do not run `npm run e2e:build` on `D:\…`; build in WSL at `~/econoflow` |
| `~/econoflow` is the Linux **working copy** | Sourced from the Windows checkout with `rsync`; `/mnt/d` is far too slow to build on |
| A debug APK carries **no JS bundle** — it loads it from **Metro** | Metro must be running, or Detox reports `Failed to run application on the device` |
| The app reaches the API at `http://localhost:7003` **over `adb reverse`** | That is what `.env.local` says; do not switch to `10.0.2.2` or HTTPS |
| The app's JavaScript **cannot log to logcat** — it needs a native sink | `console.log`/`warn`/`error` never appear, with or without Detox; see §0.4 |
| Detox needs **`com.wix.detox.DetoxJUnitRunner`** *and* a **`DetoxTest`** JUnit class | Both come from `scripts/apply-detox-android.js`; the AAR's runner alone is not enough |
| App id `pt.econoflow.mobile`, test APK `pt.econoflow.mobile.test` | `pm clear` on the first can leave the second gone — check the instrumentation after installing |
| Detox **shards spec files by expected duration**, not by filename | `01-`/`02-`/`03-` names record the intended order; a spec must not *depend* on it |
| The emulator must be started **detached** (`setsid`) | Otherwise it dies together with the `wsl` invocation that started it |
| The app's `localhost` is the **device's** localhost — only `adb reverse` makes it the host's | The bridge is re-created by nothing. Check it before blaming the app (see §0.1) |
| A screenshot of a blank screen is usually the **launcher**, not the app | Detox force-stops the app when its instrumentation finishes; check `pidof`/`dumpsys activity` first (§0.2) |

### 0.1 `adb reverse` — the first thing to check, every time

The app calls `http://localhost:7003` (`EXPO_PUBLIC_API_URL` in `.env.local`; `.env` names
production and must not win — see §0.3). On an Android device/emulator `localhost` is **the
device**, so the request only reaches the stack through a reverse bridge:

```bash
adb reverse --list                     # must show tcp:7003 and tcp:8081
adb reverse tcp:7003 tcp:7003          # the API
adb reverse tcp:8081 tcp:8081          # Metro (a debug APK loads its JS from it)
```

**The rules are silently lost** by `adb kill-server`, `adb root`, an emulator restart, or a
`wsl --terminate`. Nothing recreates them on its own, and the failure mode is a lie: login
answers **"Incorrect login information!"**, because a connection refused to the device's own
loopback is reported by the screen as bad credentials. From then on the session code never
runs, so every symptom after that point is invented.

Diagnose it before anything else — the script answers "is the app's request reaching the
host?" in one call:

```bash
wsl.exe -d Ubuntu -- bash -lc 'bash /mnt/d/Sources/EconoFlow/econoflow-mobile/scripts/wsl/api-check.sh'
wsl.exe -d Ubuntu -- bash -lc 'bash /mnt/d/Sources/EconoFlow/econoflow-mobile/scripts/wsl/mobile-login-check.sh'
```

`api-check.sh` reports the env files, the stack, and whether the reverse rules exist;
`mobile-login-check.sh` posts the seeded login **from the device** and prints what came back.
A host-side `curl` proves nothing about the emulator — that is how this was missed.

`scripts/wsl/e2e.sh` re-establishes both rules before every run. If a spec is run by hand
(`npx detox test …`), set them first.

### 0.2 "The app went blank" is usually the app being killed

A run that ends — or a spec that finishes — makes Detox stop the instrumentation, and Android
then **force-stops the app**. The next screenshot is the launcher: a white or busy home
screen that reads exactly like "the app renders nothing". Before diagnosing a blank screen:

```bash
adb shell pidof pt.econoflow.mobile            # empty = the process is gone
adb shell dumpsys activity activities | grep topResumedActivity
adb shell dumpsys activity exit-info pt.econoflow.mobile | grep -E 'reason|description'
```

`reason=10 (USER REQUESTED) subreason=21 (FORCE STOP) … due to finished inst` means the
harness killed it — **not** an app crash. `scripts/wsl/crash-reason.sh` prints all three, and
`scripts/wsl/view-tree.sh` shows whether the screen in the screenshot belongs to the app or to
`com.google.android.apps.nexuslauncher`.

A real crash shows in `adb logcat -b crash`; a real JS failure shows as an `AndroidRuntime`
or `ReactNativeJS` error. Both are absent when the app was merely stopped.

### 0.3 The two env files, and which wins

`.env` holds `EXPO_PUBLIC_API_URL=https://econoflow.pt`; `.env.local` overrides it with
`http://localhost:7003`. Expo loads `.env` first and `.env.local` second, so **local wins** —
but Metro inlines the value into the bundle, so a stale bundle (or a missing `.env.local`) can
still send the emulator at production. `api-check.sh` prints both files in load order.

### 0.4 Getting the app to say what it is doing — the trail

Diagnosing #1116 cost hours for one reason: the app could not say what it was doing, and five
different logging approaches silently recorded nothing. What was measured, in order:

| Attempt | Result | Why |
|---------|--------|-----|
| `console.log` / `.warn` / `.error` in app code | **nothing in logcat** | verified at `App.tsx` module scope *and* in a screen body, with and without Detox |
| React Navigation's own errors | **appear** | they go through React Native's internal reporter, not the JS console |
| `expo-file-system` writes | no file appeared | and before `adb root`, `files/` was unreadable from the host anyway |
| a debug overlay on screen | worked | but logs belong in logcat, not on the screen |
| **a local Expo module calling `Log.i`** | **works** | `scripts/wsl/trail.sh` |

**Read the trail:**

```bash
scripts/wsl/trail.sh            # this app run's events, numbered
scripts/wsl/trail.sh clear      # before a reproduction
scripts/wsl/trail.sh save out.txt
```

Output is one line per event on the tag `EconoFlowTrace`:

```
1 diagnostics.init {"source":"expo.modules"}
2 app.entry {"pid":"js"}
3 appgate.mount-session {"pinKnown":true,"biometricKnown":true}
4 session.mount {"entry":"PinSetup","hasPin":false,"biometricEnabled":false}
```

**`diagnostics.init` is the first event and it always fires.** Its `source` says how the native
sink bound (`expo.modules` / `NativeModules` / `none`). If it is missing, nothing is calling
`trace()` — the problem is the bundle, not the sink. `bundle-check.sh` answers that: it fetches
the bundle Metro is serving and greps for `diagnostics.init`.

**Four things must all be right**, and each one fails silently:

1. **`modules/econoflow-log`** is a local Expo module, listed in `package.json` as
   `"econoflow-log": "file:./modules/econoflow-log"`.
2. **`android/build.gradle` exists in the module.** Without it Gradle skips the module entirely
   and the build still "succeeds" — `gradle-module-check.sh` must print
   `> Configure project :econoflow-log`.
3. **`expo-module.config.json` lists the class** under `android.modules`
   (`["expo.modules.econoflowlog.EconoFlowLogModule"]`). Without it the class compiles into the
   APK, appears in nothing, and every JS call is a silent no-op.
4. **The class extends `expo.modules.kotlin.modules.Module`** — the type Expo's generated
   `ExpoModulesPackageList.kt` maps (`Map<Class<out Module>, String?>`). Extending
   `io.github.expo.modules.v2.Module` fails the build with a type mismatch *in generated code*.

Verify with, in this order:

```bash
scripts/wsl/module-check.sh          # files, dependency, autolinking
scripts/wsl/gradle-module-check.sh    # Gradle includes the project
scripts/wsl/apk-module-check.sh econoflowlog   # the class is inside the APK
scripts/wsl/bundle-check.sh           # the served bundle has the current JS
scripts/wsl/native-cycle.sh 35        # sync → build → install → launch → read the trail
```

**And the sync bug that hid all of it:** `sync.sh` used `--exclude android`, which rsync applies
to *every* directory of that name — including `modules/econoflow-log/android`. The native source
never reached the Linux working copy. The exclude is now anchored (`/android`). `file:`
dependencies are re-symlinked to the synced copy for the same reason.

---

## 1. Prerequisites (once per WSL distro)

`bootstrap.sh` (as root) and `setup.sh` (no root) are the one-time preparations — read their
headers. To verify the current state:

```bash
wsl.exe -d Ubuntu -- bash -lc 'bash /mnt/d/Sources/EconoFlow/econoflow-mobile/scripts/wsl/state.sh'
```

Expected: `/dev/kvm` opens read-write (**KVM is mandatory**; software emulation is unusable),
docker daemon answers, SDK has `emulator/` + `platform-tools/adb`. After `setup.sh`,
`~/.android-hosts.env` holds `ANDROID_HOME=/home/felipe/android-sdk` (emulator 37.2.13, adb 37.0.1),
`JAVA_HOME=/home/felipe/.local/jdk-17`, and `~/.local/node` is v20.19.5. AVD: `Pixel_7_API_35`
(`system-images;android-35;google_apis;x86_64`). Missing emulator/AVD:
`bash /mnt/d/Sources/EconoFlow/econoflow-mobile/scripts/wsl/install-emulator.sh`.

---

## 2. Start the API stack

The specs sign in as the seeded `test1@test.com` / `Passw0rd!` and register accounts for real, so
they need the local stack **with dev data** (`EconoFlow_SEED_DEVELOPMENT_DATA=true` is already set
in `docker-compose.dev.yml`).

```bash
wsl.exe -d Ubuntu -- bash -lc 'cd ~/econoflow-repo && docker compose -f docker-compose.dev.yml up -d && docker compose -f docker-compose.dev.yml ps'
```

(`scripts/wsl/stack.sh up` does the same with a readiness wait; it expects the repository at
`~/econoflow-repo`.)

Verify — both must succeed:

```bash
wsl.exe -d Ubuntu -- bash -lc 'curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:7003/api/AccessControl/'
wsl.exe -d Ubuntu -- bash -lc 'curl -s -o /dev/null -w "%{http_code}\n" -H "Content-Type: application/json" -H "X-Client-Type: mobile" -d "{\"email\":\"test1@test.com\",\"password\":\"Passw0rd!\"}" http://127.0.0.1:7003/api/AccessControl/login'
```

`401` and `200` respectively.

---

## 3. Prepare the Linux working copy

`~/econoflow` is a copy of `econoflow-mobile`, built in place. Refresh it with this script (save
it as a file — see the quoting note above):

```bash
#!/usr/bin/env bash
set -euo pipefail
SRC=/mnt/d/Sources/EconoFlow/econoflow-mobile
rsync -a --delete --exclude node_modules --exclude android --exclude .git \
  --exclude e2e/artifacts --exclude .expo "$SRC/" ~/econoflow/
rsync -a --delete "$SRC/node_modules/" ~/econoflow/node_modules/    # ~10 min, once
mkdir -p ~/econoflow/e2e/artifacts
```

- **`.env.local` matters** and is git-ignored — it must contain
  `EXPO_PUBLIC_API_URL=http://localhost:7003`. Recreate it if missing.
- After changing **JS/TS or e2e specs** only: sync `e2e/` and `scripts/`, skip the rebuild (Metro
  serves the bundle).
- After changing `app.json`, plugins, `scripts/apply-detox-android.js` or native config: rebuild
  (section 4).

---

## 4. Build the two APKs

```bash
wsl.exe -d Ubuntu -- bash -lc 'cd ~/econoflow && . ~/.android-hosts.env && npx expo prebuild -p android --no-install && node scripts/apply-detox-android.js && cd android && ./gradlew assembleDebug assembleDebugAndroidTest -PreactNativeArchitectures=x86_64'
```

~5 minutes cold, ~3 warm. Output: `app-debug.apk` (~65 MB) and `app-debug-androidTest.apk` (~4.5 MB).

Two checks that Detox can talk to the app:

```bash
wsl.exe -d Ubuntu -- bash -lc 'grep testInstrumentationRunner ~/econoflow/android/app/build.gradle'
#   testInstrumentationRunner "com.wix.detox.DetoxJUnitRunner"
wsl.exe -d Ubuntu -- bash -lc 'ls ~/econoflow/android/app/src/androidTest/java/pt/econoflow/mobile/test/DetoxTest.java'
```

If either is missing, `apply-detox-android.js` did not run against this copy.

---

## 5. Start Metro and keep it alive

The debug APK has no bundle, so Metro must run for the whole session — and must **outlive the shell
that starts it**, hence `setsid`:

```bash
wsl.exe -d Ubuntu -- bash -lc 'cd ~/econoflow && setsid nohup npx expo start --dev-client --port 8081 > /tmp/metro.log 2>&1 < /dev/null & sleep 25; curl -s http://127.0.0.1:8081/status'
```

Expect `packager-status:running`. Restart Metro after any `EXPO_PUBLIC_*` change (no hot reload).

---

## 6. Start the emulator (headless, detached)

Requires the sudo password. Run it as one `wsl` call:

```bash
wsl.exe -d Ubuntu -- bash -lc '. ~/.android-hosts.env; adb kill-server; pkill -f qemu-system; sleep 3; echo <SUDO_PASSWORD> | sudo -S -p "" sysctl -w vm.swappiness=10; echo <SUDO_PASSWORD> | sudo -S -p "" sh -c "swapoff -a && swapon -a"; setsid nohup $ANDROID_HOME/emulator/emulator -avd Pixel_7_API_35 -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -memory 4096 -cores 4 > /tmp/emulator.log 2>&1 < /dev/null & sleep 50; adb start-server; adb devices; adb shell getprop sys.boot_completed'
```

Then **confirm it outlived the call** (must print `qemu UP` and `device`):

```bash
wsl.exe -d Ubuntu -- bash -lc '. ~/.android-hosts.env; pgrep -f qemu-system >/dev/null && echo "qemu UP" || echo "qemu DOWN"; adb devices | sed -n 2p'
```

Every flag is load-bearing:

- `-no-window` — headless, no display server. `-no-snapshot` — every run starts from the same
  device state, which the specs assume.
- `-gpu swiftshader_indirect` — no GPU in this distro; software rendering (see
  [Known issue](#known-issue-the-window-stops-drawing)).
- `setsid … & < /dev/null` — without it the emulator dies with the `wsl` call. **If `qemu DOWN`,
  stop here**: nothing later will work, and the failure looks like an app fault.
- **Clean swap + `swappiness=10`, and no Gradle/Kotlin daemons during a run.** After repeated
  builds the distro was swapping with ~4 GB idle and the emulator aborted
  (`qemu-system-x86_64-headless: event_engine: potentially unexpected fatal signal 6` in `dmesg`),
  `adb` reporting `offline`. Before a run:

  ```bash
  wsl.exe -d Ubuntu -- bash -lc 'cd ~/econoflow/android && ./gradlew --stop; pkill -f KotlinCompileDaemon; free -m | sed -n 2p'
  ```

  Target: several GB free. If memory stays tight, reboot the emulator (this step) — it must start
  with the memory already free.

---

## 7. Install and wire the app to the host

```bash
wsl.exe -d Ubuntu -- bash -lc 'cd ~/econoflow && . ~/.android-hosts.env && adb install -r -d android/app/build/outputs/apk/debug/app-debug.apk && adb install -r -d android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk && adb shell pm list instrumentation'
```

You must see:

```
instrumentation:pt.econoflow.mobile.test/com.wix.detox.DetoxJUnitRunner (target=pt.econoflow.mobile)
```

Then wire it up:

```bash
wsl.exe -d Ubuntu -- bash -lc '. ~/.android-hosts.env; adb shell settings put system screen_off_timeout 2147483647; adb reverse tcp:7003 tcp:7003; adb reverse tcp:8081 tcp:8081; adb -e emu finger touch 1'
```

`7003` is the API, `8081` is Metro, the fingerprint is what the biometric spec answers with.

**Proof that the app really runs before blaming the suite:**

```bash
wsl.exe -d Ubuntu -- bash -lc '. ~/.android-hosts.env; adb shell pm clear pt.econoflow.mobile; adb shell am start -a android.intent.action.VIEW -d econoflow://e2e/open; sleep 35; adb exec-out screencap -p > /tmp/app.png; stat -c%s /tmp/app.png'
```

`> 500 KB` means the Login screen rendered (a ~20 KB PNG is a blank screen — see
[Known issue](#known-issue-the-window-stops-drawing)). This was verified: `1 261 341` bytes,
window focused on `pt.econoflow.mobile/.MainActivity`.

---

## 8. Run the suite

```bash
wsl.exe -d Ubuntu -- bash -lc '. ~/.android-hosts.env; cd ~/econoflow; adb shell pm clear pt.econoflow.mobile; DETOX_CI=1 DETOX_CI_ADB="$(adb devices | sed -n "2p" | cut -f1)" npx detox test -c android.emu.debug --reuse'
```

- `--reuse` skips the build and uses what is installed; **drop it** after a rebuild.
- One spec: append `e2e/auth/02-login.e2e.js`.
- `DETOX_CI=1` makes Detox *attach* to the running emulator instead of booting its own (it cannot
  boot this AVD).
- 20–40 minutes for the 27 tests; each failed wait costs 45–60 s.

Failure artifacts (screenshots, device log, `detox.log`) land in
`~/econoflow/e2e/artifacts/<run>/`. **~20 KB screenshot = blank screen; > 500 KB = rendered.** That
one number is the fastest triage signal.

---

## Root causes found and fixed

The suite used to stop at `02-login` › "signs in and starts the session at the PIN", with
everything after it cascading. Four separate defects were behind it; each one alone was enough
to stop the run, and each one showed up on screen as "a wait that timed out on a screen that
was there all along".

| # | Where | What was wrong | Evidence | Fixed by |
|---|-------|----------------|----------|----------|
| 1 | `EasyFinance.Server/Config/DevelopmentTestDataSeeder.cs` | The fixture users were written straight through the `DbContext`, so `NormalizedEmail` / `NormalizedUserName` stayed `NULL`. Identity's `FindByEmailAsync` — the login path — matches `NormalizedEmail`, so `test1@test.com` answered **401** for a row that exists with the right password hash. | `fixture-user.sh` printed `test1@test.com \| <NULL> \| <NULL>`; `api-login.sh` answered `HTTP 401`. After the fix: `HTTP 200`. | The seeder now normalizes both columns through `userManager.KeyNormalizer`. Pinned by `DevelopmentTestDataSeederGraphTests.SeedAsync_ShouldWriteUsersTheLoginCanFind` / `…ShouldStoreTheNormalizedNameAndEmail`. |
| 2 | `src/screens/auth/PinEntryScreen.tsx` | "N attempt(s) remaining" was rendered **twice** — once as the error card, once as a separate `attemptsText` line with the same key. The customer read the sentence twice, and `by.text` matched two views, which Detox rejects. | Detox: `'…matches 2 views in the hierarchy'`, both `text=4 attempt(s) remaining`. | The duplicate line is gone; the error card carries `testID="pin-attempts-remaining"`. Pinned by `PinEntryScreen.test.tsx` › "states the attempts left exactly once". |
| 3 | `src/navigation/SessionNavigator.tsx` | It subscribed to the **whole** PIN and biometric stores, so saving the PIN re-rendered it, rebuilt `<Stack.Navigator>`, and remounted the stack on `initialRouteName` — discarding the `replace('BiometricEnroll')` dispatched a moment earlier. The customer created a PIN and was put back on the keypad. | The app's own trail: `pinsetup.navigate.dispatch {"target":"BiometricEnroll"}` → `screen.unmount` → `session.mount {"entry":"PinEntry","hasPin":true}`. | The answers are read once via `getState()` in a lazy `useState`; nothing re-renders on a later store change. Pinned by `SessionNavigator.test.tsx`. |
| 4 | `e2e/support/*.js` and the three specs | Screen transitions were probed with `expect(...).toExist()`, which samples **once** instead of polling; the PIN create/confirm steps were told apart by a **translated sentence**; and the biometric offer was declined *after* `waitForApp`, although it sits in front of the app. | `biometric-enroll-cannot-offer` never appeared in `detox.log`, i.e. the helper decided "nothing to decline" one frame before the offer arrived. | `appears()` (polling) replaces the single-sample checks, `passDevicePin()` is the one copy of the PIN steps, `pin-create-title`/`pin-confirm-title` are the step ids, and the offer is answered before the app is awaited. |

**What was NOT the problem**, so do not chase it again: the emulator, memory, `adb reverse`,
the deep-link entry point, the password, or a 2FA prompt.

### A fifth thing that is not the app's fault: the emulator has no fingerprint

`03-biometricUnlock` needs a finger **already enrolled** on the emulator. `adb -e emu finger
touch 1` only *simulates a touch* — it does not create an enrolment. A freshly created
`Pixel_7_API_35` reports `"count":0`, so `isEnrolledAsync()` answers false, the app shows its
"nothing to offer" shape instead of the offer, and the spec waits for a sensor that nothing
will ever open.

```bash
scripts/wsl/enroll-finger.sh          # "count":N
scripts/wsl/enroll-finger.sh enroll   # drives the system wizard, headless
```

The enrolment is **device state**: it survives `pm clear pt.econoflow.mobile`, an app
reinstall and a Detox run, but **not** an emulator restart (`-no-snapshot` starts from the AVD's
saved state, which now includes it, but a recreated AVD does not). Check it with `state.sh`
before every run.

### Diagnostic scripts (run these before reading `detox.log`)

`detox.log` is mostly harness chatter, and the failure text is two screens of JSON. These answer
the common questions in one call, and they live in files because an inline
`wsl -- bash -lc '…'` loses globs and quoting:

| Script | Answers |
|--------|---------|
| `state.sh` | is anything at all up (qemu, device, metro, api, reverse, app, instrumentation, memory) |
| `boot.sh [status]` | start (or ask about) the headless emulator |
| `wire.sh [reverse]` | install both APKs and/or re-create the `adb reverse` rules |
| `api-login.sh` | does the seeded mobile login answer 200 (what the app sends) |
| `fixture-user.sh` | the fixture rows as the database holds them, `NormalizedEmail` included |
| `device-api-check.sh` | the same, from the device's own loopback |
| `sync.sh` | copy the Windows checkout into `~/econoflow` |
| `results.sh [match]` | the failing cases and the start of each failure message |
| `artifacts.sh` | the newest run's files, with screenshot sizes (≈20 KB = blank, > 500 KB = rendered) |
| `shot.sh <case-substring>` | copy one case's screenshot to `~` so it can be opened from Windows |
| `devicelog.sh <case-substring>` | the app's native trail (`EconoFlowTrace`) and any JS/Java error for one case |
| `loggrep.sh <pattern>` / `loglines.sh <start> [end]` | search / slice the newest `detox.log` |
| `enroll-finger.sh [enroll]` | is a fingerprint enrolled on the emulator (the biometric spec cannot pass without one) |
| `gitea-check.sh` | do the Gitea NuGet credentials still work (needed only to rebuild the dev image) |

`devicelog.sh` is usually the decisive one: the trail names the screen that mounted and the
navigation that was dispatched, which is exactly what "it timed out on a screen that was there"
turns out to mean.

### Known issue: the window stops drawing

Separately from the login failure, the app window sometimes ends with a complete UI tree but
nothing painted: blank screenshots, and Espresso's `Waited for the root of the view hierarchy to
have window focus…` timeout. It is transient — a forced redraw (recents → back) restores it — and
Detox's `launchApp` sends `KEYCODE_WAKEUP` before launching, the likely trigger. It is **not** the
soft keyboard (verified with `hw.keyboard=yes` and `show_ime_with_hard_keyboard=0`). If you see
blank screenshots, try `-gpu auto` (WSLg is available) before touching app code.

---

## Troubleshooting quick reference

| Symptom | Cause / fix |
|---------|-------------|
| `adb: no devices/emulators found`, or `offline` | Emulator died — `pgrep -f qemu-system`; restart with section 6 (`setsid`, clean swap, free memory) |
| `Failed to run application on the device` for every spec | Metro not running (section 5) or unreachable from the device (`adb reverse tcp:8081`) |
| `No instrumentation runner found on device` | Only the app APK installed, or `pm clear` took the test APK — install both (section 7) |
| Device log shows `run started: 1 tests` / `run finished: 0` | Wrong runner (`androidx…AndroidJUnitRunner`) or no `DetoxTest` — rerun `apply-detox-android.js`, rebuild |
| `ninja: error: … Filename longer than 260 characters` | Building on `/mnt/d` — build in `~/econoflow` |
| Requests fail / `net::ERR_FAILED` | `.env.local` is not `http://localhost:7003`, or `adb reverse tcp:7003` missing |
| A spec starts at the PIN keypad but expects Login | Device kept a PIN — `adb shell pm clear pt.econoflow.mobile`, rerun |
| `qemu … fatal signal 6` in `dmesg` | Memory/swap churn — stop Gradle & Kotlin daemons, reset swap, reboot the emulator |

---

## Already fixed in this repository

The reason the suite could not start at all (in the git diff):

- `scripts/apply-detox-android.js` sets `testInstrumentationRunner "com.wix.detox.DetoxJUnitRunner"`,
  generates `app/src/androidTest/java/pt/econoflow/mobile/test/DetoxTest.java` (the JUnit entry
  point Detox handshakes in — without it the runner starts and finds no test), and replaces old
  wiring instead of keying off a marker string.
- `e2e/support/biometrics.js` runs `adb -e emu finger touch 1` via `execSync` — Detox 20 exports no
  `exec`, so the old helper threw `TypeError: exec is not a function`.
- Specs are numbered `01-signUp` → `02-login` → `03-biometricUnlock` to encode device-state order;
  `01-signUp` and `02-login` relaunch through `econoflow://e2e/open`, the debug-only automation
  entry point (the Login screen is otherwise unreachable while a session exists).
- `e2e/README.md` records that Detox shards by duration, not filename.
