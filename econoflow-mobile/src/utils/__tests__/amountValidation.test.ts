import { shouldShowAmountError } from '../amountValidation';

describe('shouldShowAmountError', () => {
  describe('creating a new entry (no editMode)', () => {
    it('returns true when amount is 0', () => {
      expect(shouldShowAmountError(undefined, 0)).toBe(true);
    });

    it('returns true when amount is negative', () => {
      expect(shouldShowAmountError(undefined, -5)).toBe(true);
    });

    it('returns false when amount is positive', () => {
      expect(shouldShowAmountError(undefined, 10)).toBe(false);
    });
  });

  describe('editing an expense that has child items (hasItems)', () => {
    it('returns false regardless of amount — amount is derived from items', () => {
      expect(shouldShowAmountError({ type: 'expense', hasItems: true }, 0)).toBe(false);
      expect(shouldShowAmountError({ type: 'expense', hasItems: true }, -1)).toBe(false);
    });
  });

  describe('editing an existing expense with amount 0 (no items)', () => {
    it('returns false so the user is not blocked from saving', () => {
      expect(shouldShowAmountError({ type: 'expense' }, 0)).toBe(false);
    });

    it('returns false for a positive amount too', () => {
      expect(shouldShowAmountError({ type: 'expense' }, 22)).toBe(false);
    });
  });

  describe('editing an existing income with amount 0', () => {
    it('returns false so the user is not blocked from saving', () => {
      expect(shouldShowAmountError({ type: 'income' }, 0)).toBe(false);
    });
  });

  describe('editing an expense item', () => {
    it('returns true when amount is 0 — items must carry a value', () => {
      expect(shouldShowAmountError({ type: 'expenseItem' }, 0)).toBe(true);
    });

    it('returns false when amount is positive', () => {
      expect(shouldShowAmountError({ type: 'expenseItem' }, 5)).toBe(false);
    });

    it('expenseItem rule takes priority over hasItems — amount > 0 still required', () => {
      expect(shouldShowAmountError({ type: 'expenseItem', hasItems: true }, 0)).toBe(true);
    });
  });
});
