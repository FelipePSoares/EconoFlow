# EconoFlow — Architecture

## 1. High-Level Overview

EconoFlow is a full-stack financial planning application composed of three clients (Angular SPA, React Native mobile app, PWA) sharing a single ASP.NET Core 8 API backed by SQL Server.

```
┌─────────────────────────────────────────────────────────────────┐
│  Clients                                                        │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Angular SPA      │  │ React Native  │  │  PWA / Browser   │  │
│  │  (easyfinance.    │  │ (econoflow-  │  │  (Service Worker)│  │
│  │   client)         │  │  mobile)     │  │                  │  │
│  └────────┬─────────┘  └──────┬───────┘  └────────┬─────────┘  │
└───────────┼───────────────────┼───────────────────┼────────────┘
            │   HTTPS / JWT     │                   │
            ▼                   ▼                   ▼
┌───────────────────────────────────────────────────────────────┐
│  ASP.NET Core 8  (EasyFinance.Server)                         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Middleware Pipeline                                     │  │
│  │  Serilog → CustomExceptionHandler → SafeHeaders →        │  │
│  │  StaticFiles → HTTPS → Authentication → CorrelationId → │  │
│  │  Authorization → ProjectAuthorization → Controllers      │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐  │
│  │ Application  │  │  Persistence  │  │  Infrastructure    │  │
│  │  Services    │  │  (EF Core +   │  │  (DTOs, Messages,  │  │
│  │  Background  │  │  Repositories)│  │  Validators)       │  │
│  │  Services    │  │               │  │                    │  │
│  └──────────────┘  └───────┬───────┘  └────────────────────┘  │
└──────────────────────────── │ ────────────────────────────────┘
                              │  EF Core (SQL Server)
                              ▼
                    ┌──────────────────────┐
                    │  SQL Server           │
                    │  + Data Protection DB │
                    └──────────────────────┘
```

---

## 2. Solution Layout

```
EconoFlow/
├── EasyFinance.Infrastructure/   # netstandard2.1 — DTOs, validation, shared primitives
├── EasyFinance.Domain/           # net8.0 — entities, business rules
├── EasyFinance.Application/      # net8.0 — services, mappers, contracts, background jobs
├── EasyFinance.Persistence/      # net8.0 — EF Core, DbContext, repositories, migrations
├── EasyFinance.Server/           # net8.0 — ASP.NET controllers, middleware, JWT, startup
├── EasyFinance.Common.Tests/     # Shared test builders and helpers
├── EasyFinance.Domain.Tests/
├── EasyFinance.Application.Tests/
├── EasyFinance.Server.Tests/
├── easyfinance.client/           # Angular 21 SPA
└── econoflow-mobile/             # React Native (Expo 56) mobile app
```

### Dependency Direction (strict, never reversed)

```
Infrastructure  (no dependencies)
     ↓
   Domain        (← Infrastructure)
     ↓
 Application     (← Domain, Infrastructure)
     ↓
 Persistence     (← Application, Domain)
     ↓
   Server        (← Application, Persistence, Infrastructure)
```

---

## 3. Backend Layers

### 3.1 Infrastructure (`EasyFinance.Infrastructure`) — `netstandard2.1`

The only layer with no upstream project dependencies. Holds shared primitives used across all other layers:

- **`AppResponse` / `AppResponse<T>`** — universal result type used at every layer boundary.
  ```csharp
  // Factory methods
  AppResponse.Success()                         // void success
  AppResponse<T>.Success(data)                  // typed success
  AppResponse.Error("code", "description")      // single error
  AppResponse.Error(IEnumerable<AppMessage>)    // multiple errors
  ```
  `AppResponse.Succeeded` is `true` when the internal message list is empty.
- **`ValidationMessages` / `NotificationMessages`** — auto-generated from `.resx` files; all user-visible strings reference these constants.
- **`PropertyMaxLengths`** — centralised integer constants for entity field length limits.

### 3.2 Domain (`EasyFinance.Domain`)

Rich domain model — entities are never plain data bags.

#### BaseEntity
```csharp
public abstract class BaseEntity
{
    public Guid Id { get; private set; }
    public DateTime CreatedDate { get; set; }
    public DateTime ModifiedAt { get; set; }
    public abstract AppResponse Validate { get; }
}
```

Every entity implements `Validate` and self-validates on every mutation. Setters are `private`; mutation is only through `SetXxx()` methods.

#### Key Entities

