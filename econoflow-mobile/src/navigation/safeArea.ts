import { Dimensions } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

/**
 * How much of the window's height a top inset may claim before it is rejected.
 *
 * A top inset is a status bar, at worst a punch-hole row — never a fraction of the screen.
 * The app is edge-to-edge on Android (`edgeToEdgeEnabled`), so this is the bound a screen's
 * own top padding is held to (`useTabTopInset`).
 *
 * History worth keeping: the number was once used to rewrite
 * `react-native-safe-area-context`'s module-level `initialWindowMetrics` app-wide, on the
 * premise that a device reported a frame that was not the app window's. That premise was
 * false — the device reported an ordinary 51.8pt status bar and the rule never fired — while
 * the rewrite itself handed the tab navigator a synthetic frame and left every tab screen with
 * its top half blank. The rule now only ever decides one screen's padding; it never touches the
 * frame, the navigator or the provider.
 */
export const MAX_SANE_TOP_INSET_RATIO = 0.2;

/** The window a frame is judged against; the real one unless a test supplies it. */
type WindowSize = { width: number; height: number };

/** Whether a top inset could plausibly be this window's top edge. */
function isPlausibleTop(top: number | undefined, window: WindowSize): boolean {
  return typeof top === 'number' && top > 0 && top <= window.height * MAX_SANE_TOP_INSET_RATIO;
}

/**
 * The insets a tab screen is willing to act on.
 *
 * `top` is kept when it could be this window's top edge and dropped to `0` otherwise — the
 * screen's own header padding is then simply not applied, and the navigator has already placed
 * the screen clear of the system bars. Every other inset is returned exactly as given:
 * `bottom` decides where the tab bar sits above the gesture handle, and `left`/`right` do not
 * move a screen down.
 */
export function sanitiseInsets(insets: EdgeInsets, window?: WindowSize): EdgeInsets {
  const size = window ?? Dimensions.get('window');
  const top = isPlausibleTop(insets?.top, size) ? insets.top : 0;

  return { ...insets, top };
}
