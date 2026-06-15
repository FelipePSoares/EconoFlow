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
      biometricPromptSkipped: false,
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
