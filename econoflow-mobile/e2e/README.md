# Detox integration tests

End-to-end coverage of the authentication flows, driven through the real app on an Android
emulator:

| Spec | Covers |
|------|--------|
| `auth/signUp.e2e.js` | Login screen → Register → password confirmation → PIN setup → confirm → biometric offer (declined) → onboarding → new-project flow → restart asks for the PIN |
| `auth/login.e2e.js` | Login screen → wrong password → sign in → PIN setup → confirm → biometric offer (declined) → app → restart asks for the PIN → wrong PIN refused → right PIN opens → sign-out → restart asks for credentials again |

Two-factor login (`TwoFactorScreen`) is part of the app's sequence but is not covered here:
the local stack seeds no account with 2FA enabled, and enabling it per run would need the
authenticator enrolment API from the spec.

## Files

| Path | Purpose |
|------|---------|
| `jest.config.js` | Detox's Jest environment, a long timeout, and `e2e/**/*.e2e.js` as the only tests |
| `babel.config.js` | `babel-preset-expo`, so a spec can be plain JS and still share helpers |
| `support/cells.js` | PIN keypad (`pin-key-<digit>`), "is the app up", sign-out |
| `support/accounts.js` | Seeded account, PINs, the registration profile and a fresh e-mail per run |
| `support/notificationPrompt.js` | Answers the post-login notification prompt if it is showing |
| `support/urls.js` | Start URLs and the restart helpers |
| `artifacts/` | Detox's failure screenshots and logs (git-ignored) |

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
only happens on a device that does not have one yet. That is why the specs run in filename
order (`signUp` first) and why `signUp.e2e.js` starts with the sign-out that brings the
device back to the Login screen.
