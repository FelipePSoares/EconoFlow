import { isAttachmentContentRejection } from './api-errors';
import { ApiErrorResponse } from '../models/error';

describe('isAttachmentContentRejection', () => {
  const mismatch: ApiErrorResponse = {
    errors: {
      contentType: [
        'The attachment content is image/png, which does not match the declared type application/pdf.'
      ]
    }
  };

  it('should return true when the server rejected the content type', () => {
    expect(isAttachmentContentRejection(mismatch)).toBeTrue();
  });

  it('should return true for any contentType message, including unrecognized content', () => {
    const unrecognized: ApiErrorResponse = {
      errors: { contentType: ['The attachment content does not match any supported file type.'] }
    };

    expect(isAttachmentContentRejection(unrecognized)).toBeTrue();
  });

  it('should return false when the rejection is about another field', () => {
    const other: ApiErrorResponse = {
      errors: { size: ['Attachment exceeds the maximum allowed size (10 MB).'] }
    };

    expect(isAttachmentContentRejection(other)).toBeFalse();
  });

  it('should return false when contentType carries no messages', () => {
    expect(isAttachmentContentRejection({ errors: { contentType: [] } })).toBeFalse();
  });

  it('should return false when there is no error payload', () => {
    expect(isAttachmentContentRejection(null)).toBeFalse();
    expect(isAttachmentContentRejection(undefined)).toBeFalse();
    expect(isAttachmentContentRejection(new Error('Network Error') as unknown as ApiErrorResponse)).toBeFalse();
  });
});
