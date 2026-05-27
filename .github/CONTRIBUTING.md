# Contributing to EconoFlow

Thank you for taking the time to contribute! This guide covers everything you need to get the project running locally and submit quality pull requests.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project structure](#project-structure)
- [Get the source code](#get-the-source-code)
- [Branch naming](#branch-naming)
- [Backend (ASP.NET Core)](#backend-aspnet-core)
- [Web frontend (Angular)](#web-frontend-angular)
- [Mobile app (React Native / Expo)](#mobile-app-react-native--expo)
- [Database migrations](#database-migrations)
- [Pull request checklist](#pull-request-checklist)

---

## Prerequisites

| Tool | Version | Required for |
|------|---------|-------------|
| .NET SDK | 8.0 | Backend |
| Node.js | ≥ 20.x | Web frontend & mobile |
| Angular CLI | latest | Web frontend scaffolding |
| Expo CLI | latest (`npm i -g expo`) | Mobile app |
| Android Studio | latest | Mobile — Android emulator / USB device |
| Xcode (macOS only) | latest | Mobile — iOS simulator |

> **Note:** Visual Studio for Mac is no longer supported by Microsoft (EOL Aug 31, 2024) and did not officially support .NET 8. Use Visual Studio on Windows or VS Code on any platform.

---

## Project structure

```
EconoFlow/
├── EasyFinance.Server/         # ASP.NET Core 8 API + SPA host
├── EasyFinance.Domain/         # Domain entities and business rules
├── EasyFinance.Application/    # Services, DTOs, mappers
├── EasyFinance.Persistence/    # EF Core, repositories, migrations
├── EasyFinance.Infrastructure/ # Shared primitives (netstandard2.1)
├── EasyFinance.*.Tests/        # xUnit test projects per layer
├── easyfinance.client/         # Angular 21 SPA
└── econoflow-mobile/           # React Native / Expo mobile app (iOS & Android)
```

---

## Get the source code

```bash
git clone git@github.com:FelipePSoares/EconoFlow.git
cd EconoFlow
```

---

## Branch naming

```
{feat|fix}/#{issue-number}_{short_description}
```

Examples:
- `feat/#42_add-expense-attachment`
- `fix/#101_login-redirect-loop`

All PRs target `master`.

---

## Backend (ASP.NET Core)

### Running on Visual Studio (Windows)

Run in debug mode — the SPA proxy will forward Angular requests automatically.

### Running on VS Code / terminal

```bash
# First time only — trust the dev certificate
dotnet dev-certs https

# Start the API (serves Angular via SPA proxy on https://localhost:7003)
dotnet run --project ./EasyFinance.Server --urls https://localhost:7003/
```

### Tests

```bash
# All backend tests
dotnet test

# Per layer
dotnet test EasyFinance.Application.Tests/
dotnet test EasyFinance.Domain.Tests/
dotnet test EasyFinance.Server.Tests/
```

---

## Web frontend (Angular)

```bash
cd easyfinance.client

npm install          # first time
npm start            # dev server → https://localhost:4200
npm test             # unit tests (Karma/Jasmine)
npm run lint         # ESLint
npx cypress open     # E2E tests (requires backend running on :7003)
```

### Generating components

```bash
ng generate component component-name
```

---

## Mobile app (React Native / Expo)

The mobile app lives in `econoflow-mobile/` and targets Android and iOS via Expo SDK 56.

### Install dependencies

```bash
cd econoflow-mobile
npm install
```

### Run on a device or emulator

```bash
# Android (requires Android Studio + emulator or USB device)
npm run android

# iOS (macOS only, requires Xcode)
npm run ios

# Start Metro bundler only (connect via Expo Dev Client)
npm start
```

> The app points to `https://econoflow.pt` by default. To override during local development, create a `.env.local` file:
> ```
> EXPO_PUBLIC_API_URL=https://localhost:7003
> ```

### Tests and type checking

```bash
npm test        # Jest unit tests
npm run typecheck   # TypeScript — must pass with zero errors
npm run lint        # ESLint — must pass with zero warnings
```

### Building an APK for manual testing

The CI pipeline (`Mobile Release Build`) builds a standalone release APK automatically on every push to `master` that touches `econoflow-mobile/`. You can download it from the GitHub Actions artifacts.

To build locally:

```bash
# Generate the native Android project
npx expo prebuild --platform android --no-install --clean

# Build a standalone release APK
cd android
./gradlew assembleRelease
```

### EAS cloud builds

Production and preview builds use [Expo Application Services](https://expo.dev). The `eas-build` job runs automatically when the `EAS_PROJECT_ID` repository variable and `EXPO_TOKEN` secret are configured.

---

## Database migrations

Only needed when you change EF Core entities, mappings, or DB context.

### VS Code / terminal

```bash
# Install EF tools (once)
dotnet tool install --global dotnet-ef

# Add a migration
dotnet ef migrations add {MigrationName} \
  --context EasyFinanceDatabaseContext \
  --project EasyFinance.Persistence \
  --configuration release \
  -s ./EasyFinance.Server
```

### Visual Studio

1. Switch build configuration to **Release**
2. Open **Package Manager Console**
3. Set Default Project to `EasyFinance.Persistence`
4. Run: `Add-Migration {MigrationName} -Context EasyFinanceDatabaseContext`

---

## Pull request checklist

- [ ] Branch follows the naming convention (`feat|fix/#issue_description`)
- [ ] All existing tests pass (`dotnet test`, `npm test` in each project)
- [ ] New code is covered by tests — target is **≥ 80% coverage**
- [ ] TypeScript compiles without errors (`npm run typecheck` in changed projects)
- [ ] Lint passes with zero warnings (`npm run lint` in changed projects)
- [ ] No new user-visible strings hard-coded — use the `.resx` files (backend) or the i18n JSON files (frontend/mobile)
- [ ] PR description explains the *why*, not just the *what*
