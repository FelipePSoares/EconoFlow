import { Dimensions } from 'react-native';
import { sanitiseFrame, sanitiseInsets, MAX_SANE_TOP_INSET_RATIO } from '../safeArea';

/**
 * The safe-area frame the app trusts.
 *
 * A bad answer here is not cosmetic: `@react-navigation/elements` uses `insets.top` as a
 * screen's `headerStatusBarHeight`, so every screen inside the tab navigator starts that far
 * down. On a Redmi Note 15 Pro 5G (edge-to-edge, punch-hole) the provider reported a frame
 * that was not the app window, and Overview/Plans/Profile/Projects opened with roughly their
 * upper half blank — while the Login screen, outside the tab navigator, was fine.
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

  it('drops a top inset larger than any window edge can be', () => {
    // The frame the device actually reported: not this window's top edge at all.
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

describe('sanitiseFrame', () => {
  // This is the value `@react-navigation/elements` reads for the tab navigator's headers.
  const frame = { x: 0, y: 0, width: 1080, height: 2400 };

  it('keeps a real status bar and passes the frame through', () => {
    const metrics = sanitiseFrame({ frame, insets: { top: 96, bottom: 48, left: 0, right: 0 } });

    expect(metrics.insets).toEqual({ top: 96, bottom: 48, left: 0, right: 0 });
    expect(metrics.frame).toEqual(frame);
  });

  it('rejects the frame the device reported and keeps the bottom inset', () => {
    const metrics = sanitiseFrame({ frame, insets: { top: 960, bottom: 48, left: 0, right: 0 } });

    expect(metrics.insets).toEqual({ top: 0, bottom: 48, left: 0, right: 0 });
  });
});
