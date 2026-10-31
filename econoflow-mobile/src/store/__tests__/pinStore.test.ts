import * as SecureStore from 'expo-secure-store';
import { usePinStore } from '../pinStore';

const mockDigestStringAsync = jest.fn();
jest.mock('expo-crypto', () => ({
  digestStringAsync: (...args: unknown[]) => mockDigestStringAsync(...args),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

beforeEach(() => {
  usePinStore.setState({ pinHash: null, hasPin: false });
});

describe('pinStore', () => {
  it('starts with no pin', () => {
    const state = usePinStore.getState();
    expect(state.hasPin).toBe(false);
    expect(state.pinHash).toBeNull();
  });

  it('setPin stores SHA-256 hash', async () => {
    mockDigestStringAsync.mockResolvedValue('abc123hash');
    await usePinStore.getState().setPin('1234');
    const state = usePinStore.getState();
    expect(state.hasPin).toBe(true);
    expect(state.pinHash).toBe('abc123hash');
    expect(mockDigestStringAsync).toHaveBeenCalledWith('SHA-256', '1234');
  });

  it('verifyPin returns true for matching pin', async () => {
    mockDigestStringAsync
      .mockResolvedValueOnce('storedhash')
      .mockResolvedValueOnce('storedhash');

    await usePinStore.getState().setPin('1234');
    const result = await usePinStore.getState().verifyPin('1234');
    expect(result).toBe(true);
  });

  it('verifyPin returns false for wrong pin', async () => {
    mockDigestStringAsync
      .mockResolvedValueOnce('storedhash')
      .mockResolvedValueOnce('wronghash');

    await usePinStore.getState().setPin('1234');
    const result = await usePinStore.getState().verifyPin('5678');
    expect(result).toBe(false);
  });

  it('verifyPin returns false when no pin is set', async () => {
    const result = await usePinStore.getState().verifyPin('1234');
    expect(result).toBe(false);
  });

  it('clearPin resets state', async () => {
    mockDigestStringAsync.mockResolvedValue('somehash');
    await usePinStore.getState().setPin('1234');
    usePinStore.getState().clearPin();
    const state = usePinStore.getState();
    expect(state.hasPin).toBe(false);
    expect(state.pinHash).toBeNull();
  });
});

describe('pinStore – PIN length', () => {
  beforeEach(() => {
    usePinStore.setState({ pinHash: null, hasPin: false, pinLength: null });
    mockDigestStringAsync.mockReset();
    mockDigestStringAsync.mockResolvedValue('hash:6789');
  });

  it('accepts a PIN of any length the setup screen allows (4 to 6)', async () => {
    for (const pin of ['1234', '12345', '123456']) {
      await usePinStore.getState().setPin(pin);
      expect(usePinStore.getState().hasPin).toBe(true);
      expect(mockDigestStringAsync).toHaveBeenCalledWith('SHA-256', pin);
    }
  });

  it('rejects a PIN outside 4–6 digits instead of silently hashing it', async () => {
    for (const pin of ['123', '1234567', '12ab', '']) {
      mockDigestStringAsync.mockClear();
      await usePinStore.getState().setPin(pin);
      expect(mockDigestStringAsync).not.toHaveBeenCalled();
      expect(usePinStore.getState().hasPin).toBe(false);
    }
  });

  it('remembers how many digits the PIN has, so entry knows when to verify', async () => {
    await usePinStore.getState().setPin('123456');

    expect(usePinStore.getState().pinLength).toBe(6);
  });

  it('persists the length, so it survives a relaunch', () => {
    const options = (usePinStore as unknown as {
      persist: { getOptions: () => { partialize: (s: unknown) => Record<string, unknown> } };
    }).persist.getOptions();

    const persisted = options.partialize({ ...usePinStore.getState(), pinLength: 5 });

    expect(persisted).toMatchObject({ pinLength: 5 });
  });

  it('verifies the same PIN entered on a later launch', async () => {
    await usePinStore.getState().setPin('123456');
    mockDigestStringAsync.mockResolvedValue('hash:6789');

    await expect(usePinStore.getState().verifyPin('123456')).resolves.toBe(true);
  });

  it('forgets the length when the PIN is cleared', async () => {
    await usePinStore.getState().setPin('123456');
    usePinStore.getState().clearPin();

    expect(usePinStore.getState().pinLength).toBeNull();
  });
});

describe('pinStore – hydration', () => {
  const getItemAsync = SecureStore.getItemAsync as jest.Mock;

  const storedValue = (state: Record<string, unknown>) =>
    JSON.stringify({ state, version: 0 });

  // A cold start: a brand-new store module, so nothing a previous test hydrated can leak.
  const coldStart = (): typeof import('../pinStore') => {
    let loaded: typeof import('../pinStore');
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      loaded = require('../pinStore') as typeof import('../pinStore');
    });
    return loaded!;
  };

  beforeEach(() => {
    getItemAsync.mockReset();
    getItemAsync.mockResolvedValue(null);
  });

  it('reads the stored PIN when `hydratePinStore` is called', async () => {
    // The unlock gate decides between "enter your PIN" and "create a PIN" from this
    // store, and it mounts before any other screen: the read has to be startable from
    // outside, exactly like the biometric store's.
    const { hydratePinStore, usePinStore: store } = coldStart();
    getItemAsync.mockResolvedValue(storedValue({ pinHash: 'hash:1234', hasPin: true }));

    expect(store.getState().hasPin).toBe(false);
    await hydratePinStore();

    expect(getItemAsync).toHaveBeenCalledWith('econoflow-pin');
    expect(store.getState().hasPin).toBe(true);
    expect(store.getState().pinHash).toBe('hash:1234');
  });

  it('shares one read between concurrent callers', async () => {
    const { hydratePinStore } = coldStart();

    const first = hydratePinStore();
    const second = hydratePinStore();
    const third = hydratePinStore();

    expect(second).toBe(first);
    expect(third).toBe(first);

    await Promise.all([first, second, third]);
  });

  it('can be asked to read again, so a second session is not stuck on the defaults', async () => {
    const { hydratePinStore, usePinStore: store } = coldStart();
    await hydratePinStore();

    getItemAsync.mockResolvedValue(storedValue({ pinHash: 'hash:0000', hasPin: true }));
    const forced = hydratePinStore({ force: true });
    await forced;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.getState().hasPin).toBe(true);
  });

  it('settles when the read fails instead of leaving the gate waiting forever', async () => {
    const { hydratePinStore } = coldStart();
    getItemAsync.mockRejectedValue(new Error('keychain unavailable'));

    await expect(hydratePinStore()).resolves.toBeUndefined();
  });
});
