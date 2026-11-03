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
password and is not one. `scripts/wsl/api-login.sh` asks the API directly, and
`scripts/wsl/fixture-user.sh` shows the row: Identity's `FindByEmailAsync` matches
`NormalizedEmail`, so a fixture user written without it can never sign in.

**2. A screen that arrives on a navigation needs a *wait*, not a check.**
`expect(...).toExist()` samples the tree once; `waitFor(...)` polls. Every "is this screen
here?" question in the helpers that follows a navigation uses `waitFor` (via `appears`,
`declineBiometricOffer`, `passDevicePin`), because sampling kept reporting "nothing there"
one frame before the screen arrived. The PIN *steps* are told apart by their ids
(`pin-create-continue`, `pin-confirm-title`), never by their translated text.


## Running

See `setup.md` → **Integration tests with Detox** for the full procedure. In short:

```powershell
docker compose -f docker-compose.dev.yml up -d
adb reverse tcp:7003 tcp:7003
cd econoflow-mobile
npm run e2e:build
npm run e2e:test
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
