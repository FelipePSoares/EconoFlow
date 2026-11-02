import { Dimensions } from 'react-native';
import type { EdgeInsets, Metrics, Rect } from 'react-native-safe-area-context';

/**
 * How much of the window's height a top inset may claim before it is rejected.
 *
 * A top inset is a status bar, at worst a punch-hole row — never a fraction of the screen.
 * The app is edge-to-edge on Android (`edgeToEdgeEnabled`), and on some devices the provider
 * answered with a frame that was not the app window at all: the Redmi Note 15 Pro 5G reported
 * one tall enough to push every screen inside the tab navigator roughly half a screen down.
 *
 * @react-navigation/elements turns `insets.top` into a screen's `headerStatusBarHeight`, so
 * that one bad number left Overview, Plans, Profile and Projects with a blank upper half,
 * while the Login screen — outside the tab navigator — was unaffected, and the QuickAdd modal
 * — a native modal with its own window — was fine too.
 */
export const MAX_SANE_TOP_INSET_RATIO = 0.2;

/** The window a frame is judged against; the real one unless a test supplies it. */
type WindowSize = { width: number; height: number };

/** Whether a top inset could plausibly be this window's top edge. */
function isPlausibleTop(top: number | undefined, window: WindowSize): boolean {
  return typeof top === 'number' && top > 0 && top <= window.height * MAX_SANE_TOP_INSET_RATIO;
}

/**
 * The insets the app is willing to act on.
 *
 * `top` is kept when it could be this window's top edge and dropped to `0` otherwise — the
 * navigator's own layout still keeps content clear of the system bars, so rejecting the value
 * cannot push content under a status bar. Every other inset is returned exactly as given:
 * `bottom` decides where the tab bar sits above the gesture handle, and `left`/`right` do not
 * move a screen down.
 *
 * Rejecting the **whole frame** would have been the wrong fix: it trades a blank half-screen
 * for a tab bar sitting under the gesture handle.
 */
export function sanitiseInsets(insets: EdgeInsets, window?: WindowSize): EdgeInsets {
  const size = window ?? Dimensions.get('window');
  const top = isPlausibleTop(insets?.top, size) ? insets.top : 0;

  return { ...insets, top };
}

/**
 * The provider's frame, with its insets corrected.
 *
 * Used both for the app's own `SafeAreaProvider` **and** to shadow the module-level
 * `initialWindowMetrics` that `@react-navigation/elements` reads for the navigator's headers
 * (`BottomTabView`), so the two cannot disagree about `insets.top`.
 */
export function sanitiseFrame(frame: Metrics): Metrics {
  return { ...frame, insets: sanitiseInsets(frame.insets, frame.frame) };
}

/** A frame with `top` rejected outright, for the synthetic fallback below. */
export function noTopInsetRect(frame: Rect): Metrics {
  return {
    frame,
    insets: { top: 0, left: 0, right: 0, bottom: 0 },
  };
}
