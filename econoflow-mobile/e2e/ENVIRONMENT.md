# Local environment for the mobile end-to-end suite

Everything the Detox suite needs on one machine: the **API stack** it signs in against, the
**emulator** the app runs on, and the **debug build** Detox drives. Every command below was
run and checked in this repository; where a step has a trap, the trap is written down next to
it — those are the ones that cost hours.

> The suite runs on **Android, debug builds only** (the Detox runner lives in the androidTest
> APK). Build on a case-sensitive, POSIX path — under WSL on Windows — not on a
> `C:\`-mounted one: CMake object names there exceed 260 characters and the build fails.

---

## 1. The API stack

The mobile app talks to `EXPO_PUBLIC_API_URL`, default `http://localhost:7003` (the emulator
reaches it through `adb reverse`). The dev stack publishes it on `127.0.0.1:7003`, together
with the SPA on `127.0.0.1:4200`.

```bash
# from the repository root
docker compose -f docker-compose.dev.yml down -v          # -v also drops the database volume
docker compose -f docker-compose.dev.yml up -d --build   # builds the image if the code changed
```

`down -v` is the point, not a detail: the fixtures (`test@test.com`, `test1@test.com`) are
written **once per new database**, by the code of the image that starts against it. A stack
that is merely restarted keeps the rows it has — including rows written by an older image
that did not fill in `NormalizedEmail` — so fixing the seeder only takes effect together with
a fresh volume: `down -v` **and** an image that contains the fix.

Check it answered, **on plain HTTP**:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:7003/api/health/live   # 200
curl -s -H 'Content-Type: application/json' -H 'X-Client-Type: mobile' \
  -d '{"email":"test1@test.com","password":"Passw0rd!"}' \
  http://localhost:7003/api/AccessControl/mobile/login                            # 200 + tokens
```

The mobile login is `/api/AccessControl/mobile/login`. The SPA's `/api/AccessControl/login`
is a *different* endpoint that needs a cookie-based reply, so a `200` from curl on it proves
nothing about the app.

> **Plain HTTP, not `https://localhost:7003`.** The dev stack has no TLS listener. `https://`
> there is answered by any TLS-capable proxy in between with a `502`, which curl reports as
> `000` when `-k` is not passed. This confused a whole session: the health probe over
> `https://` said "down" while the API was serving every request correctly on `http://`.

### The two things that actually stop a fresh stack

- **The image has to contain the current code.** `docker compose up` builds only when there is
  no image; `up --build` (or `down -v && up --build`) is what the suites need after a server
  change. A stack running an older image writes the fixtures the old way and answers the
  seeded login with **401** even though everything looks healthy — the seeder normalizes
  `NormalizedEmail` / `NormalizedUserName` only since #1120.
- **The private NuGet feed needs a valid token.** The build restores `fpssoftware.chassis`
  from Gitea; with an expired `GITEA_NUGET_TOKEN` the image build fails with `NU1301` and
  cannot be cheated around. When it happens, ask for a fresh token, or run the API from a
  build of this checkout — never point the suite at production.

If you suspect the fixtures rather than the app, read the rows:

```bash
docker exec econoflow-dev-postgres-1 psql -U econoflow -d econoflow -c \
  'SELECT "Email","NormalizedEmail","NormalizedUserName" FROM "AspNetUsers";'
```

`test1@test.com` with a `NULL` `NormalizedEmail` can never sign in: Identity's
`FindByEmailAsync` matches on that column. That is a seeder defect, not a wrong password, and
it shows on screen as *"Incorrect login information!"*.

---

## 2. The emulator

The suite runs against **`Pixel_7_API_35`** (override with `DETOX_AVD_NAME`). It must be
booted **unlocked**, with a fingerprint enrolled (the biometric spec offers one through the
emulator console).

```bash
# put the SDK's own emulator and platform-tools first on PATH
export ANDROID_HOME="$HOME/android-sdk"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"

# headless is enough for Detox; start it detached and leave it running
nohup emulator -avd Pixel_7_API_35 -no-window -no-audio -no-boot-anim -no-snapshot \
  -gpu swiftshader_indirect -memory 4096 -cores 4 > ~/emulator.log 2>&1 &

# wait for the boot to finish before anything else
until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 5; done
```

Two mistakes to avoid when starting it: with the SDK directory **not** on `PATH` the command
resolves to the *Windows* `emulator.exe`, which cannot launch a Linux AVD (`command -v
emulator` tells you which one you got), and starting an AVD that is already running fails with
`Running multiple emulators with the same AVD is an experimental feature` — that message means
"it is already up", not "it is broken".

Two states of the emulator break every Detox run, and both look like a broken app:

- **The keyguard is up.** Detox launches the main activity through instrumentation and every
  case fails with `Unable to resolve activity for: Intent { … econoflow://e2e/... }`. The
  message says the activity cannot be resolved; the activity is fine, the device is locked.
  Unlock it (`adb shell input keyevent 82`, enter the device PIN if one is set) and check
  `adb shell dumpsys window | grep mCurrentFocus` shows the launcher rather than a keyguard.
- **`/sdcard` is missing** (`adb shell ls /sdcard` → not found). Detox writes its log and
  failure screenshots there, and its own start-up fails when they cannot be created.
  Reinstalling both APKs recreates it; so does a fresh boot of the AVD.

