# EconoFlow / EasyFinance

Public name **EconoFlow**, internal codebase name **EasyFinance** — appears in namespaces, project names, and file paths. Three sub-projects in one repo:

| Directory | Stack |
|-----------|-------|
| `EasyFinance.*` (6 csproj) | ASP.NET Core 8 Clean Architecture |
| `easyfinance.client/` | Angular 21 SPA |
| `econoflow-mobile/` | React Native 0.85 + Expo SDK 56 |

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
