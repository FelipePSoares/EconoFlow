# EconoFlow / EasyFinance

Public name **EconoFlow**, internal codebase name **EasyFinance** — appears in namespaces, project names, and file paths. Three sub-projects in one repo:

| Directory | Stack |
|-----------|-------|
| `EasyFinance.*` (6 csproj) | ASP.NET Core 8 Clean Architecture |
| `easyfinance.client/` | Angular 21 SPA |
| `econoflow-mobile/` | React Native 0.85 + Expo SDK 56 |

## Development Workflow

**Every code change — no matter how small — must follow these steps in order.**

### 1. Before writing implementation code

- Identify all existing tests that cover the area you are about to change:
  - Backend: `*.Tests/` projects (xUnit, files ending in `Tests.cs`)
  - Frontend: `*.spec.ts` files alongside the changed component/service
  - Mobile: `*.test.ts` / `*.test.tsx` files in `econoflow-mobile/`
- Write or update the tests that cover the new or modified behaviour **before** writing implementation code. Run them once to confirm they fail — this proves the tests actually exercise the code path you are about to build.

### 2. Implement the change

- Follow all architecture patterns documented in this file.
- Keep changes focused: do not refactor unrelated code in the same commit.

### 3. Run tests and lint

Run the full suite for every sub-project that has changed files:

| Sub-project | Test command | Lint command |
|-------------|-------------|-------------|
| Backend | `dotnet test` | — |
| Frontend | `cd easyfinance.client && npm test -- --watch=false --browsers=ChromeHeadless` | `cd easyfinance.client && npm run lint` |
| Mobile | `cd econoflow-mobile && npm test && npm run typecheck` | `cd econoflow-mobile && npm run lint` |

Fix every test failure and lint error before moving on.

### 4. Code review gate

Once all tests are green and lint is clean, perform an architecture compliance review against the rules in this file before considering the task done. Specifically verify:

- No Clean Architecture layer dependency violations
- Domain entity patterns respected (private setters, `SetXxx()`, `Validate` property)
- `AppResponse<T>` used for all service return types; no exceptions for business failures
- `NoTrackable()` used for read queries; single `CommitAsync()` per write path
- API routes follow the `api/Projects/{projectId}/Categories/{categoryId}/[controller]` pattern
- No hard-coded user-visible strings (use `.resx` / `react-i18next`)
- No hard-coded colours in mobile (use `useAppTheme()`)
- Sensitive data stored via `expo-secure-store`, not `AsyncStorage`
- `requirements.md`, `architecture.md`, or `AGENTS.md` updated if the change introduces new features, patterns, or configuration

Fix every violation found. Re-run tests after fixes. Only when tests are green and the review is clean is the task complete.

---

## Backend

### Commands

```powershell
dotnet run --project ./EasyFinance.Server --urls https://localhost:7003/
dotnet test                                           # all test projects
dotnet test EasyFinance.Application.Tests/            # single project
```

EF Core migration (note `--configuration release`):
```powershell
dotnet ef migrations add {Name} --context EasyFinanceDatabaseContext --project EasyFinance.Persistence --configuration release -s ./EasyFinance.Server
```

### Architecture pitfalls

- **Infrastructure** targets `netstandard2.1` (shared primitives). All other layers target `net8.0`.
- **AppResponse<T>** (`EasyFinance.Infrastructure.DTOs`) is the universal return type. Never throw for expected business failures; return `AppResponse.Error(...)`.
- **Entity mutation**: private setters + `SetXxx()` methods only. Never assign properties directly.
- **No AutoMapper**. Manual extension methods in `EasyFinance.Application/Mappers/` (`.ToDTO()`, `.ToEntity()`).
- **Validation messages** live in `.resx` files in `EasyFinance.Infrastructure`, accessed via auto-generated `ValidationMessages` / `NotificationMessages` static classes. `ValidationMessages.Designer.cs` is gitignored (generated at build).
- **JSON**: enums serialized as strings (`StringEnumConverter`), flag enums as arrays (`FlagsEnumArrayConverter`). `PATCH` uses `Microsoft.AspNetCore.JsonPatch`.

### API routing & auth

Route pattern: `api/Projects/{projectId}/Categories/{categoryId}/[controller]`

`ProjectAuthorizationMiddleware` intercepts any route with `{projectId}`:
- `GET` → requires `Role.Viewer`
- All other methods → requires `Role.Manager`
- Role hierarchy: `Viewer < Manager < Admin`

### Testing

- xUnit + FluentAssertions + Shouldly + Moq.
- **Builders** in `EasyFinance.Common.Tests` (e.g., `ExpenseBuilder`, `UserBuilder`). Use instead of constructing entities directly.
- Integration tests extend `BaseTests` → call `PrepareInMemoryDatabase()` in constructor/setup. Spins up EF Core in-memory DB with 3 seeded users + 3 projects (varying roles across `Admin`/`Manager`/`Viewer`). Each test run uses a unique DB name (`Guid`) to avoid parallel-test leakage.
- .NET tests in CI: `dotnet test --configuration Debug --no-build --no-restore --verbosity normal --logger trx --collect:"XPlat Code Coverage"`

## Frontend (Angular)

```powershell
cd easyfinance.client
npm start                 # dev server on https://localhost:4200 (uses run-script-os)
npm test                  # Karma/Jasmine
npm run lint              # ESLint via angular-eslint
npx cypress run           # headless E2E (requires backend at localhost:7003)
```

- CI runs Angular tests with `--watch=false --browsers=ChromeHeadlessCI`.
- i18n via `@ngx-translate` — JSON files in `src/assets/i18n/`.
- `core/` for singletons, `features/` per domain (project, category, expense, etc.).
- Frontend `version.json` at `src/assets/version.json` is auto-bumped on PRs with frontend changes via CI.

## Mobile

See `econoflow-mobile/AGENTS.md` for full build/run instructions. Pre-commit hook (`.husky/pre-commit`) runs lint + typecheck only when mobile files are staged.

## Project conventions

- **Branch naming**: `{feat|fix}/#{issue-number}_{short_description}` (e.g., `feat/#42_add-expense-attachment`)
- **PRs target `master`**. Tests required. Code coverage target 80%+.
- **No formatter config** in this repo (no `.prettierrc`, no `dotnet-format` config).