| Entity | Namespace | Notable Points |
|--------|-----------|----------------|
| `User` | AccessControl | Extends `IdentityUser<Guid>`; carries `LanguageCode`, `NotificationChannels`, `DefaultProjectId` |
| `UserProject` | AccessControl | Junction between User ↔ Project; holds `Role`, invitation `Token`, `Accepted`, `ExpiryDate` |
| `Project` | FinancialProject | Root aggregate for financial data; owns Categories, Incomes, Plans, TaxYear config |
| `Category` | Financial | Groups Expenses; has `DisplayOrder` and static factory for default categories |
| `Expense` | Financial | Extends `BaseExpense`; has `Budget`, optional `Items`, `IsDeductible` |
| `ExpenseItem` | Financial | Sub-record of an Expense; same validation rules |
| `Income` | Financial | Project-level (not category-level); no future-dated amounts |
| `Attachment` | Financial | Lifecycle: Temporary → attached to Expense/ExpenseItem/Income |
| `Plan` | FinancialProject | Savings goal; balance updated through `PlanEntry` records |
| `Notification` | Account | Multi-channel notification with delivery state machine |
| `DeductibleGroup` | FinancialProject | Tax-year-scoped cluster of deductible expense references |

### 3.3 Application (`EasyFinance.Application`)

Orchestration layer: service interfaces, their implementations, DTOs, mappers, and background services.

- **Services** live under `Features/{domain}Service/`; each has an `I{X}Service` interface.
- **Mappers** are manual extension methods (`ToDTO()`, `ToEntity()`) under `Mappers/`; no AutoMapper.
- **Background services** live under `BackgroundServices/`.
- **Contracts** declare `IGenericRepository<T>` and `IUnitOfWork`.

### 3.4 Persistence (`EasyFinance.Persistence`)

- **`EasyFinanceDatabaseContext`** — extends `IdentityDbContext<User, IdentityRole<Guid>, Guid>`; configures all entity mappings via `IEntityTypeConfiguration<T>` classes.
- **`MyKeysContext`** — separate `DbContext` for ASP.NET Core Data Protection keys (non-dev only).
- Query splitting: `SplitQuery` globally to avoid Cartesian explosions.
- **Connection**: `EasyFinanceDB` environment variable in production; in-memory DB in development/tests.
- Each test run gets a unique in-memory database name to prevent state leakage across parallel tests.

#### Unit of Work & Repository
```csharp
// IGenericRepository<T>
IQueryable<T> Trackable();      // For writes (EF change tracking on)
IQueryable<T> NoTrackable();    // For reads (AsNoTracking)
AppResponse<T> InsertOrUpdate(T entity);  // Runs entity.Validate before applying
T Delete(T entity);

// IUnitOfWork
IGenericRepository<Project> ProjectRepository { get; }
// … one repo per entity …
Task CommitAsync();  // Auto-sets CreatedDate (new) / ModifiedAt (existing)
ICollection<Guid> GetAffectedUsers(params EntityState[] states); // For notifications
```

All repositories are lazily initialized inside `UnitOfWork`. `CommitAsync()` is called once at the end of each write operation — never multiple times per request.

### 3.5 Server (`EasyFinance.Server`)

ASP.NET Core 8 host. Everything in this layer is infrastructure for the HTTP boundary.

#### Startup (`Program.cs`) — service registration order
1. `AddPersistenceServices(configuration)` — registers DbContext, repositories, UoW.
2. `AddApplicationServices()` — registers all application-layer services, background services, channels.
3. Options: `NotifierFallbackOptions`, `WebPushOptions`, `FeatureRolloutOptions`, `TemporaryAttachmentCleanupOptions`.
4. `AddAuthenticationServices(configuration, environment)` — JWT bearer, Identity, token providers.
5. `AddControllers` with global `[Authorize]` filter.
6. `AddSingleton<IApiService, Smtp2GoApiService>()` — e-mail dispatch.
7. `UseSerilog()` to BetterStack.
8. `AddDataProtection().PersistKeysToDbContext<MyKeysContext>()` (non-dev).

