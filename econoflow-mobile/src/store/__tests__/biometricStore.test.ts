import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const getItemAsync = SecureStore.getItemAsync as jest.Mock;
const setItemAsync = SecureStore.setItemAsync as jest.Mock;

const STORAGE_KEY = 'econoflow-biometric';

const storedValue = (state: Record<string, unknown>) => JSON.stringify({ state, version: 0 });

type BiometricModule = typeof import('../biometricStore');

/**
 * A cold start: a brand-new store module, so nothing a previous test hydrated (or typed
 * into) can leak into this one.
 */
const coldStart = (): BiometricModule => {
  let loaded: BiometricModule;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('../biometricStore') as BiometricModule;
  });
  return loaded!;
};

describe('biometricStore', () => {
  const { useBiometricStore } = coldStart();

  beforeEach(() => {
    useBiometricStore.setState({
      biometricEnabled: false,
      biometricPromptSkipped: false,
      hydrated: false,
    });
  });

  it('defaults to biometricEnabled false', () => {
    expect(useBiometricStore.getState().biometricEnabled).toBe(false);
  });

  it('defaults to biometricPromptSkipped false', () => {
    expect(useBiometricStore.getState().biometricPromptSkipped).toBe(false);
  });

  it('setBiometricEnabled(true) enables biometrics', () => {
    useBiometricStore.getState().setBiometricEnabled(true);
    expect(useBiometricStore.getState().biometricEnabled).toBe(true);
  });

  it('setBiometricEnabled(false) disables biometrics', () => {
    useBiometricStore.getState().setBiometricEnabled(true);
    useBiometricStore.getState().setBiometricEnabled(false);
    expect(useBiometricStore.getState().biometricEnabled).toBe(false);
  });

  it('setBiometricPromptSkipped sets to true', () => {
    useBiometricStore.getState().setBiometricPromptSkipped();
    expect(useBiometricStore.getState().biometricPromptSkipped).toBe(true);
  });

  it('resetBiometricPromptSkipped resets to false', () => {
    useBiometricStore.getState().setBiometricPromptSkipped();
    useBiometricStore.getState().resetBiometricPromptSkipped();
    expect(useBiometricStore.getState().biometricPromptSkipped).toBe(false);
  });

  it('clearBiometric resets biometricEnabled and biometricPromptSkipped', () => {
    useBiometricStore.getState().setBiometricEnabled(true);
    useBiometricStore.getState().setBiometricPromptSkipped();
    useBiometricStore.getState().clearBiometric();
    expect(useBiometricStore.getState().biometricEnabled).toBe(false);
    expect(useBiometricStore.getState().biometricPromptSkipped).toBe(false);
  });

});

