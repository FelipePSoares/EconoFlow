import { renderHook } from '@testing-library/react-native';
import { useAppLock } from '../useAppLock';

const mockSetBg = jest.fn();
const mockCheckLock = jest.fn();

jest.mock('../../store/lockStore', () => {
  const mockStoreFn = jest.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { setBackgroundTimestamp: mockSetBg, checkAndLock: mockCheckLock };
    return selector ? selector(state) : state;
  });
  return { useLockStore: mockStoreFn };
});

describe('useAppLock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() => renderHook(() => useAppLock())).not.toThrow();
  });
});