#### Middleware Pipeline (order matters)
```
1  UseSerilogRequestLogging()
2  UseCustomExceptionHandler()      ← catches unhandled exceptions → 500
3  UseSafeHeaders()                 ← security headers (HSTS, CSP, …)
4  UseSwagger/UseSwaggerUI          ← dev only
5  UseMigration()                   ← auto-apply EF migrations on startup (prod only)
6  UseDefaultFiles() + UseStaticFiles()
7  UseHttpsRedirection()
8  UseAuthentication()
9  UseCorrelationId()               ← sets/reads X-Correlation-Id header
10 UseAuthorization()
11 UseProjectAuthorization()        ← role check for every {projectId} route
12 UseLocationMiddleware()          ← sets culture from user preference
13 MapControllers()
```

---

## 4. Authentication & Authorisation

### 4.1 JWT Flow

```
Client                          Server
  │── POST /login ──────────────► ValidateCredentials()
  │                               Generate accessToken (HS256, 15 min)
  │                               Generate refreshToken (DataProtector, 7 days)
  │◄── { accessToken, refreshToken } ──┤
  │
  │── Request + Authorization: Bearer <accessToken> ──►
  │                               JwtBearerMiddleware validates
  │                               ClaimTypes.NameIdentifier = userId
  │◄── 200 / data ──────────────────────────┤
  │
  │── POST /refresh-token ──────► ValidateRefreshToken() → rotate
  │◄── { new accessToken, new refreshToken } ┤
```

- Token source: `Authorization: Bearer` header **or** `AuthToken` cookie (the `OnMessageReceived` event checks both).
- `ClockSkew = TimeSpan.Zero` — tokens expire exactly on time, no grace period.
- Refresh tokens are stored server-side via `DataProtectorTokenProvider`; revoking is possible by regenerating the data-protection key.

### 4.2 Identity Configuration

| Setting | Value |
|---------|-------|
| Password min length | 8 |
| Requires digit | ✓ |
| Requires lowercase | ✓ |
| Requires uppercase | ✓ |
| Requires non-alphanumeric | ✓ |
| Lockout duration | 5 minutes |
| Max failed attempts | 5 |

### 4.3 Two-Factor Authentication

- TOTP via `AuthenticatorTokenProvider<User>` (RFC 6238). Issuer: `"EconoFlow"`.
- 10 single-use recovery codes; regeneration invalidates previous set.
- Mobile clients share the same 2FA flow — a separate login endpoint is provided to avoid browser-cookie coupling.

### 4.4 Project Authorization Middleware

`ProjectAuthorizationMiddleware` intercepts every route containing `{projectId}` and enforces:

```
GET requests          → Role.Viewer required
All other methods     → Role.Manager required
Membership management → Role.Admin required (checked inside service layer)
```

The middleware extracts `userId` from `ClaimTypes.NameIdentifier` and calls `IAccessControlService.HasAuthorization()`. Returns `403 Forbidden` synchronously — the controller is never reached.

### 4.5 Roles

| Role | Value | Can read | Can write | Can manage members |
|------|-------|----------|-----------|--------------------|
| Viewer | 0 | ✓ | ✗ | ✗ |
| Manager | 1 | ✓ | ✓ | ✗ |
| Admin | 2 | ✓ | ✓ | ✓ |

System role `"BetaTester"` is an ASP.NET Identity role used by `FeatureRolloutService` to gate early-access features.

---

## 5. Controller Pattern

Every controller inherits `BaseController`:

```csharp
// Maps AppResponse<T> to HTTP
protected IActionResult ValidateResponse<T>(AppResponse<T> response, HttpStatusCode successCode)
{
    if (response.Succeeded)
        return StatusCode((int)successCode, response.Data);

    return BadRequest(new {
        errors = response.Messages
            .GroupBy(m => m.Code)
            .ToDictionary(m => m.Key, m => m.Select(s => s.Description))
    });
}
```

A `201 Created` variant also calls `CreatedAtAction()` with a route-value dictionary. Controllers never contain business logic — they validate input, call one service method, and pass the `AppResponse` to `ValidateResponse`.

---

## 6. Background Services

All background services are `IHostedService` registered in DI.

### 6.1 `EmailBackgroundService`

```
Caller → Channel<EmailRequest>.Writer.WriteAsync()
                ↓  (unbounded channel, async consumer)
       EmailBackgroundService.ExecuteAsync()
                ↓
       Smtp2GoApiService.SendAsync()
```

### 6.2 `NotifierBackgroundService`

Polls every `NotifierFallbackOptions.IntervalSeconds` seconds (default 30 s):

