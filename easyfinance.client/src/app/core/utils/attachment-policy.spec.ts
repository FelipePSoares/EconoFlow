import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  ATTACHMENT_ACCEPT_ATTRIBUTE,
  MAX_ATTACHMENT_SIZE_BYTES,
  isAllowedAttachmentContentType,
  validateAttachmentFile
} from './attachment-policy';

describe('attachment-policy', () => {
  it('keeps the backend size limit of 10 MB', () => {
    expect(MAX_ATTACHMENT_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });

  it('mirrors the backend allowed content types', () => {
    expect([...ALLOWED_ATTACHMENT_MIME_TYPES].sort()).toEqual([
      'application/pdf',
      'image/heic',
      'image/heif',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ]);
  });

  it('builds the file input accept attribute from the allow-list', () => {
    expect(ATTACHMENT_ACCEPT_ATTRIBUTE)
      .toBe('.pdf,image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif');
  });

  describe('isAllowedAttachmentContentType', () => {
    it('accepts every allowed mime type', () => {
      ALLOWED_ATTACHMENT_MIME_TYPES.forEach(contentType => {
        expect(isAllowedAttachmentContentType(contentType)).toBeTrue();
      });
    });

    // The backend compares with StringComparer.OrdinalIgnoreCase, so the client must match.
    it('ignores case, mirroring the backend', () => {
      expect(isAllowedAttachmentContentType('IMAGE/PNG')).toBeTrue();
      expect(isAllowedAttachmentContentType('Application/Pdf')).toBeTrue();
    });

    it('rejects an unsupported mime type', () => {
      expect(isAllowedAttachmentContentType('text/plain')).toBeFalse();
      expect(isAllowedAttachmentContentType('application/x-msdownload')).toBeFalse();
    });

    it('rejects an empty or missing mime type', () => {
      expect(isAllowedAttachmentContentType('')).toBeFalse();
      expect(isAllowedAttachmentContentType('   ')).toBeFalse();
      expect(isAllowedAttachmentContentType(null)).toBeFalse();
      expect(isAllowedAttachmentContentType(undefined)).toBeFalse();
    });
  });

  describe('validateAttachmentFile', () => {
    it('accepts a supported file within the size limit', () => {
      expect(validateAttachmentFile({ type: 'application/pdf', size: 1024 })).toBeNull();
    });

    it('accepts a file exactly at the limit', () => {
      expect(validateAttachmentFile({ type: 'application/pdf', size: MAX_ATTACHMENT_SIZE_BYTES })).toBeNull();
    });

    it('rejects an unsupported content type', () => {
      expect(validateAttachmentFile({ type: 'text/plain', size: 10 })).toBe('invalidType');
    });

    it('rejects a file above the limit', () => {
      expect(validateAttachmentFile({ type: 'application/pdf', size: MAX_ATTACHMENT_SIZE_BYTES + 1 })).toBe('tooLarge');
    });

    it('prefers the content-type rejection when both are invalid', () => {
      expect(validateAttachmentFile({ type: 'text/plain', size: MAX_ATTACHMENT_SIZE_BYTES + 1 })).toBe('invalidType');
    });

    it('accepts an unknown size and lets the server enforce the limit', () => {
      expect(validateAttachmentFile({ type: 'application/pdf' })).toBeNull();
      expect(validateAttachmentFile({ type: 'application/pdf', size: null })).toBeNull();
    });
  });
});
