# EconoFlow — System Requirements

## 1. Purpose & Vision

EconoFlow is a personal and team budget-tracking application that lets individuals and small groups plan income, control spending, build savings plans, and understand their tax-deductible expenses. The system is available as a web application (Angular SPA backed by ASP.NET Core) and a mobile application (React Native).

---

## 2. Functional Requirements

### 2.1 Authentication & Account Management

#### 2.1.1 Registration & Login
- Users shall register with first name, last name, e-mail address, and password.
- E-mail confirmation shall be required before full access is granted.
- Users shall log in with e-mail + password. An unconfirmed account shall not allow login.
- A resend-confirmation endpoint shall be available.
- The system shall support Cloudflare Turnstile CAPTCHA on login and registration to prevent automated abuse. The CAPTCHA configuration (public key) shall be exposed to the frontend via a dedicated endpoint.

#### 2.1.2 Password Management
- Users shall be able to request a password reset via e-mail link.
- Password reset shall use a tokenised flow with an expiry.
- Authenticated users shall be able to change their password by supplying the current password.

#### 2.1.3 Two-Factor Authentication (2FA)
- The system shall support TOTP-based 2FA (authenticator app).
- Setup: Generate a QR code / shared key for the user's authenticator app. The issuer name shall be "EconoFlow".
- Enable: Verify the first TOTP code before activating 2FA.
- Disable: Require a valid TOTP code.
- Recovery codes: The system shall generate 10 single-use recovery codes. Users can regenerate codes at any time (old codes are invalidated).
- Mobile login (React Native) shall use a dedicated token exchange to avoid browser-cookie flows.

#### 2.1.4 Token Management
- The system shall issue short-lived JWT access tokens and long-lived refresh tokens stored server-side.
- Refresh-token rotation: A new refresh token is issued on every refresh call; the old one is invalidated.
- Mobile clients shall have their own `/mobile/login` and `/mobile/refresh-token` endpoints.

#### 2.1.5 Account Settings
- Users shall be able to update first name, last name, and e-mail (changing e-mail triggers re-confirmation).
- Users shall be able to select their preferred language/culture (`LanguageCode`, e.g. `en-US`, `pt-BR`).
- Users shall be able to set a default project that is loaded on login.
- Users shall be able to choose notification channels: Email, SMS, Push, InApp, WebPush (flags, multiple may be selected).
- Users shall be able to delete their own account. Deletion requires a signed confirmation token that expires.
- Administrators shall be able to deactivate / reactivate user accounts.
- Administrators shall be able to grant the "BetaTester" role to a user.

#### 2.1.6 E-mail Unsubscribe
- Every notification e-mail shall include a one-click unsubscribe link that carries a signed `userId + signature`.
- Visiting the link shall disable the Email notification channel for that user without requiring login.

---

### 2.2 Projects

A **Project** is the top-level financial workspace. One user may own or belong to multiple projects.

#### 2.2.1 CRUD
- Users shall create a project by providing a name and preferred currency (ISO 4217 code).
- Users shall update a project's name and currency via JSON Patch.
- Users shall archive a project (soft-delete; archived projects are excluded from active lists).
- Deleting the user account shall remove the user's link from all financial records (replace with `CreatorName` snapshot) and delete projects where the user is the sole admin.

#### 2.2.2 Membership & Invitations
- A user who creates a project is automatically assigned the **Admin** role.
- An Admin shall invite other users by e-mail address, assigning them a role (Viewer or Manager).
- The invitation shall produce a unique `Token` (Guid) valid for 7 days.
- Invitees receive an e-mail with an accept link. Accepting the invitation binds the invitation to the logged-in user's account.
- Roles: `Viewer` (read-only), `Manager` (create/edit financial records), `Admin` (manage membership).
- A project must always have at least one Admin; operations that would leave a project with no Admin shall be rejected.
- Members shall be listed, updated (role change), or removed via JSON Patch on the access list.

#### 2.2.3 Budget Copy
- Users shall copy budget figures from the previous calendar month to the current month with a single request. This duplicates all expense `Budget` values forward.

#### 2.2.4 Smart Setup
- A first-time project setup endpoint shall accept a `SmartSetupRequestDTO` and create default categories with pre-calculated budget amounts based on the user's income.

