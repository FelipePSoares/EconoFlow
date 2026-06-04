import { shouldShowAmountError } from '../amountValidation';

describe('shouldShowAmountError', () => {
  describe('creating a new entry (no editMode)', () => {
    it('returns true when amount is 0', () => {
      expect(shouldShowAmountError(undefined, undefined, 0)).toBe(true);
    });

    it('returns true when amount is negative', () => {
      expect(shouldShowAmountError(undefined, undefined, -5)).toBe(true);
    });

    it('returns false when amount is positive', () => {
      expect(shouldShowAmountError(undefined, undefined, 10)).toBe(false);
    });
  });

  describe('editing an expense that has child items (hasItems)', () => {
    it('returns false regardless of amount — amount is derived from items', () => {
      expect(shouldShowAmountError(true, { type: 'expense' }, 0)).toBe(false);
      expect(shouldShowAmountError(true, { type: 'expense' }, -1)).toBe(false);
    });
  });

  describe('editing an existing expense with amount 0 (no items)', () => {
    it('returns false so the user is not blocked from saving', () => {
      expect(shouldShowAmountError(false, { type: 'expense' }, 0)).toBe(false);
    });

    it('returns false for a positive amount too', () => {
      expect(shouldShowAmountError(false, { type: 'expense' }, 22)).toBe(false);
    });
  });

  describe('editing an existing income with amount 0', () => {
    it('returns false so the user is not blocked from saving', () => {
      expect(shouldShowAmountError(false, { type: 'income' }, 0)).toBe(false);
    });
  });

  describe('editing an expense item', () => {
    it('returns true when amount is 0 — items must carry a value', () => {
      expect(shouldShowAmountError(false, { type: 'expenseItem' }, 0)).toBe(true);
    });

    it('returns false when amount is positive', () => {
      expect(shouldShowAmountError(false, { type: 'expenseItem' }, 5)).toBe(false);
    });
  });
});
