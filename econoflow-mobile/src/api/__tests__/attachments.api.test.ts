import {
  uploadExpenseAttachment,
  uploadIncomeAttachment,
  deleteExpenseAttachment,
  deleteIncomeAttachment,
  getExpenseAttachmentUrl,
  getIncomeAttachmentUrl,
} from '../attachments.api';
import { apiClient } from '../client';

jest.mock('../client', () => ({
  apiClient: {
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockPost = apiClient.post as jest.Mock;
const mockDelete = apiClient.delete as jest.Mock;

const file = { uri: 'file:///tmp/payslip.pdf', name: 'payslip.pdf', type: 'application/pdf' };

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockResolvedValue({ data: { id: 'att-1' }, status: 201 });
  mockDelete.mockResolvedValue({ data: undefined, status: 200 });
});

describe('uploadIncomeAttachment', () => {
  it('posts multipart form data to the income attachment endpoint', () => {
    uploadIncomeAttachment('proj-1', 'income-1', file);

    const [url, body, config] = mockPost.mock.calls[0];
    expect(url).toBe('/api/Projects/proj-1/Incomes/income-1/attachments');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBeTruthy();
    expect((body as FormData).get('attachmentType')).toBeNull();
    expect(config?.headers?.['Content-Type']).toBe('multipart/form-data');
  });
});

describe('uploadExpenseAttachment', () => {
  it('marks the upload as a deductible proof', () => {
    uploadExpenseAttachment('proj-1', 'cat-1', 'exp-1', file);

    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe('/api/Projects/proj-1/Categories/cat-1/Expenses/exp-1/attachments');
    expect((body as FormData).get('attachmentType')).toBe('DeductibleProof');
  });
});

describe('attachment deletion', () => {
  it('deletes an income attachment', () => {
    deleteIncomeAttachment('proj-1', 'income-1', 'att-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/Projects/proj-1/Incomes/income-1/attachments/att-1');
  });

  it('deletes an expense attachment', () => {
    deleteExpenseAttachment('proj-1', 'cat-1', 'exp-1', 'att-1');
    expect(mockDelete).toHaveBeenCalledWith(
      '/api/Projects/proj-1/Categories/cat-1/Expenses/exp-1/attachments/att-1'
    );
  });
});

describe('attachment download urls', () => {
  it('builds the income attachment url', () => {
    expect(getIncomeAttachmentUrl('proj-1', 'income-1', 'att-1'))
      .toBe('/api/Projects/proj-1/Incomes/income-1/attachments/att-1');
  });

  it('builds the expense attachment url', () => {
    expect(getExpenseAttachmentUrl('proj-1', 'cat-1', 'exp-1', 'att-1'))
      .toBe('/api/Projects/proj-1/Categories/cat-1/Expenses/exp-1/attachments/att-1');
  });
});