#### 2.2.5 Overview & Summaries
- **Latest transactions**: return the N most recent expense + income records across all categories.
- **Annual year summary**: aggregate spending and income by month for a given year.
- **Annual expenses by category**: aggregate spending broken down by category for a given year.
- **Overview summary**: given a date range, return totals for income, expenses, and balance, plus a list of recent transactions.

#### 2.2.6 Tax Year Configuration
- A project may configure a custom tax year (type: `CalendarYear` or `CustomStartMonth`).
- Custom start month requires a day (1–28+, validated against month) and a labeling convention (`ByStartYear` or `ByEndYear`).
- The system shall derive the list of all tax year periods for the project based on these settings.

---

### 2.3 Categories

A **Category** groups related expenses. Categories belong to a Project.

- Users shall create, rename, and archive categories.
- Each category has a `DisplayOrder` integer; users shall reorder categories by submitting an ordered list.
- Categories shall be filterable by date range or by year.
- The system shall expose a set of default categories with pre-defined budget percentages (see §4.3).
- `TotalBudget`: sum of all expense budget values in the category.
- `TotalWaste`: sum of all actual expense amounts in the category.

---

### 2.4 Expenses

An **Expense** belongs to a Category and records actual or planned spending.

#### 2.4.1 CRUD
- Users shall create, read, update (JSON Patch), and delete expenses.
- Required fields: `Name`, `Date`, `Amount` (or computed from items), `Budget`.
- `Date` must not be more than 5 years in the past.
- An expense with a future `Date` and `Amount > 0` shall be rejected (planned expenses must have amount = 0 until the date passes).
- `IsDeductible` flag marks expenses eligible for tax deductions.

#### 2.4.2 Expense Items
- An expense may be itemised into `ExpenseItem` sub-records. When items exist, the parent expense `Amount` is the sum of item amounts.
- Items follow the same date/amount validation rules as expenses.
- Items shall be movable between expenses (cross-category move supported).

#### 2.4.3 Move
- An expense shall be movable between categories within the same project.

#### 2.4.4 Attachments
- Users shall upload file attachments to an expense or an expense item.
- An attachment has a `Name`, `ContentType`, `Size`, `StorageKey` (cloud reference), and `AttachmentType` (`General` or `DeductibleProof`).
- **Temporary upload**: Users may upload a file before creating the expense record. The system stores it as a temporary attachment (`IsTemporary = true`). Once the expense is created, the user attaches the temporary files. Temporary attachments without a parent are purged by a background job.
- Users shall download and delete attachments.

---

### 2.5 Incomes

An **Income** belongs to a Project (not a category) and records money received.

- Users shall create, read, update (JSON Patch), and delete incomes.
- Required fields: `Name`, `Date`, `Amount`.
- An income with a future `Date` (`> tomorrow`) and `Amount > 0` shall be rejected.
- Income records shall be filterable by date range or by year.

---

### 2.6 Savings Plans

A **Plan** belongs to a Project and represents a financial goal (emergency reserve or generic savings).

- Plan types: `EmergencyReserve`, `Saving`.
- Fields: `Name`, `TargetAmount`, `CurrentBalance`, `IsArchived`.
- `GetProgress()`: percentage of target reached.
- `GetRemaining()`: amount still to save.

#### 2.6.1 Plan Entries
- Users shall record deposits and withdrawals via `PlanEntry` records.
- `AmountSigned`: positive (deposit) or negative (withdrawal), cannot be zero.
- `Date` must not be in the future (> tomorrow).
- Entries accumulate into `CurrentBalance`.

---

### 2.7 Tax Year & Deductible Groups

#### 2.7.1 Tax Year Periods
- The system shall enumerate all tax year periods for a project based on its tax year configuration.
- Each period has an `Id` string, a human-readable `Label`, `StartDate`, and `EndDate`.

#### 2.7.2 Deductible Groups
- Within a tax year, users shall create named **Deductible Groups** to cluster tax-deductible expenses.
- A group holds references to `Expense` or `ExpenseItem` records (one-or-the-other per entry, not both).
- Users shall add and remove expense references from a group.
- The system shall return totals per group and an overall total for the tax year.

---

### 2.8 Notifications

