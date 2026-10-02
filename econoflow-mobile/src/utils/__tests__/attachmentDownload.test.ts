import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { downloadAndOpenAttachment, sanitizeAttachmentFileName } from '../attachmentDownload';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  downloadAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: {
    getState: () => ({ accessToken: 'token-123' }),
  },
}));

const mockDownloadAsync = FileSystem.downloadAsync as jest.Mock;
const mockIsAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
const mockShareAsync = Sharing.shareAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockDownloadAsync.mockResolvedValue({ uri: 'file:///cache/payslip.pdf', status: 200 });
  mockIsAvailableAsync.mockResolvedValue(true);
  mockShareAsync.mockResolvedValue(undefined);
});

describe('sanitizeAttachmentFileName', () => {
  it('keeps a safe file name unchanged', () => {
    expect(sanitizeAttachmentFileName('payslip-january.pdf')).toBe('payslip-january.pdf');
  });

  it('replaces path separators and unsafe characters', () => {
    expect(sanitizeAttachmentFileName('../../etc/pass word.pdf')).toBe('.._.._etc_pass_word.pdf');
  });

  it('falls back to a generic name when nothing usable remains', () => {
    expect(sanitizeAttachmentFileName('')).toBe('attachment');
  });
});

describe('downloadAndOpenAttachment', () => {
  it('downloads with the bearer token and opens the share sheet', async () => {
    await downloadAndOpenAttachment('/api/Projects/p/Incomes/i/attachments/a', 'payslip.pdf', 'application/pdf');

    expect(mockDownloadAsync).toHaveBeenCalledWith(
      expect.stringContaining('/api/Projects/p/Incomes/i/attachments/a'),
      'file:///cache/payslip.pdf',
      { headers: { Authorization: 'Bearer token-123' } }
    );
    expect(mockShareAsync).toHaveBeenCalledWith(
      'file:///cache/payslip.pdf',
      expect.objectContaining({ mimeType: 'application/pdf' })
    );
  });

  it('throws when the download does not succeed', async () => {
    mockDownloadAsync.mockResolvedValue({ uri: 'file:///cache/payslip.pdf', status: 401 });

    await expect(downloadAndOpenAttachment('/api/attachment', 'payslip.pdf'))
      .rejects.toThrow('Attachment download failed with status 401');
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('throws when sharing is not available on the device', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    await expect(downloadAndOpenAttachment('/api/attachment', 'payslip.pdf'))
      .rejects.toThrow('Sharing is not available on this device');
    expect(mockShareAsync).not.toHaveBeenCalled();
  });
});
