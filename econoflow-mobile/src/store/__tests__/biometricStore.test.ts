import { useBiometricStore } from '../biometricStore';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('biometricStore', () => {
  beforeEach(() => {
    useBiometricStore.setState({
      biometricEnabled: false,
      skipCount: 0,
    });
  });

  it('defaults to biometricEnabled false', () => {
    expect(useBiometricStore.getState().biometricEnabled).toBe(false);
  });

  it('defaults to skipCount 0', () => {
    expect(useBiometricStore.getState().skipCount).toBe(0);
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

  it('incrementSkipCount increases skipCount by 1', () => {
    useBiometricStore.getState().incrementSkipCount();
    expect(useBiometricStore.getState().skipCount).toBe(1);
    useBiometricStore.getState().incrementSkipCount();
    expect(useBiometricStore.getState().skipCount).toBe(2);
  });

  it('resetSkipCount resets to 0', () => {
    useBiometricStore.getState().incrementSkipCount();
    useBiometricStore.getState().resetSkipCount();
    expect(useBiometricStore.getState().skipCount).toBe(0);
  });

  it('clearBiometric resets biometricEnabled and skipCount', () => {
    useBiometricStore.getState().setBiometricEnabled(true);
    useBiometricStore.getState().incrementSkipCount();
    useBiometricStore.getState().clearBiometric();
    expect(useBiometricStore.getState().biometricEnabled).toBe(false);
    expect(useBiometricStore.getState().skipCount).toBe(0);
  });
});