- Every user has an in-app notification inbox.
- Notification fields: `Type`, `CodeMessage` (i18n key), `ActionLabelCode`, `IsActionRequired`, `Category`, `IsRead`, `IsSticky`, `ExpiresAt`, `Metadata`.
- Categories: `System`, `Finance`, `Security`, `Collaboration`.
- Users shall fetch all notifications or only unread ones, filtered by category.
- Users shall mark individual notifications or all notifications as read.
- `IsSticky` notifications persist until explicitly read.
- Action-required notifications trigger a flow (e.g. e-mail confirmation); calling `ActionMade` resolves them.

#### 2.8.1 Delivery Channels
- Email: Queued via a background service with distributed locking (`EmailLockedUntil`) to prevent duplicate sends. Supported states: `Pending → Processing → Sent / Failed`.
- Web Push: VAPID-based Web Push. Users register browser subscriptions. The system can broadcast to individual users, a list of users, or all subscribers.
- Push (native mobile): Delivered via the Push channel abstraction.
- SMS: Supported as a channel but requires external provider configuration.
- InApp: Always delivered via the notification inbox.

#### 2.8.2 Web Push Subscriptions
- Users shall subscribe and unsubscribe browser endpoints.
- The public VAPID key shall be exposed via a dedicated endpoint.
- A test notification endpoint shall be available for debugging.

---

### 2.9 Support

- Authenticated or unauthenticated users shall submit a **Contact Us** message with name, e-mail, subject, and message body.

---

## 3. Non-Functional Requirements

### 3.1 Security
- All API endpoints (except public auth routes) require a valid JWT access token.
- The `ProjectAuthorizationMiddleware` intercepts every route segment containing `{projectId}` and enforces role checks: `GET` requires `Viewer`; all mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`) require `Manager`.
- Role-sensitive operations (manage membership, archive project) require `Admin`.
- Tokens must be transmitted over HTTPS only.
- Refresh tokens are stored server-side; client compromise allows server-side invalidation.
- CAPTCHA (Cloudflare Turnstile) is required on login/register forms.
- File upload: content type and size must be validated server-side; storage references (`StorageKey`) are never exposed as raw file paths.

### 3.2 Internationalization (i18n)
- **Backend**: Validation messages and notification codes live in `.resx` files under `EasyFinance.Infrastructure`. All user-visible error messages must be resource-keyed, never hard-coded strings.
- **Web frontend**: All user-visible strings go through `@ngx-translate`. Translation files are JSON under `src/assets/i18n/`. Minimum languages: English (`en-US`) and Portuguese (`pt-BR`).
- **Mobile app**: Equivalent i18n solution applied to all user-facing strings.
- User preferred language (`LanguageCode`) is stored and respected in e-mail generation.

### 3.3 Performance
- Read queries shall use non-tracking EF Core queries (`NoTrackable()`) to avoid unnecessary change-tracking overhead.
- Large result sets shall be paginated or bounded (e.g., "latest N transactions" accepts a count parameter).
- Background jobs (email delivery, attachment cleanup) shall run independently of the request pipeline.

### 3.4 Reliability
- The e-mail delivery background service shall use distributed locking (`EmailLockedUntil + lease duration`) so multiple service instances do not send the same notification twice.
- Temporary attachments not linked to an expense within a configurable TTL shall be purged automatically.
- Migrations shall be idempotent; `dotnet ef migrations` is the sole schema-change mechanism.

### 3.5 Observability
- Every request shall carry a correlation ID injected by the HTTP interceptor (web frontend) and by the API middleware.
- Structured logging must include the correlation ID so requests can be traced end-to-end.

### 3.6 Testability
- Backend code coverage target: ≥ 80%.
- All domain logic must be covered by unit tests using xUnit, FluentAssertions/Shouldly, and Moq.
- Integration tests (Application and Server layers) run against an EF Core in-memory database seeded with 3 users and 3 projects with varying role combinations.
- Each test run uses a uniquely named database to avoid state leakage between parallel tests.
- Entity builder helpers (e.g., `ExpenseBuilder`, `UserBuilder`) in `EasyFinance.Common.Tests` must be used instead of constructing domain objects directly.

---

## 4. Data Model

### 4.1 Entity Relationships

```
User (AspNetUsers)
  ├── UserProject (many) ──► Project (many)
  ├── Notification (many)
  ├── WebPushSubscription (many)
  ├── ContactUs (many, optional)
  └── [CreatedBy on BaseFinancial records]

