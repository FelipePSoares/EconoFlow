import { extractApiErrors, isAttachmentContentRejection } from '../apiErrors';

describe('extractApiErrors', () => {
  it('returns empty record for a generic JS Error', () => {
    expect(extractApiErrors(new Error('generic'))).toEqual({});
  });

  it('returns empty record when response has no data', () => {
    expect(extractApiErrors({ response: {} })).toEqual({});
  });

  it('returns empty record when response data has no errors property', () => {
    expect(extractApiErrors({ response: { data: {} } })).toEqual({});
  });

  it('returns the errors record from a well-formed API 400 response', () => {
    const error = {
      response: {
        data: {
          errors: { Date: ["A future expense can't have an amount"] },
        },
      },
    };
    expect(extractApiErrors(error)).toEqual({
      Date: ["A future expense can't have an amount"],
    });
  });

  it('handles multiple field errors in one response', () => {
    const error = {
      response: {
        data: {
          errors: {
            Date: ["A future expense can't have an amount"],
            Amount: ["Amount can't be less than zero"],
          },
        },
      },
    };
    const result = extractApiErrors(error);
    expect(result.Date).toEqual(["A future expense can't have an amount"]);
    expect(result.Amount).toEqual(["Amount can't be less than zero"]);
  });

  it('returns empty record for null', () => {
    expect(extractApiErrors(null)).toEqual({});
  });

  it('returns empty record for undefined', () => {
    expect(extractApiErrors(undefined)).toEqual({});
  });

  it('returns empty record for a string', () => {
    expect(extractApiErrors('network error')).toEqual({});
  });

  it('returns all messages for a field when the backend sends multiple', () => {
    const error = {
      response: {
        data: {
          errors: { Name: ['Name is required', 'Name too long'] },
        },
      },
    };
    expect(extractApiErrors(error).Name).toHaveLength(2);
  });
});

describe('isAttachmentContentRejection', () => {
  const contentTypeRejection = {
    response: {
      status: 400,
      data: {
        errors: {
          contentType: [
            'The attachment content is image/png, which does not match the declared type application/pdf.',
          ],
        },
      },
    },
  };

  it('returns true for a 400 keyed to contentType', () => {
    expect(isAttachmentContentRejection(contentTypeRejection)).toBe(true);
  });

  it('returns false when the rejection is about another field', () => {
    const error = {
      response: { status: 400, data: { errors: { size: ['Attachment must not be empty.'] } } },
    };
    expect(isAttachmentContentRejection(error)).toBe(false);
  });

  it('returns false for a server error even if it mentions contentType', () => {
    const error = {
      response: { status: 500, data: { errors: { contentType: ['boom'] } } },
    };
    expect(isAttachmentContentRejection(error)).toBe(false);
  });

  it('returns false for the bare status without messages', () => {
    expect(isAttachmentContentRejection({ response: { status: 400, data: {} } })).toBe(false);
  });

  it('returns false for a network failure', () => {
    expect(isAttachmentContentRejection(new Error('Network Error'))).toBe(false);
    expect(isAttachmentContentRejection(undefined)).toBe(false);
    expect(isAttachmentContentRejection(null)).toBe(false);
  });
});
