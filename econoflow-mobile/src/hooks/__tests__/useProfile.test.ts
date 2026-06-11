import * as UserApi from '../../api/user.api';
import {
  useChangePassword,
  useChangeEmail,
  useTwoFactorSetup,
  useEnableTwoFactor,
  useDisableTwoFactor,
} from '../useProfile';
import { useAuthStore } from '../../store/authStore';
import type { User, ManageInfoRequest, EnableTwoFactorRequest, EnableTwoFactorResponse, DisableTwoFactorRequest, TwoFactorSetupInfo } from '../../api/types';

jest.mock('../../api/user.api');
jest.mock('../../store/authStore');

const mockSetUser = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn((opts) => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
    _opts: opts,
  })),
  useQuery: jest.fn((opts) => ({
    data: undefined,
    isLoading: false,
    isError: false,
    _opts: opts,
  })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

(useAuthStore as unknown as jest.Mock).mockReturnValue({ setUser: mockSetUser });

const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  fullName: 'John Doe',
  enabled: true,
  isFirstLogin: false,
  emailConfirmed: true,
  twoFactorEnabled: false,
  defaultProjectId: null,
  notificationChannels: [],
  languageCode: 'en',
  isBetaTester: false,
};

beforeEach(() => {
  mockSetUser.mockReset();
  mockInvalidateQueries.mockReset();
});

// ─── useChangePassword ────────────────────────────────────────────────────────

describe('useChangePassword', () => {
  it('mutationFn calls manageInfo with oldPassword and newPassword', async () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (req: ManageInfoRequest) => Promise<unknown>;
    useMutation.mockImplementationOnce((opts: { mutationFn: typeof capturedMutationFn }) => {
      capturedMutationFn = opts.mutationFn;
      return { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
    });

    (UserApi.manageInfo as jest.Mock).mockResolvedValue({ data: {} });

    useChangePassword();

    const req: ManageInfoRequest = { oldPassword: 'old', newPassword: 'newpass' };
    await capturedMutationFn(req);

    expect(UserApi.manageInfo).toHaveBeenCalledWith(req);
  });
});

// ─── useChangeEmail ───────────────────────────────────────────────────────────

describe('useChangeEmail', () => {
  it('mutationFn calls manageInfo with newEmail', async () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (req: ManageInfoRequest) => Promise<unknown>;
    useMutation.mockImplementationOnce((opts: { mutationFn: typeof capturedMutationFn }) => {
      capturedMutationFn = opts.mutationFn;
      return { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
    });

    (UserApi.manageInfo as jest.Mock).mockResolvedValue({ data: {} });

    useChangeEmail();

    const req: ManageInfoRequest = { newEmail: 'new@example.com' };
    await capturedMutationFn(req);

    expect(UserApi.manageInfo).toHaveBeenCalledWith(req);
  });
});

// ─── useTwoFactorSetup ────────────────────────────────────────────────────────

describe('useTwoFactorSetup', () => {
  it('queryFn calls getTwoFactorSetup', async () => {
    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    let capturedQueryFn!: () => Promise<TwoFactorSetupInfo>;
    useQuery.mockImplementationOnce((opts: { queryFn: typeof capturedQueryFn }) => {
      capturedQueryFn = opts.queryFn;
      return { data: undefined, isLoading: false, isError: false };
    });

    const mockSetup: TwoFactorSetupInfo = {
      isTwoFactorEnabled: false,
      sharedKey: 'abc123',
      otpAuthUri: 'otpauth://totp/...',
    };
    (UserApi.getTwoFactorSetup as jest.Mock).mockResolvedValue({ data: mockSetup });

    useTwoFactorSetup();

    const result = await capturedQueryFn();
    expect(UserApi.getTwoFactorSetup).toHaveBeenCalled();
    expect(result).toEqual(mockSetup);
  });
});

// ─── useEnableTwoFactor ───────────────────────────────────────────────────────

describe('useEnableTwoFactor', () => {
  it('mutationFn calls enableTwoFactor with code', async () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (req: EnableTwoFactorRequest) => Promise<EnableTwoFactorResponse>;
    useMutation.mockImplementationOnce((opts: { mutationFn: typeof capturedMutationFn }) => {
      capturedMutationFn = opts.mutationFn;
      return { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
    });

    const mockResponse: EnableTwoFactorResponse = {
      twoFactorEnabled: true,
      recoveryCodes: ['code1'],
    };
    (UserApi.enableTwoFactor as jest.Mock).mockResolvedValue({ data: mockResponse });

    useEnableTwoFactor();

    const req: EnableTwoFactorRequest = { code: '123456' };
    const result = await capturedMutationFn(req);

    expect(UserApi.enableTwoFactor).toHaveBeenCalledWith(req);
    expect(result).toEqual(mockResponse);
  });

  it('onSuccess calls setUser with updated twoFactorEnabled=true', () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedOnSuccess!: (data: EnableTwoFactorResponse) => void;
    useMutation.mockImplementationOnce((opts: { onSuccess: typeof capturedOnSuccess }) => {
      capturedOnSuccess = opts.onSuccess;
      return { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
    });

    (useAuthStore as unknown as jest.Mock).mockReturnValue({ setUser: mockSetUser, user: mockUser });

    useEnableTwoFactor();

    const data: EnableTwoFactorResponse = { twoFactorEnabled: true, recoveryCodes: [] };
    capturedOnSuccess(data);

    expect(mockSetUser).toHaveBeenCalledWith(
      expect.objectContaining({ twoFactorEnabled: true }),
    );
  });
});

// ─── useDisableTwoFactor ──────────────────────────────────────────────────────

describe('useDisableTwoFactor', () => {
  it('mutationFn calls disableTwoFactor with request', async () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (req: DisableTwoFactorRequest) => Promise<unknown>;
    useMutation.mockImplementationOnce((opts: { mutationFn: typeof capturedMutationFn }) => {
      capturedMutationFn = opts.mutationFn;
      return { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
    });

    (UserApi.disableTwoFactor as jest.Mock).mockResolvedValue({ data: { twoFactorEnabled: false } });

    useDisableTwoFactor();

    const req: DisableTwoFactorRequest = { password: 'pw', twoFactorCode: '111111' };
    await capturedMutationFn(req);

    expect(UserApi.disableTwoFactor).toHaveBeenCalledWith(req);
  });

  it('onSuccess calls setUser with updated twoFactorEnabled=false', () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedOnSuccess!: () => void;
    useMutation.mockImplementationOnce((opts: { onSuccess: typeof capturedOnSuccess }) => {
      capturedOnSuccess = opts.onSuccess;
      return { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
    });

    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      setUser: mockSetUser,
      user: { ...mockUser, twoFactorEnabled: true },
    });

    useDisableTwoFactor();
    capturedOnSuccess();

    expect(mockSetUser).toHaveBeenCalledWith(
      expect.objectContaining({ twoFactorEnabled: false }),
    );
  });
});
