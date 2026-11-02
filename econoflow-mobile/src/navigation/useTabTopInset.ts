import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sanitiseInsets } from './safeArea';

/**
 * The top inset a screen **inside the tab navigator** is allowed to apply.
 *
 * ## Why a screen cannot just use `insets.top`
 *
 * The bottom-tabs navigator already places its screens clear of the status bar (it renders
 * them in the window, below nothing but the system bars) and its headers are given
 * `headerStatusBarHeight` from that same inset. A screen that books the top inset **again**
 * — as Overview, Plans, Profile and Projects do, because they draw their own header instead
 * of a navigator header — is correct only while that inset is a status bar. On a device whose
 * safe-area frame is not the app window's it was not: the inset became most of the screen,
 * the doubled padding pushed the first row halfway down, and all four tabs opened with their
 * upper half blank. The Login and PIN screens sit outside the tab navigator and QuickAdd is a
 * native modal window of its own, which is why those were fine — the one clue that points at
 * the tab navigator rather than at the provider.
 *
 * ## What this returns
 *
 * The inset is honoured when it could be this window's top edge, and dropped to `0` when it
 * cannot. The largest inset a top edge could plausibly have is `MAX_SANE_TOP_INSET_RATIO` of
 * the window (see `safeArea.ts` for why that number, and why `bottom` is never touched).
 *
 * ## What this must never become again
 *
 * An earlier fix answered "the inset is too tall" app-wide, by rewriting
 * `react-native-safe-area-context`'s module-level `initialWindowMetrics`. That constant is
 * captured by `@react-navigation/elements` and read by `BottomTabView` for the navigator's own
 * geometry, so the "fix" moved the tab navigator itself: every tab screen opened with its top
 * half blank, measured at exactly 50.0% of the window, on a device whose real inset was an
 * ordinary 51.8pt status bar. A screen's padding is decided here, per screen, and the device's
 * frame is used exactly as reported.
 *
 * Only for screens that draw their own header inside the tab navigator. A screen presented
 * over the whole app — the lock overlay, a modal — wants the raw `useSafeAreaInsets()`.
 */
export function useTabTopInset(): number {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();

  return sanitiseInsets(insets, window).top;
}