```
Tick → INotificationService.GetEmailDeliveryCandidatesAsync(batchSize)
           ↓  For each candidate
       INotificationService.TryClaimEmailDeliveryAsync(id, lease)   ← distributed lock
           ↓  If claim succeeds
       NotificationChannelFactory.Create(user.NotificationChannels)  ← builds CompoundChannel
           ↓
       CompoundNotificationChannel.SendAsync(notification)
           ↓
       INotificationService.MarkEmailDeliverySucceededAsync()  or  MarkEmailDeliveryAsFailedAsync()
```

The distributed lock (`EmailLockedUntil`) prevents duplicate delivery when multiple server instances run concurrently.

### 6.3 `TemporaryAttachmentCleanupService`

Runs every `CleanupIntervalHours` hours (default 168 h = 7 days):

```
Tick → find Attachments where IsTemporary=true AND CreatedDate < (now - ExpirationHours)
            AND ExpenseId IS NULL AND ExpenseItemId IS NULL AND IncomeId IS NULL
     → IAttachmentStorageService.DeleteAsync(storageKey)   per batch of BatchSize (500)
     → UnitOfWork.CommitAsync()
```

---

## 7. Notification Channel Architecture

```
INotificationChannel
      │
      ├── EmailChannel            → IEmailService → Channel<EmailRequest> → Smtp2Go
      ├── SmsChannel              → IApiService (Smtp2Go SMS)
      ├── PushChannel             → App push (native)
      ├── WebPushChannel          → WebPush library (VAPID)
      └── CompoundNotificationChannel  ← aggregates 1..N channels
```

`NotificationChannelFactory.Create(flags)` reads the `NotificationChannels` flags enum and assembles a `CompoundNotificationChannel` with the matching implementations.

---

## 8. Email Templates

HTML templates are stored server-side:

```
EasyFinance.Server/
└── EmailTemplates/
    ├── en/
    │   ├── ConfirmEmail.html
    │   ├── ResetPassword.html
    │   ├── WelcomeMessage.html
    │   └── …
    └── pt-BR/
        └── …
```

- Subject extracted from the HTML `<title>` tag.
- Dynamic tokens replaced with `(string token, string replaceWith)[]` pairs before dispatch.
- Falls back to `en` if a localized template is missing.
- In development, `DevEmailSender` logs the e-mail body to the console; `Smtp2GoApiService` is used in production.

---

## 9. File Attachments

```
┌──────────┐  Upload temp file   ┌─────────────────────────┐
│  Client  │ ─────────────────► │ POST /temporary-attachments│
└──────────┘                     └─────────────┬───────────┘
                                               │ IAttachmentStorageService.SaveAsync()
                                               │ Attachment { IsTemporary=true }
                                               ▼
                                       File system / cloud storage
                                               │
                  POST /{expenseId}/attachments (link)
                               │
                               ▼
                   Attachment { IsTemporary=false, ExpenseId=… }

Cleanup job (7-day TTL) deletes orphaned IsTemporary attachments.
```

`IAttachmentStorageService` abstracts the storage backend. The current implementation (`FileSystemAttachmentStorageService`) writes to disk; swapping to S3 requires only a new implementation registered in DI.

---

## 10. Feature Flags

Feature gating is role-based, not user-id-based.

```csharp
[Flags]
enum FeatureFlags { None = 0, WebPush = 1, PwaInstall = 2 }
```

Configuration in `appsettings.json`:
```json
"FeatureRollout": {
  "EnabledForAllUsers":     "WebPush",
  "EnabledForBetaTesters":  "WebPush, PwaInstall"
}
```

`FeatureRolloutService.IsEnabled(userRoles, FeatureFlags.X)` checks whether the user's role list includes `"BetaTester"` and returns the union of the applicable flag sets.

---

## 11. Frontend — Angular SPA

**Stack**: Angular 21, standalone components, Angular Material, `@ngx-translate`, `ng2-charts`, Moment.js adapter.

### Bootstrap chain

```
main.ts
  └─ bootstrapApplication(AppComponent, appConfig)
       ├─ provideRouter(routes, withComponentInputBinding())
       ├─ provideHttpClient(withInterceptors([
       │    HttpRequestInterceptor,   ← auth + 401 refresh + snackbar
       │    LoadingInterceptor,       ← global spinner
       │    LanguageInterceptor       ← Accept-Language header
       │  ]))
       ├─ TranslateModule.forRoot()   ← i18n
       ├─ provideMomentDateAdapter()  ← date pickers in UTC
       └─ provideServiceWorker()      ← PWA (prod only)
```

### `HttpRequestInterceptor` responsibilities

