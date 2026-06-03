import { create } from 'zustand';

type EntryType = 'income' | 'expense';

interface QuickAddState {
  /** Category ID to pre-select when the global FAB is pressed. Set by ExpenseListScreen on focus. */
  categoryId: string | null;
  /** Entry type to pre-select when the global FAB is pressed. Set by IncomeListScreen on focus. */
  defaultType: EntryType | null;
  /** Month currently viewed in a list screen (YYYY-MM). Null when no list screen is focused. */
  viewedMonth: string | null;
  setCategoryId:   (id: string | null) => void;
  setDefaultType:  (type: EntryType | null) => void;
  setViewedMonth:  (month: string | null) => void;
}

export const useQuickAddStore = create<QuickAddState>()((set) => ({
  categoryId:  null,
  defaultType: null,
  viewedMonth: null,
  setCategoryId:   (id)    => set({ categoryId: id }),
  setDefaultType:  (type)  => set({ defaultType: type }),
  setViewedMonth:  (month) => set({ viewedMonth: month }),
}));
