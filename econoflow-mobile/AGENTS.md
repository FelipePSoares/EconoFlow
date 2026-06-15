# econoflow-mobile

React Native 0.85 + Expo SDK 56 app. Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

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
