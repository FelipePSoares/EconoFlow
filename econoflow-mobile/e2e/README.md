# Detox integration tests

End-to-end coverage of the authentication flows, driven through the real app on an Android
emulator. The specs are numbered because the device state they assume follows that order:

| Spec | Covers |
|------|--------|
| `auth/01-signUp.e2e.js` | Login screen → Register → password confirmation → PIN setup → confirm → biometric offer (declined) → onboarding → new-project flow → restart asks for the PIN |
| `auth/02-login.e2e.js` | Login screen → wrong password → sign in → PIN setup → confirm → biometric offer (declined) → app → restart asks for the PIN → wrong PIN refused → right PIN opens → sign-out → restart asks for credentials again |
| `auth/03-biometricUnlock.e2e.js` | Sign in → PIN setup → **accept** the biometric offer → restart → the sensor is asked on its own → Overview → restart again → sign-out → restart asks for credentials |

Two-factor login (`TwoFactorScreen`) is part of the app's sequence but is not covered here:
the local stack seeds no account with 2FA enabled, and enabling it per run would need the
authenticator enrolment API from the spec.

## Files

| Path | Purpose |
|------|---------|
| `jest.config.js` | Detox's Jest environment, a long timeout, and `e2e/**/*.e2e.js` as the only tests |
| `babel.config.js` | `babel-preset-expo`, so a spec can be plain JS and still share helpers |
| `support/cells.js` | PIN keypad (`pin-key-<digit>`), `passDevicePin`, `appears`/`exists`, "is the app up", sign-out |
| `support/biometrics.js` | `offerFingerprint` (the emulator's sensor) and `declineBiometricOffer` |
| `support/accounts.js` | Seeded account, PINs, the registration profile and a fresh e-mail per run |
| `support/notificationPrompt.js` | Answers the post-login notification prompt if it is showing |
| `support/urls.js` | Start URLs and the restart helpers |
| `artifacts/` | Detox's failure screenshots and logs (git-ignored) |

## Two rules the helpers exist to enforce

**1. Only `adb reverse` makes the app's `localhost` the host's, and the seeded login has to work.**
Every spec signs in as `test1@test.com`, which the dev stack seeds. When that login answers
`401` the Login screen says *"Incorrect login information!"* — which reads like a wrong
password and is not one. Ask the API directly first:

```bash
curl -s -H 'Content-Type: application/json' -H 'X-Client-Type: mobile' \
  -d '{"email":"test1@test.com","password":"Passw0rd!"}' \
  http://localhost:7003/api/AccessControl/mobile/login
```

A `401` there is a stack problem, not a spec problem. The usual cause is a stack that kept a
database written by an older image: Identity's `FindByEmailAsync` matches `NormalizedEmail`,
and a fixture user written without it can never sign in. Recreate it from a current build —
`docker compose -f docker-compose.dev.yml down -v` then `up -d --build`. The row itself:

```bash
docker exec econoflow-dev-postgres-1 psql -U econoflow -d econoflow -c \
  'SELECT "Email","NormalizedEmail" FROM "AspNetUsers";'
```

**2. A screen that arrives on a navigation needs a *wait*, not a check.**
`expect(...).toExist()` samples the tree once; `waitFor(...)` polls. Every "is this screen
here?" question in the helpers that follows a navigation uses `waitFor` (via `appears`,
`declineBiometricOffer`, `passDevicePin`), because sampling kept reporting "nothing there"
one frame before the screen arrived. The PIN *steps* are told apart by their ids
(`pin-create-continue`, `pin-confirm-title`), never by their translated text.


## Running

See [ENVIRONMENT.md](./ENVIRONMENT.md) for the full procedure (stack, emulator, both APKs,
Metro, `adb reverse`, and a checklist); `setup.md` → **Integration tests with Detox** holds the
longer build notes. In short:

```powershell
docker compose -f docker-compose.dev.yml down -v && docker compose -f docker-compose.dev.yml up -d --build
adb reverse tcp:7003 tcp:7003
adb reverse tcp:8081 tcp:8081
cd econoflow-mobile
npm run e2e:build
DETOX_CI=1 DETOX_CI_ADB=emulator-5554 npx detox test -c android.emu.debug --reuse --maxWorkers 1
```

## What the flows pin down

The specs encode the product's promise, not the implementation:

1. First session: Login → (2FA) → **create the PIN** → **biometric offer** → app.
2. Every later launch: biometrics **if enabled**, otherwise the PIN — never a password.
3. Signing out erases the session: the next launch asks for credentials.
4. Registration signs in directly and continues with the same sequence, then onboarding.

The PIN and the biometric answer are stored per **device**, so a step that creates the PIN
only happens on a device that does not have one yet. That is why `01-signUp.e2e.js` comes
first on a freshly wiped app (`adb shell pm clear pt.econoflow.mobile`), and it is why it and
`02-login.e2e.js` relaunch through the automation entry point (`econoflow://e2e/open`, which
only a debug build routes) — the Login screen is otherwise unreachable while the device holds
a session. Detox shards spec files by expected duration rather than by filename, so the
numbering is the documented order, not something a spec can rely on: each one tolerates the
state the previous one leaves, and `03-biometricUnlock.e2e.js` accepts a device that already
has a PIN by using the one it stored.
