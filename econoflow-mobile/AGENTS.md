# econoflow-mobile

React Native 0.88 + Expo SDK 58. Read the exact versioned docs at https://docs.expo.dev/versions/v58.0.0/ before writing any code.

The New Architecture is the only supported one — React Native 0.82+ cannot disable it, and Expo removed the `newArchEnabled` app-config key in SDK 55, so `app.json` must not set it (expo-doctor fails the schema check if it does).

**Never import `expo-notifications` at module scope.** Expo Go on Android does not register `ExpoTopicSubscriptionModule`, and the package resolves it with `requireNativeModule` on import ([expo/expo#52175](https://github.com/expo/expo/issues/52175)), so a top-level import red-screens the whole app on startup. `src/hooks/usePushNotifications.ts` loads it with `require('expo-notifications')` inside the flow instead — keep it that way, and lazy-load any other package you import from `AppNavigator`'s graph whose native module Expo Go omits. Push registration still cannot work in Expo Go on Android by design; test it on a dev build.

**Notification permission flow (#1053).** `requestNotificationPermissionAndRegister()` in `src/hooks/usePushNotifications.ts` is the only place that shows the OS permission dialog. Never call `Notifications.requestPermissionsAsync()` from a screen. Rules it enforces:

- It runs from `useNotificationPermissionPrompt`, mounted by `MainNavigator` — the first screen every authenticated path reaches (password login, registration auto-login, 2FA), *after* the biometric gate. Requesting from `LoginScreen`/`ProfileSetupScreen` raced their unmount and the Android 13+ dialog was swallowed.
- `getPermissionsAsync()` is read first; the dialog is only shown when the status is `undetermined` **and** `canAskAgain`. The Android `default` channel is created before the dialog.
- `hasPromptedForPermission` (persisted in `useNotificationStore` via `expo-secure-store`) records that the user answered, so a restart or a second login stays silent. It is bound to the account by `authStore.setUser` → `setCurrentUserKey(user.id)`, so a different account on the same device gets its own prompt; a plain sign-out (`clearNotificationState`) keeps the answer.
- `denied` + `canAskAgain === false` ("don't ask again") never prompts again: `NotificationPermissionPrompt` renders a settings guidance and `ProfileScreen` shows an inline `notifications-permission-guidance` row whose action calls `openNotificationSettings()` (`Linking.openSettings`).
- `notificationsEnabled` is derived (OS permission **and** a registered token). `ProfileScreen` re-reads the permission on mount via `syncPermissionState()`, so the toggle cannot read ON while the system blocks notifications.
- Failures land in `useNotificationStore.lastPermissionError`; `ProfileScreen` renders it through `ErrorBanner` (a declined prompt is not an error and is filtered out).
- The OS prompt itself is verifiable only on a dev/standalone build (`npx expo run:android` / `run:ios`) — Expo Go cannot show a push flow.

## Development workflow

Follow the 4-step workflow in [root AGENTS.md](../AGENTS.md). The per-project commands are:

```powershell
cd econoflow-mobile
npm test && npm run typecheck && npm run lint
```

## Quick commands

| Command | Description |
|---------|-------------|
| `npx expo start` | Dev server (Expo Go + QR scan) |
| `npx expo run:android` | Build & run on device/emulator |
| `npm test` | Run Jest tests |
| `npm run typecheck` | TypeScript type check |
| `npm run lint` | ESLint |

See [setup.md](./setup.md) for the full emulator + local API dev workflow, cert configuration, and troubleshooting.

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
