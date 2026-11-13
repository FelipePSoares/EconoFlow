# Mobile e2e suite — progress and handoff

**Status:** the suite runs, but it is **not green on this machine**. Baseline today, against a
freshly created stack: `01-signUp` 4 passed / 1 failed, `02-login` 5 passed / 6 failed,
`03-biometricUnlock` the rest of the failures (**14 failed / 8 passed / 22**). The two
*restart* cases of `03-biometricUnlock` (the original target of this note) were **not
reached** — every login-dependent case dies earlier, on the seeded account (see
[Where it stands](#where-it-stands)).
**Branch:** `fix/#1120_mobile-e2e-suite`, one commit on top of `master`:
`dbafb5cc fix(mobile): make the Detox e2e suite run, and fix what stopped it (#1120)`.

This file is **not committed** (it is the working note). Everything it describes in the code
*is* committed.

**Read [ENVIRONMENT.md](./e2e/ENVIRONMENT.md) first** if a run fails: it is the local
procedure (stack, emulator, both APKs, Metro, `adb reverse`) and its eight-question checklist,
and it catches the failures that are not about the app.

---

## Where it stands

The blocker is the **seeded account's login**, and it is now pinned to two independent
conditions:

1. **The dev image is stale.** `econoflow-dev-app:latest` in this machine's Docker was built
   **before** #1120. `docker compose down -v && up -d` creates a new database with the *old*
   seeder, which writes `NormalizedEmail = NULL` for `test1@test.com` — so the fixture that the
   whole suite signs in as can never sign in. Identity's `FindByEmailAsync` matches on that
   column, the API answers **401**, and the Login screen says *"Incorrect login information!"*,
   which reads like a wrong password.
2. **The image cannot be rebuilt here.** The Gitea NuGet token in `~/econoflow-repo/.env` is
   expired, so `docker compose build` fails with `NU1301` on `fpssoftware.chassis`.

Proof, on the same fresh volume: `POST /api/AccessControl/mobile/login` answers **401** for
`test1@test.com` (`NormalizedEmail` is empty in the row) and **200** for `test@test.com`
(normalized by `AddToRoleAsync` in the seeder). The fix itself is in HEAD and green:
`DevelopmentTestDataSeederGraphTests` (5 passed), the two cases `…ShouldWriteUsersTheLoginCanFind`
and `…ShouldStoreTheNormalizedNameAndEmail`. **A rebuildable image, or a valid token, is the
only thing missing** — then `down -v` + `up -d --build` and the suite's login-dependent cases
can finally be judged.

While the API was briefly correct (a build of HEAD run from this checkout against the same
database, on port 7003), `02-login` reached **7 passed / 4 failed** and `03-biometricUnlock`
failed everything — so even that is not the whole story; the remaining failures are the
original #1120 target plus whatever the restart path still gets wrong. Do not start over from
the 5/22 baseline: the harness, the stack and the app are all in a better place than that.

---

## Root causes found and fixed in #1120 (all committed, all with tests)

### 1. The seeded fixture user could never sign in — `EasyFinance.Server`

`DevelopmentTestDataSeeder` writes its users through the `DbContext` (the #1118 fix), which
leaves `NormalizedEmail` / `NormalizedUserName` `NULL`. Identity's `FindByEmailAsync` — what
`AccessControlController.ValidateSignInAsync` calls — matches on `NormalizedEmail`, so
`test1@test.com` answered **401** for a row that exists with the correct password hash.

- Fix: normalize both columns with `userManager.KeyNormalizer` in the seeder.
- Tests: `DevelopmentTestDataSeederGraphTests.SeedAsync_ShouldWriteUsersTheLoginCanFind` and
  `…ShouldStoreTheNormalizedNameAndEmail` (both were red first).
- **The fix only takes effect in a NEW database created by a build that contains it** — which
  is why `down -v` alone is not enough, and why the stale image above reproduces the bug.

### 2. "N attempt(s) remaining" was rendered twice — `PinEntryScreen`

The error card and a separate `attemptsText` line both rendered the same translation key, so
`by.text` matched two views (Detox rejects that). Fixed: one rendering, with
`testID="pin-attempts-remaining"`. Test: `PinEntryScreen.test.tsx` › "states the attempts left
exactly once".

### 3. `SessionNavigator` remounted the stack mid-session — the big one

It subscribed to the **whole** PIN and biometric stores, so saving a PIN re-rendered it,
rebuilt `<Stack.Navigator>`, and remounted the stack on `initialRouteName` — dropping the
`replace('BiometricEnroll')` dispatched a moment earlier. The app's own trail
(`adb logcat -s EconoFlowTrace`) shows it:

```
pinsetup.navigate.dispatch {"target":"BiometricEnroll","onScreen":true}
screen.unmount {"screen":"PinSetup"}
session.mount {"entry":"PinEntry","hasPin":true,"biometricEnabled":false}   <- the defect
```

Fixed: the answers are read once through `getState()` in a lazy `useState`. Test:
`src/navigation/__tests__/SessionNavigator.test.tsx` (verified red without the fix).

### 4. The specs probed screen transitions instead of waiting for them

- `appears(testID, ms)` is the polling existence check (`e2e/support/cells.js`).
- `passDevicePin()` is the single copy of the PIN steps (create or enter, then the sensor when
  biometrics are already on); the three specs no longer each carry their own.
- `pin-create-title` / `pin-confirm-title` are the step ids (never translated text).
- `01-signUp` › "gets the new customer past the PIN" now registers **its own** account: the
  case used to depend on the previous case's session, which its own `beforeEach` destroys.

### 5. `sign-out` is below the fold — `ProfileScreen`

Added `testID="profile-scroll"` and `scrollTo('profile-scroll', 'sign-out')` in
`signOutThroughProfile`. Tests in `ProfileScreen.test.tsx` (verified red without the id).

### 6. Environment — the emulator had **no fingerprint enrolled**

`adb -e emu finger touch 1` only *simulates a touch*; it does not create an enrolment. A fresh
`Pixel_7_API_35` reports `"count":0`. Enroll one finger in the emulator's own Settings →
Security → Fingerprint. Two traps: clearing the device lock removes the fingerprint with it,
and the enrolment wizard can leave the system `BiometricPrompt` in front of the app (every
later Detox wait then fails with `has-window-focus=false`; `adb shell input keyevent 3` clears
it).

---

## Environment findings from today (all in ENVIRONMENT.md)

- **The emulator was left on its keyguard** — every `launchApp` then fails with
  `Unable to resolve activity for: Intent { … econoflow://e2e/... }`, which reads like a broken
  app. Unlock it.
- **`/sdcard` was missing**, so Detox could not write its log or screenshots and its start-up
  failed. Reinstalling both APKs recreates it.
- **The dev stack serves plain HTTP only.** `https://localhost:7003` is answered by some TLS
  proxy with a 502 (`000` for curl without `-k`) while `http://localhost:7003` serves
  everything. Health checks and the app's URL must use `http://`.
- **The devstack login endpoint is `/api/AccessControl/mobile/login`** (the app's own);
  `/api/AccessControl/login` is the SPA's and needs a cookie reply.
- **Metro inlines `EXPO_PUBLIC_API_URL` at request time.** `.env` names production; a local run
  needs `.env.local` = `http://localhost:7003`, and a **restart of Metro** after changing it. A
  second bundler already holding 8081 keeps serving the old value.
- **An incremental build of both APKs takes ~1.5 minutes** in the Linux copy
  (`./gradlew assembleDebug assembleDebugAndroidTest -PreactNativeArchitectures=x86_64`), and
  `adb install -r -d` of both is two commands. A reinstall drops nothing, but if the app is
  reinstalled the **androidTest APK must be reinstalled too**.
- Typing through `adb shell input text` can land in the wrong field when the two fields are
  focused in the same tick — the specs use Detox `typeText`, which does not have this problem,
  so do not "verify" a login by hand with `adb input`.

---

## What is left

1. **Rebuild the dev image from a commit that contains #1120** (needs a valid Gitea token) and
   recreate the volume: `docker compose -f docker-compose.dev.yml down -v && up -d --build`.
   Confirm `POST /api/AccessControl/mobile/login` → 200 for `test1@test.com`.
2. Re-run the full suite twice (Detox shards by duration, so the order changes).
3. Then pick up the **original** target: the two restart cases of
   `e2e/auth/03-biometricUnlock.e2e.js`. After the relaunch the app mounts `BiometricGate` with
   `biometricEnabled:true` and the sensor is accepted, but the app never reaches
   `main-navigator`. Check whether `useBiometricUnlock.runPrompt`'s `result.success` path calls
   `onUnlockedRef.current()` and whether `BiometricGateScreen`'s `enterApp` (`navigation.reset`
   to `Main`) is dispatched — a `trace()` in that branch answers it in one run.
4. `01-signUp` › "is still signed in after a restart…" still fails at the seeded login for the
   same 401 reason; re-check it once the stack is rebuilt.

### Definition of done

- All of `npm test && npm run typecheck && npm run lint` green in `econoflow-mobile`.
- `dotnet test EasyFinance.Server.Tests` green.
- Detox **22 / 22**, twice.
- Then the 4-step workflow (root `AGENTS.md`) and the `codereview` gate
  (`econoflow-mobile/CLAUDE.md`).
