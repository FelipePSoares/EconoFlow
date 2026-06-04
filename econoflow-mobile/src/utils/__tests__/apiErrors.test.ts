import { extractApiErrors } from '../apiErrors';

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
