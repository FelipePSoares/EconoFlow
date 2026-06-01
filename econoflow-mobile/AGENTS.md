# econoflow-mobile

React Native 0.85 + Expo SDK 56 app. Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## Build (release APK)

```powershell
cd econoflow-mobile

# 1. Regenerate native Android project (do this when deps change or android/ is stale)
$env:EXPO_PUBLIC_API_URL = "https://econoflow.pt"
npx expo prebuild --platform android --no-install --clean

# 2. Generate a debug signing keystore (one-time)
keytool -genkey -v `
  -keystore "$env:USERPROFILE\.android\release.keystore" `
  -storepass android -alias econoflow -keypass android `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -dname "CN=EconoFlow,O=EconoFlow,C=PT"

# 3. Build release APK
$env:JAVA_HOME = "C:\tools\jdk-17.0.13+11"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$env:EXPO_PUBLIC_API_URL = "https://econoflow.pt"
$keystore = "$env:USERPROFILE\.android\release.keystore"

cd android
.\gradlew assembleRelease `
  "--project-prop=android.injected.signing.store.file=$keystore" `
  "--project-prop=android.injected.signing.store.password=android" `
  "--project-prop=android.injected.signing.key.alias=econoflow" `
  "--project-prop=android.injected.signing.key.password=android" `
  --no-daemon

# APK will be at: android/app/build/outputs/apk/release/app-release.apk
```

## Build (debug APK — no signing needed)

```powershell
cd econoflow-mobile/android
.\gradlew assembleDebug
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

## Theme

The app uses react-native-paper MD3 theming with custom semantic colours defined in `App.tsx`:

| Role         | Light      | Dark       |
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
- **Env var for API URL**: `EXPO_PUBLIC_API_URL` (default: `https://econoflow.pt`, must be set **without** `/api` suffix since all endpoints start with `/api/`)
- **State**: Zustand stores in `src/store/` for auth & project; React Query for server state
- **Navigation**: `@react-navigation/native-stack` + `bottom-tabs` in `src/navigation/`
- **i18n**: `react-i18next` with JSON files in `src/i18n/locales/`
- **Theme hook**: `useAppTheme()` from `src/theme/useAppTheme.ts` — wraps Paper's `useTheme` with custom colour types
- **Error handling**: `ErrorBanner` component exists at `src/components/common/ErrorBanner.tsx`