describe('biometricStore – hydration (#1052)', () => {
  beforeEach(() => {
    getItemAsync.mockReset();
    getItemAsync.mockResolvedValue(null);
    setItemAsync.mockReset();
    setItemAsync.mockResolvedValue(undefined);
  });

  it('starts hydration from `hydrateBiometricStore`, not from the import', async () => {
    const { hydrateBiometricStore, useBiometricStore } = coldStart();

    // The read must not already be in flight when the module is evaluated: that is the
    // race a tap used to lose.
    expect(getItemAsync).not.toHaveBeenCalled();
    expect(useBiometricStore.persist.hasHydrated()).toBe(false);

    getItemAsync.mockResolvedValue(storedValue({ biometricEnabled: false, biometricPromptSkipped: false }));
    await hydrateBiometricStore();

    expect(getItemAsync).toHaveBeenCalledTimes(1);
    expect(useBiometricStore.getState().hydrated).toBe(true);
  });

  it('starts the read only once for every caller', async () => {
    const { hydrateBiometricStore } = coldStart();

    await Promise.all([hydrateBiometricStore(), hydrateBiometricStore(), hydrateBiometricStore()]);

    expect(getItemAsync).toHaveBeenCalledTimes(1);
  });

  it('applies the stored value when the user changed nothing before it was read', async () => {
    const { hydrateBiometricStore, useBiometricStore } = coldStart();
    getItemAsync.mockResolvedValue(storedValue({ biometricEnabled: true, biometricPromptSkipped: false }));

    await hydrateBiometricStore();

    expect(useBiometricStore.getState().biometricEnabled).toBe(true);
  });

  it('a tap before the read finishes is not reverted by it (#1052)', async () => {
    // The reported bug: the stored value was replayed over a value the user had already
    // tapped in, so the switch flipped back and the user had to tap again.
    const { hydrateBiometricStore, useBiometricStore } = coldStart();
    getItemAsync.mockResolvedValue(storedValue({ biometricEnabled: false, biometricPromptSkipped: false }));

    useBiometricStore.getState().setBiometricEnabled(true);
    await hydrateBiometricStore();

    expect(useBiometricStore.getState().biometricEnabled).toBe(true);
  });

  it('a tap made while the read is in flight cannot be reverted by it', async () => {
    // The read is deliberately slow — the real one is a SecureStore keychain round trip.
    const { hydrateBiometricStore, useBiometricStore } = coldStart();
    let releaseRead: (value: string | null) => void = () => {};
    getItemAsync.mockImplementation(
      () => new Promise<string | null>((resolve) => { releaseRead = resolve; }),
    );

    const hydrating = hydrateBiometricStore();
    // The read has started but has not answered yet.
    await new Promise((resolve) => setTimeout(resolve, 0));
    useBiometricStore.getState().setBiometricEnabled(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseRead(storedValue({ biometricEnabled: false, biometricPromptSkipped: false }));
    await hydrating;

    expect(useBiometricStore.getState().biometricEnabled).toBe(true);
  });

  it('persists the local choice so the next launch reads it, not the old stored value', async () => {
    const { hydrateBiometricStore, useBiometricStore } = coldStart();
    getItemAsync.mockResolvedValue(storedValue({ biometricEnabled: false, biometricPromptSkipped: false }));

    useBiometricStore.getState().setBiometricEnabled(true);
    await hydrateBiometricStore();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const written = setItemAsync.mock.calls
      .filter(([key]) => key === STORAGE_KEY)
      .map(([, value]) => JSON.parse(value as string).state.biometricEnabled);
    expect(written).toContain(true);
  });

  // #1052: a sign-out leaves the device to the next person. The next launch reads what was
  // stored, so a value left in SecureStore comes back as "biometrics already enabled".
  it('a sign-out is not undone by the next cold start', async () => {
    const { hydrateBiometricStore, useBiometricStore: store } = coldStart();
    getItemAsync.mockResolvedValue(storedValue({ biometricEnabled: false, biometricPromptSkipped: false }));
    await hydrateBiometricStore();
    store.getState().setBiometricEnabled(true);
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    store.getState().clearBiometric();
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    const written = setItemAsync.mock.calls
      .filter(([key]) => key === STORAGE_KEY)
      .map(([, value]) => JSON.parse(value as string).state);
    expect(written.at(-1)).toMatchObject({ biometricEnabled: false, biometricPromptSkipped: false });
  });

  it('keeps the enrollment prompt answer across a cold start', async () => {
    const { hydrateBiometricStore, useBiometricStore } = coldStart();
    getItemAsync.mockResolvedValue(storedValue({ biometricEnabled: false, biometricPromptSkipped: true }));

    await hydrateBiometricStore();

    expect(useBiometricStore.getState().biometricPromptSkipped).toBe(true);
  });

  it('can be asked to read the stored value again', async () => {
    // The read is started by the auth rehydration, which is also where a fresh session
    // begins; a second session in the same app run must not be stuck on the defaults.
    const { hydrateBiometricStore, useBiometricStore } = coldStart();
    getItemAsync.mockResolvedValue(storedValue({ biometricEnabled: false, biometricPromptSkipped: false }));
    await hydrateBiometricStore();

    getItemAsync.mockResolvedValue(storedValue({ biometricEnabled: true, biometricPromptSkipped: false }));
    await hydrateBiometricStore({ force: true });

    expect(getItemAsync).toHaveBeenCalledTimes(2);
    expect(useBiometricStore.getState().biometricEnabled).toBe(true);
  });

  it('reports hydration as finished even when the read fails', async () => {
    const { hydrateBiometricStore, useBiometricStore } = coldStart();
    getItemAsync.mockRejectedValue(new Error('keychain unavailable'));

    await hydrateBiometricStore();

    expect(useBiometricStore.getState().hydrated).toBe(true);
  });
});

describe('biometricStore – the unlock gate waits for the stored answer (#1116)', () => {
  beforeEach(() => {
    getItemAsync.mockReset();
    getItemAsync.mockResolvedValue(null);
    setItemAsync.mockReset();
    setItemAsync.mockResolvedValue(undefined);
  });

  // The read is deliberately slow — the real one is a SecureStore keychain round trip, and
  // it is the gap the gate used to decide in.
  const holdRead = () => {
    let releaseRead: (value: string | null) => void = () => {};
    getItemAsync.mockImplementation(
      () => new Promise<string | null>((resolve) => { releaseRead = resolve; }),
    );
    return (value: string | null) => releaseRead(value);
  };

  it('is not marked answering until the stored value has landed', async () => {
    const { hydrateBiometricStore, useBiometricStore } = coldStart();
    const release = holdRead();

    const hydrating = hydrateBiometricStore();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Still reading: the gate must wait instead of deciding on the default "off". Only
    // `hasHydrated()` can say so — a module-level flag would read "answered" from an
    // earlier read, because nothing announces that a read has begun.
    expect(useBiometricStore.persist.hasHydrated()).toBe(false);
    expect(useBiometricStore.getState().biometricEnabled).toBe(false);

    release(storedValue({ biometricEnabled: true, biometricPromptSkipped: true }));
    await hydrating;

    expect(useBiometricStore.persist.hasHydrated()).toBe(true);
    expect(useBiometricStore.getState().biometricEnabled).toBe(true);
  });

  it('answers again when a forced read starts, and again when it lands', async () => {
    // A login starts a forced read on top of whatever the last session left in memory. A
    // gate mounted between the two must not read the previous session's "biometrics on"
    // as this session's answer.
    const { hydrateBiometricStore, useBiometricStore } = coldStart();
    getItemAsync.mockResolvedValue(storedValue({ biometricEnabled: true, biometricPromptSkipped: true }));
    await hydrateBiometricStore();

    const release = holdRead();
    void hydrateBiometricStore({ force: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useBiometricStore.persist.hasHydrated()).toBe(false);

    release(storedValue({ biometricEnabled: false, biometricPromptSkipped: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useBiometricStore.persist.hasHydrated()).toBe(true);
    expect(useBiometricStore.getState().biometricEnabled).toBe(false);
  });

  it('keeps the last stored value on screen while a forced read is in flight', async () => {
    // The gate holds this value too: a re-read must not blank it to "off" for a moment and
    // send the customer to the keypad before the answer arrives.
    const { hydrateBiometricStore, useBiometricStore } = coldStart();
    getItemAsync.mockResolvedValue(storedValue({ biometricEnabled: true, biometricPromptSkipped: true }));
    await hydrateBiometricStore();

    const release = holdRead();
    void hydrateBiometricStore({ force: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useBiometricStore.getState().biometricEnabled).toBe(true);
    release(storedValue({ biometricEnabled: true, biometricPromptSkipped: true }));
  });
});