Project
  ├── Category (many, ordered)
  │     └── Expense (many)
  │           ├── ExpenseItem (many)
  │           └── Attachment (many)
  ├── Income (many)
  │     └── Attachment (many)
  ├── Plan (many)
  │     └── PlanEntry (many)
  └── DeductibleGroup (many, per tax year)
        └── DeductibleGroupExpense (many → Expense | ExpenseItem)
```

### 4.2 Base Entity Fields

Every entity includes:

| Field        | Type     | Notes                              |
|--------------|----------|------------------------------------|
| `Id`         | Guid     | Primary key                        |
| `CreatedDate`| DateTime | Set on creation                    |
| `ModifiedAt` | DateTime | Updated on each mutation           |

### 4.3 Default Categories

The Smart Setup creates these categories with the given budget allocation percentages:

| Category           | % of Income | Default Expenses                                                  |
|--------------------|-------------|-------------------------------------------------------------------|
| Fixed Expenses     | 30%         | Housing, Basic Utilities, Transportation, Healthcare              |
| Comfort            | 20%         | Extra Food, Home Improvements, Subscriptions & Services, Other    |
| Pleasures          | 20%         | Travel & Trips, Entertainment, Going Out                          |
| Your Future        | 25%         | Investments, Emergency Fund, Retirement Savings, Big Projects     |
| Self-Improvement   | 5%          | Education, Mental & Physical Health                               |

### 4.4 Validation Rules

| Entity         | Rule                                                                                        |
|----------------|---------------------------------------------------------------------------------------------|
| User           | FirstName/LastName max 256 chars. LanguageCode must be a valid culture code.                |
| UserProject    | Email max 256 chars. ExpiryDate = SentAt + 7 days. Role must be Viewer/Manager/Admin.       |
| Project        | Name max 150 chars. PreferredCurrency must be a valid ISO 4217 code.                        |
| Category       | Name max 150 chars. DisplayOrder ≥ 0.                                                       |
| Expense        | Name max 150 chars. Budget ≥ 0. Amount ≥ 0. Future date with Amount > 0 → rejected.         |
| ExpenseItem    | Same as Expense.                                                                             |
| Income         | Name max 150 chars. Future date (> tomorrow) with Amount > 0 → rejected.                   |
| Plan           | Name max 150 chars. TargetAmount ≥ 0.                                                       |
| PlanEntry      | AmountSigned ≠ 0. Date must not be in the future (> tomorrow).                              |
| Attachment     | Name max 150 chars, ContentType max 200 chars, StorageKey max 512 chars. Temporary attachments must have no parent. Non-temporary must have exactly one parent. |
| DeductibleGroup | Name max 150 chars.                                                                         |
| DeductibleGroupExpense | Exactly one of ExpenseId or ExpenseItemId must be set.                            |
| PlanEntry      | Date must not be more than 5 years in the past.                                             |
| Notification   | CodeMessage max 100 chars. ActionLabelCode max 100 chars.                                   |
| ContactUs      | Name, Email, Subject, Message all required.                                                 |

---

## 5. API Design

### 5.1 Conventions

- **Base URL**: `https://{host}/api/`
- **Authentication**: `Authorization: Bearer {accessToken}` on all protected routes.
- **Content-Type**: `application/json` for all request/response bodies; `multipart/form-data` for file uploads.
- **JSON Patch** (`PATCH`): Uses RFC 6902 JSON Patch documents. Enum values serialized as strings; flags enum as arrays.
- **Error responses**: Structured `AppResponse` body with per-field error messages and HTTP 400 status.
- **Route nesting**: Financial resources are nested under their project context: `api/Projects/{projectId}/…`
- **Authorization middleware**: Automatically applied to any route containing `{projectId}`.
- **Correlation ID**: Every response includes an `X-Correlation-ID` header.

### 5.2 Endpoint Summary

