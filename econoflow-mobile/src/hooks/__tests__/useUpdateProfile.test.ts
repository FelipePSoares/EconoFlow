import * as UserApi from '../../api/user.api';
import { useUpdateProfile } from '../useUpdateProfile';
import { useAuthStore } from '../../store/authStore';
import type { User } from '../../api/types';

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

describe('useUpdateProfile', () => {
  it('mutationFn calls patchUser with the provided patches', async () => {
    (UserApi.patchUser as jest.Mock).mockResolvedValue({ data: mockUser });

    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (patches: unknown[]) => Promise<User>;
    useMutation.mockImplementationOnce((opts: { mutationFn: typeof capturedMutationFn }) => {
      capturedMutationFn = opts.mutationFn;
      return { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
    });

    useUpdateProfile();

    const patches = [{ op: 'replace', path: '/firstName', value: 'John' }];
    await capturedMutationFn(patches);

    expect(UserApi.patchUser).toHaveBeenCalledWith(patches);
  });

  it('onSuccess calls setUser with the returned user', () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedOnSuccess!: (user: User) => void;
    useMutation.mockImplementationOnce((opts: { onSuccess: typeof capturedOnSuccess }) => {
      capturedOnSuccess = opts.onSuccess;
      return { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
    });

    useUpdateProfile();

    capturedOnSuccess(mockUser);

    expect(mockSetUser).toHaveBeenCalledWith(mockUser);
  });

  it('onSuccess invalidates the currentUser query', () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedOnSuccess!: (user: User) => void;
    useMutation.mockImplementationOnce((opts: { onSuccess: typeof capturedOnSuccess }) => {
      capturedOnSuccess = opts.onSuccess;
      return { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
    });

    useUpdateProfile();

    capturedOnSuccess(mockUser);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['currentUser'] });
  });
});