1. Attach `X-Correlation-Id` header (generated and persisted in `localStorage`).
2. On `201 Created` or `DELETE 204`: show success snackbar.
3. On `401 Unauthorized` (non-auth routes):
   - If a refresh is already in-flight: queue the request and wait.
   - Otherwise call `/api/AccessControl/refresh-token`, update stored tokens, retry all queued requests.
   - If refresh fails: `clearAuth()` + navigate to `/login`.
4. On `403 Forbidden`: navigate to `/login`.

### Route structure

```
/                        → IndexComponent (public landing)
/login                   → LoginComponent
/register                → RegisterComponent
/recovery                → RecoveryComponent
/projects                → ListProjectsComponent         [AuthGuard]
/projects/:id            → ProjectOverviewComponent      [AuthGuard]
/projects/:id/expenses   → ExpenseListComponent          [AuthGuard]
/projects/:id/incomes    → IncomeListComponent           [AuthGuard]
/projects/:id/categories → CategoryListComponent         [AuthGuard]
/user/account            → AccountComponent              [AuthGuard]
/user/authentication     → PasswordAuthenticationComponent [AuthGuard]
/user/emails             → EmailsComponent               [AuthGuard]
**                       → redirect to /projects
```

### i18n

Translation JSON files live under `src/assets/i18n/{lang}.json`. All user-visible strings must go through `TranslatePipe` or `TranslateService.instant()`. Fallback language: `en`.

---

## 12. Frontend — React Native Mobile App

**Stack**: React Native 0.85, Expo 56, React Navigation, React Query, Zustand, react-native-paper (MD3), axios, react-i18next, react-hook-form.

### State layers

| Layer | Library | Scope |
|-------|---------|-------|
| Auth tokens, login state | Zustand (`src/store/authStore`) | Global, persisted |
| Server data (projects, expenses, …) | React Query (`staleTime: 30 s`) | Per-query cache |
| Form state | react-hook-form | Per-screen |

### API client (`src/api/client.ts`)

```
axios.create({ baseURL: EXPO_PUBLIC_API_URL })
  Request interceptor  → attach Bearer token from Zustand store
  Response interceptor → 401: call /mobile/refresh-token, rotate token, retry
                         refresh fail: clearAuth(), navigate to Auth stack
```

`EXPO_PUBLIC_API_URL` defaults to `https://localhost:7003` — no trailing `/api/`.

### Navigation structure

```
AppNavigator
  ├── AuthNavigator (stack)
  │     ├── LoginScreen
  │     ├── RegisterScreen
  │     ├── ForgotPasswordScreen
  │     └── TwoFactorScreen
  └── MainNavigator (bottom tabs)
        ├── Categories tab  → CategoryListScreen → ExpenseListScreen → ExpenseFormScreen
        ├── Incomes tab     → IncomeListScreen → IncomeFormScreen
        ├── Overview tab    → MonthlyOverviewScreen
        └── Profile tab     → ProfileScreen
              + QuickAddModal (global bottom-sheet overlay)
```

### API validation error handling

Backend 400 responses carry field-level errors as `{ errors: { FieldName: string[] } }`. Use `extractApiErrors(error)` from `src/utils/apiErrors.ts` in mutation `onError` callbacks. Map known field names to react-hook-form via `setError('fieldName', { type: 'server', message })` and render with `<HelperText type="error">`. Map the `Date` field (not controlled by react-hook-form) to a separate `useState`. Show unmapped or generic errors via `<ErrorBanner>`.

---

## 13. Configuration Reference

### Environment Variables (server)

Variables marked **required** will throw at startup (or on first use) if absent.