#### Access Control
| Method | Route                                    | Description                                    |
|--------|------------------------------------------|------------------------------------------------|
| POST   | `/api/AccessControl/register`            | Register new user                              |
| POST   | `/api/AccessControl/login`               | Login (web)                                    |
| POST   | `/api/AccessControl/logout`              | Logout                                         |
| GET    | `/api/AccessControl/IsLogged`            | Check session                                  |
| GET    | `/api/AccessControl/captcha-config`      | Return CAPTCHA public key                      |
| POST   | `/api/AccessControl/refresh-token`       | Rotate refresh token                           |
| POST   | `/api/AccessControl/mobile/login`        | Mobile login                                   |
| POST   | `/api/AccessControl/mobile/refresh-token`| Mobile token refresh                           |
| POST   | `/api/AccessControl/forgotPassword`      | Request password reset                         |
| POST   | `/api/AccessControl/resetPassword`       | Apply password reset token                     |
| PATCH  | `/api/AccessControl`                     | Update account details                         |
| PUT    | `/api/AccessControl/default-project/{id?}`| Set default project                           |
| DELETE | `/api/AccessControl`                     | Delete own account                             |
| GET    | `/api/AccessControl/confirmEmail`        | Confirm e-mail via link                        |
| POST   | `/api/AccessControl/resendConfirmEmail`  | Resend confirmation e-mail                     |
| GET    | `/api/AccessControl/unsubscribe`         | One-click e-mail unsubscribe                   |
| POST   | `/api/AccessControl/2fa/setup`           | Get 2FA QR / shared key                        |
| POST   | `/api/AccessControl/2fa/enable`          | Enable 2FA                                     |
| POST   | `/api/AccessControl/2fa/disable`         | Disable 2FA                                    |
| POST   | `/api/AccessControl/2fa/recovery-codes/regenerate` | Regenerate recovery codes          |

#### Projects
| Method | Route                                                   | Description                            |
|--------|---------------------------------------------------------|----------------------------------------|
| GET    | `/api/Projects`                                         | List all user projects                 |
| POST   | `/api/Projects`                                         | Create project                         |
| GET    | `/api/Projects/{projectId}`                             | Get project details                    |
| PATCH  | `/api/Projects/{projectId}`                             | Update project (name, currency)        |
| PUT    | `/api/Projects/{projectId}/archive`                     | Archive project                        |
| GET    | `/api/Projects/{projectId}/year-summary/{year}`         | Annual income/expense summary          |
| GET    | `/api/Projects/{projectId}/overview/annual/{year}/expenses-by-category` | Annual category breakdown |
| GET    | `/api/Projects/{projectId}/overview/summary`            | Overview summary (date range + recent) |
| GET    | `/api/Projects/{projectId}/latests/{n}`                 | Latest N transactions                  |
| POST   | `/api/Projects/{projectId}/copy-budget-previous-month/{date}` | Copy budgets forward             |
| GET    | `/api/Projects/{projectId}/users`                       | List project members                   |
| PATCH  | `/api/Projects/{projectId}/access`                      | Update membership (invite/change role) |
| POST   | `/api/Projects/{token}/accept`                          | Accept invitation                      |
| DELETE | `/api/Projects/{projectId}/access/{userProjectId}`      | Remove member                          |
| POST   | `/api/Projects/{projectId}/smart-setup`                 | Smart first-time project setup         |

#### Tax Years
| Method | Route                                                                              | Description                     |
|--------|------------------------------------------------------------------------------------|---------------------------------|
| PUT    | `/api/projects/{projectId}/settings/tax-year`                                      | Save tax year config            |
| GET    | `/api/projects/{projectId}/settings/tax-year`                                      | Get tax year config             |
| GET    | `/api/projects/{projectId}/tax-years`                                              | List all tax year periods       |
| GET    | `/api/projects/{projectId}/tax-years/{taxYearId}/deductible-groups`                | List deductible groups          |
| POST   | `/api/projects/{projectId}/tax-years/{taxYearId}/deductible-groups`                | Create deductible group         |
| PUT    | `/api/projects/{projectId}/tax-years/{taxYearId}/deductible-groups/{groupId}`      | Update deductible group         |
| DELETE | `/api/projects/{projectId}/tax-years/{taxYearId}/deductible-groups/{groupId}`      | Delete deductible group         |
| GET    | `/api/projects/{projectId}/tax-years/{taxYearId}/deductible-groups/{groupId}/expenses` | List group expenses         |
| POST   | `/api/projects/{projectId}/tax-years/{taxYearId}/deductible-groups/{groupId}/expenses` | Assign expense to group     |
| DELETE | `/api/projects/{projectId}/tax-years/{taxYearId}/deductible-groups/{groupId}/expenses` | Remove expense from group   |
| GET    | `/api/projects/{projectId}/tax-years/{taxYearId}/deductible-groups/totals`         | Get deductible totals           |

