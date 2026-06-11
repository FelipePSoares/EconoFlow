import * as NotificationsApi from '../../api/notifications.api';
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
} from '../useNotifications';

jest.mock('../../api/notifications.api');

const mockInvalidateQueries = jest.fn();

beforeEach(() => {
  mockInvalidateQueries.mockReset();
});

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((opts) => ({ data: undefined, isLoading: false, _opts: opts })),
  useMutation: jest.fn((opts) => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
    _opts: opts,
  })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
}));

describe('useNotifications', () => {
  it('passes correct queryKey and refetchInterval', () => {
    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    useNotifications();
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['notifications'],
        refetchInterval: 60_000,
      }),
    );
  });

  it('queryFn calls getNotifications and unwraps data', async () => {
    const mockData = [{ id: 'n-1', codeMessage: 'test' }];
    (NotificationsApi.getNotifications as jest.Mock).mockResolvedValue({ data: mockData });

    const { useQuery } = jest.requireMock('@tanstack/react-query') as { useQuery: jest.Mock };
    let capturedQueryFn!: () => Promise<unknown>;
    useQuery.mockImplementationOnce((opts: { queryFn: typeof capturedQueryFn }) => {
      capturedQueryFn = opts.queryFn;
      return { data: undefined, isLoading: false };
    });

    useNotifications();
    const result = await capturedQueryFn();

    expect(NotificationsApi.getNotifications).toHaveBeenCalled();
    expect(result).toEqual(mockData);
  });
});

describe('useMarkAsRead', () => {
  it('mutationFn calls markAsRead with notificationId', async () => {
    (NotificationsApi.markAsRead as jest.Mock).mockResolvedValue({ data: undefined });

    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (id: string) => Promise<unknown>;
    useMutation.mockImplementationOnce((opts: { mutationFn: typeof capturedMutationFn }) => {
      capturedMutationFn = opts.mutationFn;
      return { mutate: jest.fn(), isPending: false };
    });

    useMarkAsRead();
    await capturedMutationFn('notif-id-1');

    expect(NotificationsApi.markAsRead).toHaveBeenCalledWith('notif-id-1');
  });

  it('onSuccess invalidates notifications query', () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedOnSuccess!: () => void;
    useMutation.mockImplementationOnce((opts: { onSuccess: typeof capturedOnSuccess }) => {
      capturedOnSuccess = opts.onSuccess;
      return { mutate: jest.fn(), isPending: false };
    });

    useMarkAsRead();
    capturedOnSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });
});

describe('useMarkAllAsRead', () => {
  it('mutationFn calls markAllAsRead', async () => {
    (NotificationsApi.markAllAsRead as jest.Mock).mockResolvedValue({ data: undefined });

    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: () => Promise<unknown>;
    useMutation.mockImplementationOnce((opts: { mutationFn: typeof capturedMutationFn }) => {
      capturedMutationFn = opts.mutationFn;
      return { mutate: jest.fn(), isPending: false };
    });

    useMarkAllAsRead();
    await capturedMutationFn();

    expect(NotificationsApi.markAllAsRead).toHaveBeenCalled();
  });

  it('onSuccess invalidates notifications query', () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedOnSuccess!: () => void;
    useMutation.mockImplementationOnce((opts: { onSuccess: typeof capturedOnSuccess }) => {
      capturedOnSuccess = opts.onSuccess;
      return { mutate: jest.fn(), isPending: false };
    });

    useMarkAllAsRead();
    capturedOnSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });
});
