/**
 * The top inset a screen inside the tab navigator is allowed to apply.
 *
 * The defect this pins: every tab screen padded its own header with `insets.top`, so a frame
 * that was not this window's top edge would become a padding most of the screen tall — while
 * the Login and PIN screens (outside the tab navigator) and the QuickAdd modal (a native modal
 * window) would be unaffected. The hook keeps that decision at the screen, which is also what
 * keeps it away from the navigator: the half-screen regression came from rewriting the
 * safe-area frame app-wide, not from this padding (see `useTabTopInset.ts`).
 */
import { Dimensions } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { useTabTopInset } from '../useTabTopInset';
import { MAX_SANE_TOP_INSET_RATIO } from '../safeArea';

// Scriptable, so a case can give the hook the insets a real device reports.
let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

const window = Dimensions.get('window');

/** The inset the hook returns for a device that reports `top`. */
const insetFor = async (top: number): Promise<number> => {
  mockInsets = { top, bottom: 48, left: 0, right: 0 };
  const { result } = await renderHook(() => useTabTopInset());
  return result.current;
};

describe('useTabTopInset', () => {
  afterEach(() => {
    mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  });

  it('keeps a real status-bar inset, so a screen still clears the status bar', async () => {
    await expect(insetFor(96)).resolves.toBe(96);
  });

  it('treats no inset as no inset', async () => {
    await expect(insetFor(0)).resolves.toBe(0);
  });

  it('never turns an inset larger than the window into blank screen', async () => {
    // What the tab screens did with the device's frame: padded by it outright. Overview, Plans,
    // Profile and Projects then opened with their upper half empty.
    await expect(insetFor(window.height * 0.5)).resolves.toBe(0);
  });

  it('clamps at the largest inset a window edge could plausibly have', async () => {
    const limit = window.height * MAX_SANE_TOP_INSET_RATIO;

    await expect(insetFor(limit)).resolves.toBe(limit);
    // Just over the limit is a frame that is not this window's, and is not used at all.
    await expect(insetFor(limit + 1)).resolves.toBe(0);
  });
});
