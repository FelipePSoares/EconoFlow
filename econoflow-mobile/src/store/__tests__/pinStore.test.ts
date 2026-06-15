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
