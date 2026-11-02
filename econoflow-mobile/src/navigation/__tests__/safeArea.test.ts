import { Dimensions } from 'react-native';
import { sanitiseInsets, MAX_SANE_TOP_INSET_RATIO } from '../safeArea';

/**
 * The top inset a tab screen is allowed to act on.
 *
 * A bad answer here is not cosmetic: the tab screens pad their own header with `insets.top`, so
 * a frame that is not this window's becomes a padding most of a screen tall. The regression
 * this rule was written against, though, came from the opposite mistake — an app-wide rewrite
 * of `react-native-safe-area-context`'s `initialWindowMetrics`, which moved the tab navigator
 * itself and left all four tabs' top half blank (exactly 50.0% of the window). See
 * `useTabTopInset.ts` for why the decision lives with the screen and nowhere else.
 */
describe('sanitiseInsets', () => {
  const window = { width: 1080, height: 2400 };

  it('keeps a real status-bar inset untouched', () => {
    expect(sanitiseInsets({ top: 96, bottom: 48, left: 0, right: 0 }, window)).toEqual({
      top: 96,
      bottom: 48,
      left: 0,
      right: 0,
    });
  });

  it('keeps the inset an ordinary Android phone reports', () => {
    // The value the device in the report sent: an ordinary status bar, honoured as given.
    expect(sanitiseInsets({ top: 51.8, bottom: 24, left: 0, right: 0 }, window).top).toBe(51.8);
  });

  it('drops a top inset larger than any window edge can be', () => {
    const result = sanitiseInsets({ top: 960, bottom: 48, left: 0, right: 0 }, window);

    expect(result.top).toBe(0);
  });

  it('keeps the inset at the allowed share of the window', () => {
    const limit = window.height * MAX_SANE_TOP_INSET_RATIO;

    expect(sanitiseInsets({ top: limit, bottom: 0, left: 0, right: 0 }, window).top).toBe(limit);
    expect(sanitiseInsets({ top: limit + 1, bottom: 0, left: 0, right: 0 }, window).top).toBe(0);
  });

  it('does not let a bad top inset hide the bottom one', () => {
    // The tab bar and the gesture bar depend on `bottom`; dropping the whole frame would
    // trade a blank half for a tab bar under the gesture handle.
    const result = sanitiseInsets({ top: 960, bottom: 64, left: 0, right: 0 }, window);

    expect(result).toEqual({ top: 0, bottom: 64, left: 0, right: 0 });
  });

  it('ignores left and right insets, which cannot move a screen down', () => {
    const result = sanitiseInsets({ top: 0, bottom: 0, left: 40, right: 40 }, window);

    expect(result).toEqual({ top: 0, bottom: 0, left: 40, right: 40 });
  });

  it('treats a missing or negative top as no inset', () => {
    expect(sanitiseInsets({ top: -5, bottom: 0, left: 0, right: 0 }, window).top).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitiseInsets({ top: undefined as any, bottom: 0, left: 0, right: 0 }, window).top).toBe(0);
  });

  it('falls back to the real window when no frame is given', () => {
    const live = Dimensions.get('window');

    expect(sanitiseInsets({ top: live.height, bottom: 0, left: 0, right: 0 }).top).toBe(0);
  });
});