A fingerprint has to be **enrolled**, not merely touchable: `adb -e emu finger touch 1` only
simulates a touch. A freshly created AVD reports nothing enrolled, and the biometric spec then
never reaches the sensor. Enrol it in the emulator's own Settings → Security → Fingerprint
(one finger is enough); clearing the device lock removes the enrolment with it.

---

## 3. Build and install the app

Detox needs **two** APKs — the debug app and the androidTest APK that carries the runner —
built for the emulator's ABI. Do this in the POSIX working copy, once per source change:

```bash
cd econoflow-mobile
npx expo prebuild -p android --no-install      # regenerates android/ (not committed)
node scripts/apply-detox-android.js           # adds the Detox runner wiring
cd android && ./gradlew assembleDebug assembleDebugAndroidTest -PreactNativeArchitectures=x86_64
cd ..
adb install -r -d android/app/build/outputs/apk/debug/app-debug.apk
adb install -r -d android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
```

An incremental build after a JS-only change takes a couple of minutes (measured: 1 min 34 s
for `assembleDebug` + `assembleDebugAndroidTest` with 73 tasks executed). Check what is on the
device before blaming a spec:

```bash
adb shell pm list instrumentation   # pt.econoflow.mobile.test/com.wix.detox.DetoxJUnitRunner
adb shell dumpsys package pt.econoflow.mobile | grep lastUpdateTime
```

If the app was reinstalled, **reinstall the androidTest APK too**: the two are installed
separately and the runner can be dropped with the app.

---

## 4. The JS bundle (Metro)

The debug APK carries **no** JS bundle; it loads the app from Metro on `localhost:8081`, which
the emulator reaches through `adb reverse`. So Metro must be running, in the same working copy
the APK was built from:

```bash
cd econoflow-mobile
npx expo start --port 8081        # in CI/servers, CI=1 keeps it non-interactive
curl -s http://localhost:8081/status   # packager-status:running
```

**Metro inlines the API URL at request time.** `EXPO_PUBLIC_API_URL` is read from `.env` and
`.env.local`; `.env` names production, so a local run needs

```
EXPO_PUBLIC_API_URL=http://localhost:7003
```

in `.env.local` (see `.env.example`). Editing it does not reach a running bundler — restart
Metro after changing it, and check what the app will get:

```bash
curl -s 'http://localhost:8081/index.bundle?platform=android&dev=true&minify=false' \
  | grep -o 'http://localhost:7003' | head -1
```

> Metro can also run **outside** the Linux environment (the Windows one, for `npm start`), and
> it is then not the bundler on `localhost:8081` that the emulator gets. Start the Linux one
> for the suite, and stop anything already holding the port: `npx expo` refuses to start on a
> busy port in non-interactive mode, and the *old* bundle keeps being served. To free the port
> without guessing at process names:
>
> ```bash
> for pid in $(ss -lntp | grep 8081 | grep -o 'pid=[0-9]*' | cut -d= -f2); do kill "$pid"; done
> ```

---

## 5. Run the suite

```bash
adb reverse tcp:7003 tcp:7003     # the app's localhost → the stack
adb reverse tcp:8081 tcp:8081     # the app's localhost → Metro

cd econoflow-mobile
DETOX_CI=1 DETOX_CI_ADB=emulator-5554 CI=1 \
  npx detox test -c android.emu.debug --reuse --maxWorkers 1            # everything
DETOX_CI=1 DETOX_CI_ADB=emulator-5554 CI=1 \
  npx detox test -c android.emu.debug --reuse --maxWorkers 1 e2e/auth/02-login.e2e.js
```

`DETOX_CI=1` makes Detox **attach** to the running emulator instead of trying to boot one
(its emulator type cannot start this AVD), and `--reuse` keeps it attached between runs.
`--maxWorkers 1` keeps one app on the device.

`adb reverse` rules are per device session: an `adb kill-server`, a Linux distro restart, an
emulator restart or a new boot all drop them silently, and the Login screen then reports the
network failure as *"Incorrect login information!"*. Re-create them (`adb reverse --list`)
before every run.

The two rules the specs rely on, once the environment is up:

- **A screen that arrives on a navigation needs a wait, not a check** — the helpers use
  `waitFor`/`appears`, never a one-shot `expect`.
- **A fixture login that answers 401 is a stack problem**, not a password problem: check
  `/api/AccessControl/mobile/login` from the host first (section 1).

---

## Checklist

| Step | Ask | Answer |
|------|-----|--------|
| 1 | Is the stack up on **plain HTTP**? | `curl http://localhost:7003/api/health/live` → 200 |
| 2 | Does the seeded login work? | `POST /api/AccessControl/mobile/login` → 200 |
| 3 | Is the emulator booted **and unlocked**? | `mCurrentFocus` is the launcher |
| 4 | Is `/sdcard` there? | `adb shell ls /sdcard` |
| 5 | Is a fingerprint enrolled? | emulator Settings, the biometric spec needs one |
| 6 | Are both APKs installed? | `adb shell pm list instrumentation` |
| 7 | Is Metro the Linux one? | `curl http://localhost:8081/status` |
| 8 | Do the reverse rules exist? | `adb reverse --list` shows 7003 and 8081 |

Only when all eight answer yes is a failing spec telling you something about the app.
