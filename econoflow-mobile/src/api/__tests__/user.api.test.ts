import {
  getUser,
  patchUser,
  manageInfo,
  getTwoFactorSetup,
  enableTwoFactor,
  disableTwoFactor,
} from '../user.api';
import { apiClient } from '../client';
import type { ManageInfoRequest, EnableTwoFactorRequest, DisableTwoFactorRequest } from '../types';

jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

describe('user.api — existing functions', () => {
  afterEach(() => jest.clearAllMocks());

  it('getUser GETs /api/AccessControl', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: {} });
    await getUser();
    expect(apiClient.get).toHaveBeenCalledWith('/api/AccessControl');
  });

  it('patchUser PATCHes /api/AccessControl with ops', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: {} });
    const ops = [{ op: 'replace' as const, path: '/firstName', value: 'Alice' }];
    await patchUser(ops);
    expect(apiClient.patch).toHaveBeenCalledWith('/api/AccessControl', ops);
  });
});

describe('user.api — manageInfo', () => {
  afterEach(() => jest.clearAllMocks());

  it('POSTs to /api/AccessControl/manage/info for password change', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
    const req: ManageInfoRequest = { oldPassword: 'old', newPassword: 'new' };
    await manageInfo(req);
    expect(apiClient.post).toHaveBeenCalledWith('/api/AccessControl/manage/info', req);
  });

  it('POSTs to /api/AccessControl/manage/info for email change', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
    const req: ManageInfoRequest = { newEmail: 'new@example.com' };
    await manageInfo(req);
    expect(apiClient.post).toHaveBeenCalledWith('/api/AccessControl/manage/info', req);
  });
});

describe('user.api — getTwoFactorSetup', () => {
  afterEach(() => jest.clearAllMocks());

  it('GETs /api/AccessControl/2fa/setup', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { isTwoFactorEnabled: false, sharedKey: 'key', otpAuthUri: 'otpauth://...' },
    });
    await getTwoFactorSetup();
    expect(apiClient.get).toHaveBeenCalledWith('/api/AccessControl/2fa/setup');
  });
});

describe('user.api — enableTwoFactor', () => {
  afterEach(() => jest.clearAllMocks());

  it('POSTs to /api/AccessControl/2fa/enable with code', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { twoFactorEnabled: true, recoveryCodes: ['code1', 'code2'] },
    });
    const req: EnableTwoFactorRequest = { code: '123456' };
    await enableTwoFactor(req);
    expect(apiClient.post).toHaveBeenCalledWith('/api/AccessControl/2fa/enable', req);
  });
});

describe('user.api — disableTwoFactor', () => {
  afterEach(() => jest.clearAllMocks());

  it('POSTs to /api/AccessControl/2fa/disable with password and twoFactorCode', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { twoFactorEnabled: false },
    });
    const req: DisableTwoFactorRequest = { password: 'mypassword', twoFactorCode: '654321' };
    await disableTwoFactor(req);
    expect(apiClient.post).toHaveBeenCalledWith('/api/AccessControl/2fa/disable', req);
  });

  it('POSTs to /api/AccessControl/2fa/disable with recoveryCode', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { twoFactorEnabled: false },
    });
    const req: DisableTwoFactorRequest = { password: 'mypassword', twoFactorRecoveryCode: 'recovery-code-1' };
    await disableTwoFactor(req);
    expect(apiClient.post).toHaveBeenCalledWith('/api/AccessControl/2fa/disable', req);
  });
});
