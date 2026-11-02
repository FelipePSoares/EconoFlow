import { Dimensions } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import * as SafeAreaContext from 'react-native-safe-area-context';
import { sanitiseFrame, sanitiseInsets } from './safeArea';
import { trace } from '../diagnostics/trace';

/**
 * The safe-area correction the whole app runs through, applied once before it renders.
 *
 * ## The defect this fixes
 *
 * On a Redmi Note 15 Pro 5G (edge-to-edge, punch-hole) every screen **inside the tab
 * navigator** — Overview, Plans, Profile, Projects — opened with roughly its upper half
 * blank, while the PIN and Login screens (outside the tab navigator) were correct and the
 * QuickAdd modal (a native modal, its own window) was too.
 *
 * `@react-navigation/elements` derives a screen's `headerStatusBarHeight` from `insets.top`,
 * so one bad value starts every such screen that far down. And it cannot be fixed from
 * `App` alone: `BottomTabView` reads the **module-level** `initialWindowMetrics` directly.
 *
 * ## What is corrected
 *
 * Only a top inset that cannot be this window's top edge. `bottom` is kept — the tab bar sits
 * on it — and a frame that is already sane is left exactly as the device reported it.
 */

interface SafeAreaModule {
  initialWindowMetrics?: Metrics | null;
}

/** Where React Navigation's copy of the frame lives; reachable, not writable through types. */
const safeAreaModule = SafeAreaContext as unknown as SafeAreaModule;

/** The window this judgement is made against; the real one, resolved at call time. */
const currentWindow = (): { width: number; height: number } => Dimensions.get('window');

/**
 * `initialMetrics` for the app's own provider.
 *
 * `undefined` hands the choice back to the library, which is what an ordinary device should
 * get. A corrected frame is only supplied when the captured one could not be this window's.
 */
export function safeAreaInitialMetrics(): Metrics | null | undefined {
  const frame = safeAreaModule.initialWindowMetrics;
  if (!frame) return undefined;

  const corrected = sanitiseFrame(frame);
  return corrected.insets.top === frame.insets.top ? undefined : corrected;
}

/**
 * Corrects the module-level frame React Navigation reads, and records what was found.
 *
 * Must run **before** anything reads an inset (see `index.js`): `SafeAreaProviderCompat`
 * captures `initialWindowMetrics` in a module-level `const` at import time.
 */
export function installSafeAreaCorrection(): void {
  const frame = safeAreaModule.initialWindowMetrics;
  if (!frame) {
    trace('safearea.install', { frame: 'none' });
    return;
  }

  const corrected = sanitiseFrame(frame);
  const rejected = corrected.insets.top !== frame.insets.top;

  trace('safearea.install', {
    window: `${currentWindow().width}x${currentWindow().height}`,
    top: frame.insets.top,
    bottom: frame.insets.bottom,
    rejected,
  });

  if (!rejected) return;

  try {
    safeAreaModule.initialWindowMetrics = corrected;
  } catch {
    // A frozen export: the provider is still handed the corrected value through
    // `safeAreaInitialMetrics()`, so no screen reads the bad inset either way.
  }
}

/** The correction itself, exposed so the tests can pin the rule the app relies on. */
export { sanitiseFrame, sanitiseInsets };