#### Categories
| Method | Route                                                         | Description                      |
|--------|---------------------------------------------------------------|----------------------------------|
| GET    | `/api/Projects/{projectId}/Categories`                        | List categories (date filter)    |
| GET    | `/api/Projects/{projectId}/Categories/DefaultCategories`      | List default category templates  |
| GET    | `/api/Projects/{projectId}/Categories/{categoryId}`           | Get category                     |
| POST   | `/api/Projects/{projectId}/Categories`                        | Create category                  |
| PATCH  | `/api/Projects/{projectId}/Categories/{categoryId}`           | Update category                  |
| PUT    | `/api/Projects/{projectId}/Categories/order`                  | Reorder categories               |
| PUT    | `/api/Projects/{projectId}/Categories/{categoryId}/Archive`   | Archive category                 |

#### Expenses
| Method | Route                                                                                    | Description                    |
|--------|------------------------------------------------------------------------------------------|--------------------------------|
| GET    | `/api/Projects/{projectId}/Categories/{categoryId}/Expenses`                             | List expenses (date filter)    |
| GET    | `/api/Projects/{projectId}/Categories/{categoryId}/Expenses/{expenseId}`                 | Get expense                    |
| POST   | `/api/Projects/{projectId}/Categories/{categoryId}/Expenses`                             | Create expense                 |
| PATCH  | `/api/Projects/{projectId}/Categories/{categoryId}/Expenses/{expenseId}`                 | Update expense                 |
| POST   | `/api/Projects/{projectId}/Categories/{categoryId}/Expenses/{expenseId}/move`            | Move expense to other category |
| DELETE | `/api/Projects/{projectId}/Categories/{categoryId}/Expenses/{expenseId}`                 | Delete expense                 |
| POST   | `/api/Projects/{projectId}/Categories/{categoryId}/Expenses/temporary-attachments`       | Upload temporary attachment    |
| POST   | `/api/Projects/{projectId}/Categories/{categoryId}/Expenses/{expenseId}/attachments`     | Attach files to expense        |
| GET    | `/api/Projects/{projectId}/Categories/{categoryId}/Expenses/{expenseId}/attachments/{id}`| Download attachment            |
| DELETE | `/api/Projects/{projectId}/Categories/{categoryId}/Expenses/{expenseId}/attachments/{id}`| Delete attachment              |

#### Expense Items
| Method | Route                                                                                              | Description             |
|--------|----------------------------------------------------------------------------------------------------|-------------------------|
| POST   | `.../Expenses/{expenseId}/Items/{itemId}/move`                                                     | Move item to other expense |
| DELETE | `.../Expenses/{expenseId}/Items/{itemId}`                                                          | Delete item             |
| POST   | `.../Expenses/{expenseId}/Items/{itemId}/attachments`                                              | Upload item attachment  |
| GET    | `.../Expenses/{expenseId}/Items/{itemId}/attachments/{attachmentId}`                               | Download item attachment |
| DELETE | `.../Expenses/{expenseId}/Items/{itemId}/attachments/{attachmentId}`                               | Delete item attachment  |

#### Incomes
| Method | Route                                                      | Description                   |
|--------|------------------------------------------------------------|-------------------------------|
| GET    | `/api/Projects/{projectId}/Incomes`                        | List incomes (date filter)    |
| GET    | `/api/Projects/{projectId}/Incomes/{incomeId}`             | Get income                    |
| POST   | `/api/Projects/{projectId}/Incomes`                        | Create income                 |
| PATCH  | `/api/Projects/{projectId}/Incomes/{incomeId}`             | Update income                 |
| DELETE | `/api/Projects/{projectId}/Incomes/{incomeId}`             | Delete income                 |

#### Plans
| Method | Route                                                          | Description             |
|--------|----------------------------------------------------------------|-------------------------|
| GET    | `/api/Projects/{projectId}/Plans`                              | List plans              |
| POST   | `/api/Projects/{projectId}/Plans`                              | Create plan             |
| PATCH  | `/api/Projects/{projectId}/Plans/{planId}`                     | Update plan             |
| PUT    | `/api/Projects/{projectId}/Plans/{planId}/archive`             | Archive plan            |
| GET    | `/api/Projects/{projectId}/Plans/{planId}/entries`             | List plan entries       |
| POST   | `/api/Projects/{projectId}/Plans/{planId}/entries`             | Add plan entry          |

