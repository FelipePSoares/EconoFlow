import { isNameRequired } from '../nameValidation';

describe('isNameRequired', () => {
  describe('creating a new item added to an existing expense', () => {
    it('returns false — name is optional for new items', () => {
      expect(isNameRequired(undefined, true)).toBe(false);
    });
  });

  describe('creating a new expense (not adding to an existing one)', () => {
    it('returns true — name is required for expense creation', () => {
      expect(isNameRequired(undefined, false)).toBe(true);
    });
  });

  describe('creating a new item where isAddingItemToExpense is true but editMode is set', () => {
    it('returns true — editMode takes precedence, name required when editing', () => {
      expect(isNameRequired({ type: 'income' }, true)).toBe(true);
    });
  });

  describe('editing an existing expense', () => {
    it('returns true — name is still required when editing', () => {
      expect(isNameRequired({ type: 'expense' }, false)).toBe(true);
    });
  });

  describe('editing an existing expense item', () => {
    it('returns true — name is required when editing an item', () => {
      expect(isNameRequired({ type: 'expenseItem' }, false)).toBe(true);
    });

    it('returns true even when isAddingItemToExpense is true (editMode takes precedence)', () => {
      expect(isNameRequired({ type: 'expenseItem' }, true)).toBe(true);
    });
  });

  describe('editing an existing income', () => {
    it('returns true — name is required when editing income', () => {
      expect(isNameRequired({ type: 'income' }, false)).toBe(true);
    });
  });
});
