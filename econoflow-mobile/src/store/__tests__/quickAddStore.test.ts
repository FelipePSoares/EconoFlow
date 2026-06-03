import { useQuickAddStore } from '../quickAddStore';

describe('quickAddStore – viewedMonth', () => {
  beforeEach(() => {
    // Reset slice of state that these tests care about
    useQuickAddStore.setState({ viewedMonth: null });
  });

  it('starts with viewedMonth as null', () => {
    expect(useQuickAddStore.getState().viewedMonth).toBeNull();
  });

  it('setViewedMonth updates viewedMonth to a month string', () => {
    useQuickAddStore.getState().setViewedMonth('2024-01');
    expect(useQuickAddStore.getState().viewedMonth).toBe('2024-01');
  });

  it('setViewedMonth can reset viewedMonth back to null', () => {
    useQuickAddStore.getState().setViewedMonth('2024-06');
    useQuickAddStore.getState().setViewedMonth(null);
    expect(useQuickAddStore.getState().viewedMonth).toBeNull();
  });
});