#### Notifications
| Method | Route                                    | Description                          |
|--------|------------------------------------------|--------------------------------------|
| GET    | `/api/notifications`                     | List all notifications               |
| GET    | `/api/notifications/unread`              | List unread notifications (filtered) |
| PATCH  | `/api/notifications/{id}/read`           | Mark single notification as read     |
| POST   | `/api/notifications/read-all`            | Mark all as read                     |

#### Web Push
| Method | Route                                  | Description                          |
|--------|----------------------------------------|--------------------------------------|
| GET    | `/api/push/public-key`                 | Get VAPID public key                 |
| POST   | `/api/push/subscribe`                  | Register browser subscription        |
| DELETE | `/api/push/unsubscribe`                | Remove browser subscription          |
| POST   | `/api/push/test`                       | Send test notification               |

#### Support
| Method | Route                   | Description          |
|--------|-------------------------|----------------------|
| POST   | `/api/support/contact`  | Submit contact form  |

---

## 6. Frontend Requirements

### 6.1 Web Application (Angular)

#### 6.1.1 Architecture
- Single-page application using Angular (v21+).
- Feature-based module structure under `src/app/features/`.
- Shared infrastructure in `src/app/core/`.
- HTTP interceptor: attaches Bearer token, injects correlation ID header, handles 401 → refresh token → retry, shows snackbar on 201/DELETE success.
- Route guards: protect feature routes from unauthenticated access.

#### 6.1.2 Feature Screens

| Screen                  | Route                          | Description                                    |
|-------------------------|--------------------------------|------------------------------------------------|
| Login                   | `/login`                       | E-mail + password, CAPTCHA, 2FA step           |
| Register                | `/register`                    | New account form                               |
| First Sign-In           | `/first-sign-in`               | Profile completion after registration          |
| Password Recovery       | `/recovery`                    | Request + apply password reset                 |
| Project List            | `/projects`                    | All user projects                              |
| Create Project          | `/projects/new`                | Project creation form                          |
| Project Detail          | `/projects/:id`                | Dashboard: categories + incomes + plans        |
| Category List           | `/projects/:id/categories`     | List, create, reorder, archive categories      |
| Expense List            | `/projects/:id/categories/:cid/expenses` | List, create, edit, delete expenses  |
| Income List             | `/projects/:id/incomes`        | List, create, edit, delete incomes             |
| Plan List               | `/projects/:id/plans`          | Savings plans + entries                        |
| User Profile            | `/profile`                     | Personal details, 2FA settings                 |
| User Settings           | `/settings`                    | Notification preferences, language, account actions |

#### 6.1.3 UI Components (Core)
- Nav-bar with project switcher.
- Global spinner overlay.
- Snackbar/toast notification.
- Confirmation dialog.
- File upload widget (with temporary attachment support).

### 6.2 Mobile Application (React Native)

#### 6.2.1 Navigation Structure
- Bottom-tab navigator: Categories, Incomes, Monthly Overview, Profile.
- Stack navigators per tab for drill-down flows.

#### 6.2.2 Screens

| Screen                 | Description                                                      |
|------------------------|------------------------------------------------------------------|
| LoginScreen            | E-mail + password login with 2FA step                            |
| RegisterScreen         | New account registration                                         |
| ForgotPasswordScreen   | Request password reset                                           |
| TwoFactorScreen        | Enter TOTP code during login                                     |
| ProjectListScreen      | View and switch between projects                                 |
| CreateProjectScreen    | New project form                                                 |
| CategoryListScreen     | Category list with budget vs. actual progress bars               |
| ExpenseListScreen      | Expense list within a category                                   |
| ExpenseFormScreen      | Create / edit expense                                            |
| IncomeListScreen       | Income list for the active month                                 |
| IncomeFormScreen       | Create / edit income                                             |
| MonthlyOverviewScreen  | Summary: total income, total expenses, balance                   |
| QuickAddModal          | Bottom-sheet for rapid expense/income entry                      |
| ProfileScreen          | Personal details, language setting                               |

