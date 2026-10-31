/**
 * The accounts, PINs and profile the suite uses.
 */

/**
 * A seeded account from `EasyFinance.Server/Config/DevelopmentTestDataSeeder.cs`, which the
 * local stack seeds with `EconoFlow_SEED_DEVELOPMENT_DATA=true` (`docker-compose.dev.yml`).
 *
 * `test1@test.com` already has a first and last name, so it walks the plain login path —
 * PIN, then the app — without the onboarding screen in between.
 */
export const SEEDED_ACCOUNT = {
  email: 'test1@test.com',
  password: 'Passw0rd!',
};

/**
 * The PIN the setup spec creates on the device: 4 digits, the shortest the app allows, and
 * not a run of one digit, so a wrong PIN in an unlock spec is unmistakably wrong.
 */
export const PIN = '2580';

/**
 * A PIN that differs from `base` in its last digit, for the "wrong PIN is refused" case.
 * Derived rather than hard-coded, so a future change of `PIN` cannot accidentally make the
 * two equal and turn the assertion into one that proves nothing.
 */
export const wrongPin = (base) => {
  const digits = String(base);
  return `${digits.slice(0, -1)}${(Number(digits.slice(-1)) + 1) % 10}`;
};

/**
 * A password the registration form accepts (`RegisterScreen`'s `PASSWORD_REGEX`: at least
 * eight characters with a lower-case letter, an upper-case letter, a digit and a symbol).
 */
export const REGISTRATION_PASSWORD = 'E2ePassw0rd!';

/**
 * A fresh address for the registration spec.
 *
 * Registration hits a real backend that keeps the account, so a fixed address would be
 * refused as already registered on the second run.
 */
export const newAccountEmail = () =>
  `e2e+${Date.now()}${Math.floor(Math.random() * 1000)}@econoflow.test`;

/** The profile filled in during the onboarding that follows a new registration. */
export const REGISTRATION_PROFILE = {
  firstName: 'Detox',
  lastName: 'Tester',
};
