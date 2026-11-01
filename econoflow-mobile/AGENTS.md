# econoflow-mobile

React Native 0.88 + Expo SDK 58. Read the exact versioned docs at https://docs.expo.dev/versions/v58.0.0/ before writing any code.

The New Architecture is the only supported one — React Native 0.82+ cannot disable it, and Expo removed the `newArchEnabled` app-config key in SDK 55, so `app.json` must not set it (expo-doctor fails the schema check if it does).

**Never import `expo-notifications` at module scope.** Expo Go on Android does not register `ExpoTopicSubscriptionModule`, and the package resolves it with `requireNativeModule` on import ([expo/expo#52175](https://github.com/expo/expo/issues/52175)), so a top-level import red-screens the whole app on startup. `src/hooks/usePushNotifications.ts` loads it with `require('expo-notifications')` inside the flow instead — keep it that way, and lazy-load any other package you import from `AppNavigator`'s graph whose native module Expo Go omits. Push registration still cannot work in Expo Go on Android by design; test it on a dev build.

**Notification permission flow (#1053).** `requestNotificationPermissionAndRegister()` in `src/hooks/usePushNotifications.ts` is the only place that shows the OS permission dialog. Never call `Notifications.requestPermissionsAsync()` from a screen. Rules it enforces:

- It runs from `useNotificationPermissionPrompt`, mounted by `MainNavigator` — the first screen every authenticated path reaches (password login, registration auto-login, 2FA), *after* the biometric gate. Requesting from `LoginScreen`/`ProfileSetupScreen` raced their unmount and the Android 13+ dialog was swallowed.
- `getPermissionsAsync()` is read first; the dialog is only shown when the status is `undetermined` **and** `canAskAgain`. The Android `default` channel is created before the dialog.
- `hasPromptedForPermission` (persisted in `useNotificationStore` via `expo-secure-store`) records that the user answered, so a restart or a second login stays silent. Write it through `markAsked()` — never as one of several fields in a spread of a stale snapshot, or the other field silently undoes it. It is bound to the account by `bindSignedInUser(user.id)`, called from **both** `authStore.setUser` (login) and `authStore`'s `onRehydrateStorage` (relaunch — `setUser` is not replayed there), so a different account on the same device gets its own prompt; a plain sign-out (`clearNotificationState`) keeps the answer.
- **Nothing is decided until the account is known.** `sessionBound` (not persisted) is set by `bindSignedInUser`; `useNotificationPermissionPrompt` stays silent while `!hasHydrated || !sessionBound`, so a relaunch never mistakes the default `false` for "never asked". Without this the rationale asked every returning user on each launch — the activation message never appeared for anyone who had already answered (#1053).
- A stored token is **not** a live subscription: the process is killed all day, so `syncPermissionState()` re-registers the device on mount (and `markAsked()` on a native grant) instead of trusting the token in the store.
- `denied` + `canAskAgain === false` ("don't ask again") never prompts again: `NotificationPermissionPrompt` renders a settings guidance and `ProfileScreen` shows an inline `notifications-permission-guidance` row whose action calls `openNotificationSettings()` (`Linking.openSettings`).
- `notificationsEnabled` is derived (OS permission **and** a registered token). `ProfileScreen` re-reads the permission on mount via `syncPermissionState()`, so the toggle cannot read ON while the system blocks notifications.
- Failures land in `useNotificationStore.lastPermissionError`; `ProfileScreen` renders it through `ErrorBanner` (a declined prompt is not an error and is filtered out).
- The OS prompt itself is verifiable only on a dev/standalone build (`npx expo run:android` / `run:ios`) — Expo Go cannot show a push flow.

**Biometric toggle flow (#1052).** `useBiometricToggle()` in `src/hooks/useBiometricToggle.ts` is the only path that turns biometrics on or off; `ProfileScreen`'s row and `BiometricEnrollScreen`'s button both call it. Rules it enforces:

- **One tap, one toggle.** `SettingToggleRow` is a `Pressable`, so the label, the description and the empty part of the row toggle the setting too — not just the `Switch`. One touch reaches the row twice (the `Switch`'s `onValueChange` and the `Pressable`'s press), so the row collapses the pair: a repeated request for the same value within `TOGGLE_DEDUPE_MS` is dropped.
- **Enabling checks the device first.** `hasHardwareAsync()` and `isEnrolledAsync()` run before `setBiometricEnabled(true)`, so the setting cannot read ON where it would fail at unlock. A refusal leaves it OFF and `ProfileScreen` explains why through `ErrorBanner` (`BiometricNotAvailable` / `BiometricErrorNotEnrolled` / `BiometricEnableFailed`). Turning it off never checks anything.
- **Taps are joined.** Concurrent enables share one in-flight request, so a double tap cannot run the native checks or the store write twice.
- **Hydration cannot revert a tap.** `useBiometricStore` sets `skipHydration`, so nothing is read at import time; `hydrateBiometricStore()` starts the single SecureStore read once per app run, and the hook calls it. The row stays disabled until it lands (`isHydrated`), and a value picked before the read finishes wins over the stored one (`merge`) and is written back. Never read `biometricEnabled` from the store before `hydrated` — that is exactly the tap that used to flip back.
- `biometricPromptSkipped` records that the user declined the enrollment offer, and it is **final for the unlock path**: nothing clears it automatically (`setBiometricEnabled` must not reset it — doing so sent the next launch back to the offer, which is the loop that made the screen reappear every time). Enabling from Profile works directly, with no offer. Read it from the store after `hydrateBiometricStore()` when deciding what to show; before the read, `false` is not an answer.

**Unlock gate (#1052).** The app PIN is the lock; biometrics only shortcut it. `BiometricGateScreen` is the single decision point and rules them in this order: no PIN → `PinSetup` (never the enrollment offer, so a restart cannot land the user on biometrics while the app is protected by nothing); PIN but biometrics off or unusable → `PinEntry`; otherwise `authenticateAsync`. `BiometricEnrollScreen`'s Skip records the decline and enters the app when a PIN already exists (or goes to the PIN when there is none); `PinSetupScreen` only offers enrollment on its own path, reading the declined flag from the store first — going back to the gate re-offered enrollment and looped the user. Once declined, the PIN flow never offers biometrics again; `ProfileScreen`'s toggle is the only way to enable it. **With biometrics on, the sensor is asked as soon as the app is in front**: at launch the gate prompts on its own (no keypad first), and `useBiometricUnlock` reopens the prompt when the app comes back to the foreground after the system dismissed it (the customer switching apps, a system screen covering it). Those cancellations (`system_cancel`, `app_cancel`, `user_cancel`, `user_fallback`) are **not** failed attempts, so a quick switch-back lands on the sensor instead of the keypad; a real refusal (`authentication_failed`, `lockout`) still counts towards `MAX_BIOMETRIC_FAILURES`. The in-app `LockOverlay` does the same, and never stacks a second dialog while one is still waiting for an answer. Both lock stores are persisted but **read on demand**: `hydrateBiometricStore()` / `hydratePinStore({ force: true })` are started by `authStore`'s `onRehydrateStorage`, because the gate mounts before anything else and would otherwise decide on defaults; they are forced so a second session in the same app run re-reads, and the PIN read reports `hydrated` so the gate never decides early. `useLockStore` persists the session clock (`lastBackgroundTimestamp`) and its rehydration calls `lockExpiredSession()`: `checkAndLock` only reacts to background → active, so a relaunch — the longest absence of all — used to skip the gate entirely. **A lock only ever exists on top of a session** — `lockExpiredSession()` clears it when no window was stored (first launch or signed out), and `LockOverlay` and `App` both gate on `isAuthenticated`. Otherwise the overlay paints a PIN pad over the Login screen, because `App` renders it for the whole app and must start unlocked to fail open on a first run. `AppGate` renders no session until `authStore.persist.hasHydrated()`.

**Nothing is decided before the stored answers are known (#1116).** A login forces a re-read of both lock stores (`hydratePinStore({ force: true })` / `hydrateBiometricStore({ force: true })`, from `authStore.setUser`), and the session tree used to appear in the same tick: the gate mounted over an unfinished read, saw the defaults — "no PIN, biometrics off" — and sent a returning customer to **Create App PIN**, over the PIN they already had. The next launch then asked for the keypad instead of the sensor. The rule now is one sentence: **a default is not an answer.**

- `hydratePinStore` / `hydrateBiometricStore` report whether the answer is known — `persist.hasHydrated()` (what the read itself writes) plus `hydrated` on the store — and that is what everything waits on. A forced read starts life unknown, so the gate cannot decide on what the previous session left in memory. Both return the read's promise (joined if one is already in flight) and never reject.
- `AppGate` does not mount `SessionNavigator` until both answers are known, subscribing through `subscribePinAnswering` / `subscribeBiometricAnswering` so the tree appears when they land; it also starts the reads itself, for a session nobody else hydrated. The gap is a frame of nothing, not a screen to design for.
- `BiometricGateScreen` reads the answers with `useSyncExternalStore(subscribe*Answering, is*AnswerKnown)`, holds the screen (renders nothing) until they are known, and decides once. It keeps the previous values on screen while a re-read is in flight.
- `BiometricEnrollScreen` waits for the decline read before it offers or navigates. `PinSetupScreen` is unchanged in shape (it already awaited `hydrateBiometricStore`): the save path itself awaits the read and then follows the store's answer.
- `useBiometricUnlock`: a hardware check that never answered is **not** "no biometrics" (it used to set `unavailable`, which the gate takes as final and hands to the keypad); the busy flag is cleared on the final branch; and the per-mount attempt ledger is reset on unmount, because React replays effect cleanup — a carried-over `attemptId` made the next mount's first attempt look stale, and the sensor never opened.
- The **screen suites are split** (`BiometricGateScreen.entry|unlock|selection|hydration.test.tsx`) around one real constraint of the test renderer: it drives the screen one case at a time, and a case that mounts a tree does not always leave a live one for the next. A file whose cases each mount a tree once (and end on another screen) is fine; a file that re-renders must not be followed by cases that mount fresh ones. `src/__test-support__/lockStoreMocks.ts` holds the two stores as one scriptable state object (`mockLockStores.current`), read on every call and never reset by `jest.clearAllMocks`.

**Integration tests (Detox, `e2e/`).** The login and registration flows are covered end to end against the real app: login → 2FA → PIN → biometric offer → app, the restart path (biometrics when enabled, otherwise the PIN), and sign-out leaving nothing behind. Rules the specs rely on:

- **`testID` is the contract.** Screens and shared components expose stable ids (`login-email`, `login-submit`, `pin-key-<digit>`, `biometric-enroll-skip`, `main-navigator`, `auth-hero`, `sign-out`, …). Never key a spec off a translated string; add an id to the component instead.
- **`e2e/` is not in the unit suite.** `jest.config.js` there exists only for Detox (`npm run e2e:test`), and the root Jest config ignores `e2e/`. `e2e/support/` holds the PIN keypad helpers, the accounts and the notification-prompt dismissal; keep flow knowledge there rather than in each spec.
- **A spec starts where the product starts.** The app picks its first screen from what the device stores, and the activity is `singleTask`, so a relaunch keeps the running navigator (`initialRouteName` is read on mount only). Specs relaunch at a start URL (`econoflow://econoflow-start`) rather than `launchApp`; the root `App` holds no deep-link config, so React Navigation never routes these.
- **The PIN belongs to the device, not the account** (`pinStore`). "Create a PIN" therefore only happens once per device; specs that need it run first, and `signUp.e2e.js` (filename order) is the one that signs out and starts from the Login screen.
- **Biometrics have a spec of their own** (`auth/biometricUnlock.e2e.js`, #1116): login → PIN → accepting the enrollment offer → restart → the sensor is asked on its own → **Overview**. The sensor is the OS's dialog, which Detox cannot tap, so `e2e/support/biometrics.js` answers it through the emulator (`adb -e emu finger touch 1`, the finger enrolled on `Pixel_7_API_35`). Without that helper the flow simply cannot be driven past its first prompt.
- **The suite writes to the local stack.** It signs in as the seeded `test1@test.com` and registers a fresh `e2e+…@econoflow.test` account per run. Never point it at production.
- **Android, debug build only.** The Detox runner lives in the androidTest APK (`android/app/build.gradle` + `android/build.gradle`), and the app is built for one ABI — the emulator's (`-PreactNativeArchitectures`, default `x86_64` in `.detoxrc.js`). A deep Windows checkout cannot build it at all (CMake object names pass 260 characters).
- **Not in the pipeline, and not passing yet.** The `mobile-e2e` job was removed from `.github/workflows/BuildAndTests.yml`: on the emulator the instrumentation session dies before Detox's ready handshake, so every spec fails with `Failed to run application on the device`. A debug APK also carries no JS bundle unless one is embedded (no Metro server runs here), and a release app cannot be paired with the debug-only test APK. Do not re-add the job until the suite passes locally — [setup.md](./setup.md#integration-tests-with-detox) records what was found.

**Before diagnosing a failing run, rule out the two artifacts — both cost hours (#1116).**

- **`adb reverse` is what makes the app's `localhost` the host's.** The app calls `http://localhost:7003` (`EXPO_PUBLIC_API_URL` from `.env.local`; `.env` names production and must not win). On the device `localhost` is *the device*, so without `adb reverse tcp:7003` (and `tcp:8081` for Metro) every request is refused — and the Login screen reports a connection failure as **"Incorrect login information!"**. Nothing re-creates the rules: `adb kill-server`, `adb root`, an emulator restart and `wsl --terminate` all drop them silently. Check `adb reverse --list` first; `scripts/wsl/api-check.sh` and `scripts/wsl/mobile-login-check.sh` answer "is the app's request reaching the stack?" (a host-side `curl` proves nothing about the emulator — that is exactly how this was missed). `scripts/wsl/e2e.sh` re-creates the rules before every run.
- **A "blank screen" is usually the launcher, with the app force-stopped.** When instrumentation finishes, Android kills the app (`reason=10 (USER REQUESTED) subreason=21 (FORCE STOP) … due to finished inst`), and the next screenshot is the home screen — which looks identical to "the app renders nothing". Confirm with `adb shell pidof pt.econoflow.mobile`, `dumpsys activity activities | grep topResumedActivity`, and `dumpsys activity exit-info`; `scripts/wsl/crash-reason.sh` and `scripts/wsl/view-tree.sh` do it. A real failure leaves an `adb logcat -b crash` entry or an `AndroidRuntime`/`ReactNativeJS` error; a harness stop leaves neither.
- **The app's JavaScript cannot log to logcat — use the native trail.** `console.log`/`warn`/`error` from app code never reach `adb logcat` in this build (measured at `App.tsx` module scope and in a screen body, with and without Detox); only React Native's internal error reporter gets through. `src/diagnostics/trace.ts` writes through `modules/econoflow-log`, a local Expo module that calls `Log.i`. Read it with `scripts/wsl/trail.sh`; the first event, `diagnostics.init`, reports how the sink bound. The four things that must all be right — the module's `android/build.gradle`, `expo-module.config.json`'s `android.modules`, the `file:` dependency, and extending `expo.modules.kotlin.modules.Module` — plus a check script for each, are in §0.4.

See [scripts/wsl/RUN-E2E.md](./scripts/wsl/RUN-E2E.md) §0.1–0.4 for the full procedure.

## Development workflow

Follow the 4-step workflow in [root AGENTS.md](../AGENTS.md). The per-project commands are:

```powershell
cd econoflow-mobile
npm test && npm run typecheck && npm run lint
npm run e2e:build && npm run e2e:test    # Detox, with the local stack and an emulator
```

## Quick commands

| Command | Description |
|---------|-------------|
| `npx expo start` | Dev server (Expo Go + QR scan) |
| `npx expo run:android` | Build & run on device/emulator |
| `npm test` | Run Jest tests |
| `npm run typecheck` | TypeScript type check |
| `npm run lint` | ESLint |
| `npm run e2e:build` | Build the app and the Detox androidTest APK |
| `npm run e2e:test` | Run the Detox suite in `e2e/` |

See [setup.md](./setup.md) for the full emulator + local API dev workflow, cert configuration, the Detox suite, and troubleshooting.

**Jest and ESM-only dependencies.** The `jest.transformIgnorePatterns` allow-list in `package.json` decides which `node_modules` packages Babel transforms. The default React Native preset ignores all of them, so a package that ships **ESM only** (no CommonJS build) fails every suite that imports it with `Must use import to load ES Module`. Adding a package to that allow-list fixes **Jest only** — it does not change the Metro bundle. Metro still resolves the real module, so an ESM-only package whose consumer does `require()` and calls the default export as a function builds cleanly and then throws at runtime while the tests stay green. Do not "fix" such a package by adding it to the allow-list: keep the previous CommonJS version and record the advisory in [docs/security-exceptions.md](../docs/security-exceptions.md), or move the consumer to a version that supports ESM. `decode-uri-component` is the worked example — it is on a documented exception for exactly this reason, and pinning its patched release in `overrides` broke `query-string` at runtime (PR #1106).

## Architecture compliance checklist (Step 4)

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
- [ ] `econoflow-mobile/AGENTS.md` updated if the change introduces new patterns or configuration

**The task is not complete until tests are green, typecheck and lint are clean, and every checklist item above is confirmed.**

## Key patterns

- **API client**: `src/api/client.ts` — Axios instance with token refresh interceptor; sends `X-Client-Type: mobile` header on every request (bypasses Turnstile CAPTCHA on the backend)
- **Env var for API URL**: `EXPO_PUBLIC_API_URL` (default: `https://localhost:7003`, no `/api` suffix)
- **State**: Zustand stores in `src/store/` for auth & project; React Query for server state
- **Navigation**: `@react-navigation/native-stack` + `bottom-tabs` in `src/navigation/`
- **i18n**: `react-i18next` with JSON files in `src/i18n/locales/`
- **Theme hook**: `useAppTheme()` from `src/theme/useAppTheme.ts` — wraps Paper's `useTheme` with custom colour types
- **Error handling**: `ErrorBanner` component at `src/components/common/ErrorBanner.tsx`

## File attachments

Attachment support uses **native modules** — verify it on a native build rather than Expo Go:

| Package | Purpose |
|---------|---------|
| `expo-document-picker` | Choose a file (PDF or image) from device storage |
| `expo-image-picker` | Take or choose a photo; needs the `expo-image-picker` plugin entry in `app.json` (photo + camera permission strings) |
| `expo-file-system` | Download an attachment to the cache before opening it |
| `expo-sharing` | Hand the downloaded file to the platform share sheet |

Adding or upgrading any of these requires `npx expo install <pkg>` (it resolves the SDK-compatible version). The `app.json` config-plugin entries — including the photo/camera permission strings — only take effect in a dev client or standalone build, so verify attachment flows with `npx expo run:android` / `run:ios` (or an EAS build) rather than Expo Go.

Patterns to follow:

- **Upload** always goes through `src/api/attachments.api.ts`, which builds the `FormData` itself. `src/api/client.ts` sets a global `Content-Type: application/json`, so every multipart request must pass `{ headers: { 'Content-Type': 'multipart/form-data' } }` (the module's `MULTIPART_CONFIG`).
- **Validation** mirrors the backend policy in `src/utils/attachments.ts` (`MAX_ATTACHMENT_SIZE_BYTES`, `ALLOWED_ATTACHMENT_MIME_TYPES`). The server stays the authority.
- **Download/open** uses `src/utils/attachmentDownload.ts` (`expo-file-system/legacy` + `expo-sharing`). It sends the bearer token from `useAuthStore` explicitly because the axios refresh interceptor does not wrap native downloads — an expired token surfaces as `AttachmentOpenFailed` and the user retries.
- **Server state** lives in the React Query hooks in `src/hooks/useAttachments.ts`; they invalidate the record query *and* the month list (plus `['categories', …]` for expense proofs, which drive the list badge).
- **UI** is the shared `AttachmentSection` + `AttachmentPickerSheet` (`src/components/attachments/`), rendered by `RecordAttachmentsScreen` for both an income and an expense deductible proof.