---

## 7. Background Services

| Service                        | Trigger            | Responsibility                                                              |
|--------------------------------|--------------------|-----------------------------------------------------------------------------|
| EmailBackgroundService         | Polling interval   | Claims pending email notifications, sends via configured provider, updates status. Uses distributed lease to avoid duplicate sends. |
| NotifierBackgroundService      | Event-driven       | Routes notifications to the appropriate channel(s) per user preference.    |
| TemporaryAttachmentCleanupService | Scheduled timer | Deletes temporary attachments whose TTL has expired.                        |

---

## 8. Infrastructure & Deployment

### 8.1 Backend
- **Runtime**: .NET 8 (ASP.NET Core).
- **Database**: SQL Server (EF Core 8 with migrations).
- **Authentication**: ASP.NET Core Identity + custom JWT issuance.
- **File storage**: Cloud object storage (provider abstracted via `StorageKey`; S3-compatible assumed).
- **E-mail**: Configurable SMTP / transactional e-mail provider.
- **CAPTCHA**: Cloudflare Turnstile server-side validation.
- **Web Push**: VAPID keys generated at startup; stored in configuration.

### 8.2 Web Frontend
- **Framework**: Angular 21 with standalone components.
- **Build**: Angular CLI (`ng build`).
- **Dev proxy**: Served from ASP.NET Core SPA proxy during development (`https://localhost:7003`).
- **Testing**: Karma/Jasmine unit tests; Cypress E2E tests (requires backend).

### 8.3 Mobile App
- **Framework**: React Native (Expo or bare workflow).
- **API auth**: Mobile-specific JWT endpoints to avoid browser-cookie dependencies.
- **Storage**: Secure storage for tokens.

### 8.4 HTTPS
- All environments must use HTTPS.
- Local development: `dotnet dev-certs https` for the backend; the Angular dev server proxies to it.

---

## 9. Enumerations Reference

| Enum                           | Values                                                                       |
|--------------------------------|------------------------------------------------------------------------------|
| `Role`                         | `Viewer = 0`, `Manager = 1`, `Admin = 2`                                    |
| `PlanType`                     | `EmergencyReserve = 1`, `Saving = 2`                                        |
| `TaxYearType`                  | `CalendarYear = 0`, `CustomStartMonth = 1`                                  |
| `TaxYearLabeling`              | `ByStartYear = 0`, `ByEndYear = 1`                                          |
| `AttachmentType`               | `General = 0`, `DeductibleProof = 1`                                        |
| `NotificationType`             | `None = 0`, `EmailConfirmation = 1`, `Information = 2`                      |
| `NotificationCategory`         | `None = 0`, `System = 1`, `Finance = 2`, `Security = 3`, `Collaboration = 4`|
| `NotificationChannelDeliveryStatus` | `Pending = 0`, `Processing = 1`, `Sent = 2`, `Failed = 3`             |
| `NotificationChannels` (flags) | `None = 0`, `Email = 1`, `Sms = 2`, `Push = 4`, `InApp = 8`, `WebPush = 16`|

---

## 10. Architectural Decisions

| Decision                        | Rationale                                                                   |
|---------------------------------|-----------------------------------------------------------------------------|
| Clean Architecture layers       | Enforces dependency direction; domain has zero infrastructure dependencies. |
| `AppResponse<T>` result type    | Avoids exception-based control flow for expected business failures; maps cleanly to HTTP status codes via `BaseController.ValidateResponse()`. |
| Private setters + `SetXxx()` methods | Keeps mutation intent explicit; domain entities self-validate on each setter call. |
| JSON Patch for updates          | Enables partial updates without requiring the full object; reduces bandwidth and accidental field erasure. |
| Manual mappers (no AutoMapper)  | Explicit, type-safe, debuggable; no magic reflection at runtime.            |
| `.resx` for validation messages | Centralises strings; supports future localisation of server-side error messages. |
| Distributed e-mail locking      | Allows multiple backend instances to process the notification queue without duplicate delivery. |
| Temporary attachment lifecycle  | Decouples file upload from record creation; simplifies multi-file form UX.  |
| Soft delete (`IsArchived`)      | Preserves financial history; avoids cascade-delete data loss.               |
| `CreatorName` snapshot on user removal | Preserves audit trail even after a user deletes their account.        |
