import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  attachmentNameFromUri,
  toUploadFile,
  validateAttachment,
} from '../attachments';

describe('validateAttachment', () => {
  it('accepts a PDF within the size limit', () => {
    expect(validateAttachment({ mimeType: 'application/pdf', size: 1024 })).toBeNull();
  });

  it('accepts every allowed mime type', () => {
    ALLOWED_ATTACHMENT_MIME_TYPES.forEach((mimeType) => {
      expect(validateAttachment({ mimeType, size: 10 })).toBeNull();
    });
  });

  it('rejects an unsupported mime type', () => {
    expect(validateAttachment({ mimeType: 'text/plain', size: 10 })).toBe('invalidType');
  });

  it('rejects a missing mime type', () => {
    expect(validateAttachment({ mimeType: null, size: 10 })).toBe('invalidType');
  });

  it('accepts a file exactly at the maximum size', () => {
    expect(validateAttachment({ mimeType: 'application/pdf', size: MAX_ATTACHMENT_SIZE_BYTES })).toBeNull();
  });

  it('rejects a file above the maximum size', () => {
    expect(validateAttachment({ mimeType: 'application/pdf', size: MAX_ATTACHMENT_SIZE_BYTES + 1 })).toBe('tooLarge');
  });

  it('allows an unknown size because the server enforces the limit', () => {
    expect(validateAttachment({ mimeType: 'application/pdf', size: null })).toBeNull();
  });
});

describe('attachmentNameFromUri', () => {
  it('returns the last path segment', () => {
    expect(attachmentNameFromUri('file:///tmp/dir/payslip.pdf')).toBe('payslip.pdf');
  });

  it('strips a query string', () => {
    expect(attachmentNameFromUri('file:///tmp/payslip.pdf?token=abc')).toBe('payslip.pdf');
  });

  it('falls back to a generic name when the uri has no file name', () => {
    expect(attachmentNameFromUri('file:///tmp/')).toBe('attachment');
  });

  it('falls back to a generic name for an empty uri', () => {
    expect(attachmentNameFromUri('')).toBe('attachment');
  });
});

describe('toUploadFile', () => {
  it('prefers the asset name', () => {
    expect(toUploadFile({ uri: 'file:///tmp/a.pdf', name: 'payslip.pdf', mimeType: 'application/pdf' }))
      .toEqual({ uri: 'file:///tmp/a.pdf', name: 'payslip.pdf', type: 'application/pdf' });
  });

  it('derives the name from the uri when the asset has none', () => {
    expect(toUploadFile({ uri: 'file:///tmp/dir/payslip.pdf' }).name).toBe('payslip.pdf');
  });

  it('falls back to a generic content type', () => {
    expect(toUploadFile({ uri: 'file:///tmp/payslip.pdf' }).type).toBe('application/octet-stream');
  });
});