| Variable | Required | Purpose | Default if absent |
|----------|----------|---------|-------------------|
| `EasyFinanceDB` | **required** | SQL Server connection string | — |
| `EconoFlow_TOKEN_SECRET_KEY` | **required** | JWT signing key (HS256) | — |
| `EconoFlow_ISSUER` | **required** | JWT `iss` claim | — |
| `EconoFlow_AUDIENCE` | **required** | JWT `aud` claim | — |
| `SMTP2GO_API_KEY` | **required** | SMTP2Go email service API key — process throws `InvalidOperationException` on startup if missing | — |
| `EconoFlow_SECRET_KEY_FOR_DELETE_TOKEN` | **required** | Signs account-deletion confirmation tokens — throws on every DELETE `/api/AccessControl` call if missing | — |
| `EconoFlow_TURNSTILE_SECRET_KEY` | optional | Cloudflare Turnstile server-side secret | `""` (captcha always passes) |
| `EconoFlow_TURNSTILE_SITE_KEY` | optional | Cloudflare Turnstile site key returned to clients | `""` |
| `EconoFlow_KEY_ENCRYPT_ACTIVE` | optional | Enable AES key encryption for ASP.NET Data Protection | encryption disabled |
| `EconoFlow_BETA_TESTER_ADMIN_KEY` | optional | Auth key to grant the BetaTester role via `/api/AccessControl/beta` | endpoint returns 403 for all callers |
| `EconoFlow_PUBLIC_BASE_URL` | optional | Public base URL used in email unsubscribe links | `https://www.econoflow.pt` |
| `EconoFlow_ATTACHMENTS_ROOT_PATH` | optional | Root directory for file attachment storage | `AppContext.BaseDirectory/Attachments` |
| `EconoFlow_WEB_PUSH_PUBLIC_KEY` | optional | VAPID public key override (overrides `appsettings.json`) | value from `appsettings.json` |
| `EconoFlow_WEB_PUSH_PRIVATE_KEY` | optional | VAPID private key override (overrides `appsettings.json`) | value from `appsettings.json` |
| `EconoFlow_UNSUBSCRIBE_HMAC_SECRET` | **required** (prod) | HMAC-SHA256 key for email unsubscribe link signatures — DEBUG builds fall back to a hardcoded dev value | — (throws `InvalidOperationException` in non-DEBUG builds) |
| `EXPO_PUBLIC_API_URL` | optional | Mobile app API base URL | `https://localhost:7003` |

### Key `appsettings.json` Settings

| Key | Default | Notes |
|-----|---------|-------|
| `TokenSettings.TokenExpireSeconds` | `900` | JWT access token TTL (15 min) |
| `TokenSettings.RefreshTokenExpireSeconds` | `604800` | Refresh token TTL (7 days) |
| `NotifierFallback.IntervalSeconds` | `30` | Notification polling interval |
| `NotifierFallback.BatchSize` | `50` | Notifications processed per tick |
| `WebPush.AppPushConfigured` | `false` | Enables native push over web push |
| `WebPush.MaxDeliveryAttempts` | `2` | Push retry limit |
| `TemporaryAttachmentCleanup.ExpirationHours` | `168` | 7-day TTL for temp attachments |
| `TemporaryAttachmentCleanup.CleanupIntervalHours` | `168` | Cleanup job frequency |
| `TemporaryAttachmentCleanup.BatchSize` | `500` | Files deleted per cleanup run |
| `FeatureRollout.EnabledForAllUsers` | `"WebPush"` | Feature flags available to everyone |
| `FeatureRollout.EnabledForBetaTesters` | `"WebPush, PwaInstall"` | Additional flags for beta testers |

---

## 14. Testing Strategy

| Layer | Framework | Notes |
|-------|-----------|-------|
| Domain unit tests | xUnit + FluentAssertions | Pure in-memory; no EF, no DI |
| Application integration | xUnit + EF In-Memory | `BaseTests` spins up seeded DB with 3 users × 3 projects |
| Server integration | xUnit + EF In-Memory | Tests controllers end-to-end via `WebApplicationFactory` |
| Frontend unit | Karma + Jasmine | Angular TestBed |
| Frontend E2E | Cypress | Requires backend running on `https://localhost:7003` |

Entity builders in `EasyFinance.Common.Tests` (e.g. `ExpenseBuilder`, `UserBuilder`) must be used in all tests. Direct `new Entity()` calls are prohibited. Each test suite creates a uniquely named in-memory database to enable safe parallel execution.

Coverage target: ≥ 80% for all backend layers.

---

## 15. Local Development Setup

```bash
# 1. Trust the .NET dev certificate (once per machine)
dotnet dev-certs https

# 2. Start the backend (also serves the Angular app via SPA proxy)
dotnet run --project ./EasyFinance.Server --urls https://localhost:7003/

# 3. (Optional) Start Angular independently for hot-reload
cd easyfinance.client && npm start    # → https://localhost:4200

# 4. (Optional) Start the mobile app
cd econoflow-mobile && npx expo start

# 5. Add an EF Core migration
dotnet ef migrations add <Name> \
  --context EasyFinanceDatabaseContext \
  --project EasyFinance.Persistence \
  --configuration release \
  -s ./EasyFinance.Server
```
