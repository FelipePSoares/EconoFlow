# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EconoFlow (codebase name: EasyFinance) is a personal/company budget tracking application. It uses an ASP.NET Core 8 backend serving an Angular 21 SPA frontend, backed by SQL Server via EF Core.

## Commands

### Backend

```bash
# First-time HTTPS setup
dotnet dev-certs https

# Run the backend (serves the Angular app via SPA proxy)
dotnet run --project ./EasyFinance.Server --urls https://localhost:7003/

# Run all backend tests
dotnet test

# Run tests for a specific project
dotnet test EasyFinance.Application.Tests/
dotnet test EasyFinance.Domain.Tests/
dotnet test EasyFinance.Server.Tests/

# Add an EF Core migration (when schema changes are needed)
dotnet ef migrations add {MigrationName} --context EasyFinanceDatabaseContext --project EasyFinance.Persistence --configuration release -s ./EasyFinance.Server
```

### Frontend (from `easyfinance.client/`)

```bash
npm start          # Dev server on https://localhost:4200
npm test           # Unit tests via Karma/Jasmine
npm run lint       # ESLint
npx cypress open   # E2E tests (requires backend running)
ng generate component component-name  # Scaffold new component
```

## Architecture

The solution follows Clean Architecture with a strict dependency direction:

```
EasyFinance.Infrastructure  (netstandard2.1 — shared primitives, no dependencies)
        ↓
EasyFinance.Domain          (net8.0 — entities, business rules)
        ↓
EasyFinance.Application     (net8.0 — services, DTOs, mappers, contracts)
        ↓
EasyFinance.Persistence     (net8.0 — EF Core, repositories, migrations)
        ↓
EasyFinance.Server          (net8.0 — ASP.NET controllers, middleware, startup)
        ↓
easyfinance.client          (Angular 21 SPA — embedded as SPA proxy in dev)
```

Test projects (`*.Tests`) mirror the layer they test and share common test infrastructure via `EasyFinance.Common.Tests`.

## Key Patterns

### Domain Entities

All entities extend `BaseEntity` (Id, CreatedDate, ModifiedAt). Every entity exposes an abstract `AppResponse Validate` property for self-validation. Properties use private setters and are mutated only through `SetXxx()` methods — never assign properties directly.

```csharp
// Domain validation pattern
public override AppResponse Validate {
    get {
        var response = AppResponse.Success();
        if (string.IsNullOrEmpty(Name))
            response.AddErrorMessage(nameof(Name), ValidationMessages.PropertyCantBeNullOrEmpty);
        return response;
    }
}
```

### AppResponse Pattern

`AppResponse` / `AppResponse<T>` (in `EasyFinance.Infrastructure.DTOs`) is the universal result type used across all layers. Services return `AppResponse<T>`, and `BaseController.ValidateResponse()` translates it into the appropriate HTTP status code or a 400 with structured error messages. Never throw exceptions for expected business failures — return `AppResponse.Error(...)` instead.

### Repository / Unit of Work

`IGenericRepository<T>` exposes `Trackable()` and `NoTrackable()` IQueryable entry points (use `NoTrackable()` for reads). All repositories are accessed through `IUnitOfWork` — call `await unitOfWork.CommitAsync()` once at the end of a write operation.

### Validation Messages

String messages live in `.resx` files inside `EasyFinance.Infrastructure` and are accessed through the auto-generated static classes `ValidationMessages` and `NotificationMessages`. Add new strings there rather than hard-coding them.

### Mappers

Manual mapping extension methods (`.ToDTO()`, `.ToEntity()`) live in `EasyFinance.Application/Mappers/`. There is no AutoMapper.

### API Route Convention

Controllers are nested under projects: `api/Projects/{projectId}/Categories/{categoryId}/[controller]`. The `ProjectAuthorizationMiddleware` intercepts any route with `{projectId}` and enforces role checks — GET requires `Role.Viewer`, all other methods require `Role.Manager`. The three roles in order: `Viewer < Manager < Admin`.

### JSON Serialization

Enums are serialized as strings (via `StringEnumConverter`) and flag enums as arrays (via `FlagsEnumArrayConverter`). JSON Patch (`PATCH` endpoints) uses `Microsoft.AspNetCore.JsonPatch`.

## Testing Conventions

- **Framework**: xUnit, with FluentAssertions and Shouldly for assertions, Moq for mocking.
- **Builders**: `EasyFinance.Common.Tests` contains builder classes for every domain entity (e.g., `ExpenseBuilder`, `UserBuilder`). Use them in tests instead of constructing objects directly.
- **`BaseTests`**: Integration tests (Application and Server layers) inherit from `BaseTests`, which spins up an EF Core in-memory database with 3 seeded users and 3 projects, each with varying roles. Call `PrepareInMemoryDatabase()` in the test constructor or setup.
- **In-memory DB**: Each test run gets a unique database name to avoid state leakage across parallel tests.

## Frontend Architecture

The Angular app (`easyfinance.client/src/app/`) is split into:

- `core/` — singleton services, HTTP interceptor, guards, shared UI components (nav-bar, spinner, snackbar, dialogs), models, pipes, utilities.
- `features/` — one folder per domain feature (authentication, project, category, expense, income, user). Each feature owns its own components, models, and routes.

**HTTP Interceptor** (`core/interceptor/`) attaches credentials, injects a correlation ID header, handles token refresh on 401, and shows snackbar notifications for 201/DELETE success responses.

**i18n**: `@ngx-translate` with JSON translation files under `src/assets/i18n/`. All user-visible strings must go through the translation service.

## Branch Naming

```
{feat|fix}/#{issue-number}_{short_description}
# Example: feat/#42_add-expense-attachment
```

PRs target `master`. Tests and code coverage (80%+ target) are required for all PRs.
