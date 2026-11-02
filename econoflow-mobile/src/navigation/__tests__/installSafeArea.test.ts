import { Dimensions } from 'react-native';
import * as SafeAreaContext from 'react-native-safe-area-context';
import { safeAreaInitialMetrics, sanitiseFrame } from '../installSafeArea';

/**
 * The frame the correction exists for: a top inset that cannot be this window's top edge.
 * `initialWindowMetrics` is a read-only native reading and is `null` under Jest, so the
 * correction is pinned on `sanitiseFrame` — the same function `installSafeAreaCorrection`
 * applies to that export.
 */
const window = Dimensions.get('window');
describe('safeAreaInitialMetrics', () => {
  it('has no opinion without a device frame', () => {
    // Jest's `initialWindowMetrics` is `null`: the library decides, as on a normal device.
    expect(SafeAreaContext.initialWindowMetrics).toBeNull();
    expect(safeAreaInitialMetrics()).toBeUndefined();
  });

  it('rejects a top inset the window cannot have, keeping the bottom one', () => {
    const metrics = sanitiseFrame({
      frame: { x: 0, y: 0, width: window.width, height: window.height },
      insets: { top: window.height * 0.4, bottom: 48, left: 0, right: 0 },
    });

    expect(metrics.insets.top).toBe(0);
    expect(metrics.insets.bottom).toBe(48);
  });

  it('keeps a top inset a status bar could have', () => {
    const metrics = sanitiseFrame({
      frame: { x: 0, y: 0, width: window.width, height: window.height },
      insets: { top: 96, bottom: 48, left: 0, right: 0 },
    });

    expect(metrics.insets.top).toBe(96);
  });
});
