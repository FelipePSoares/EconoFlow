import * as CategoriesApi from '../../api/categories.api';
import { useCreateCategory } from '../useCategories';

jest.mock('../../api/categories.api');

const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
  useMutation: jest.fn((opts) => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
    _opts: opts,
  })),
}));

beforeEach(() => {
  mockInvalidateQueries.mockReset();
});

describe('useCreateCategory', () => {
  it('mutationFn calls CategoriesApi.createCategory with projectId and data', async () => {
    (CategoriesApi.createCategory as jest.Mock).mockResolvedValue({ data: { id: 'new-cat' } });

    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedMutationFn!: (vars: { name: string }) => Promise<unknown>;
    useMutation.mockImplementationOnce(
      (opts: { mutationFn: typeof capturedMutationFn }) => {
        capturedMutationFn = opts.mutationFn;
        return { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
      },
    );

    useCreateCategory('proj-1', '2026-01');

    const vars = { name: 'New Category' };
    await capturedMutationFn(vars);

    expect(CategoriesApi.createCategory).toHaveBeenCalledWith('proj-1', vars);
  });

  it('onSuccess invalidates categories query for the project and month', async () => {
    const { useMutation } = jest.requireMock('@tanstack/react-query') as { useMutation: jest.Mock };
    let capturedOnSuccess!: () => void;
    useMutation.mockImplementationOnce(
      (opts: { onSuccess: typeof capturedOnSuccess }) => {
        capturedOnSuccess = opts.onSuccess;
        return { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
      },
    );

    useCreateCategory('proj-1', '2026-01');

    capturedOnSuccess();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['categories', 'proj-1', '2026-01'],
    });
  });
});
