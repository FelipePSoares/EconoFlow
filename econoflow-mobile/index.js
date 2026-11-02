import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';
import { trace } from './src/diagnostics/trace';
import App from './App';

/**
 * The first line of the trail, written before anything renders.
 *
 * A session that dies early — a native module missing, a crash during mount — leaves its
 * only evidence here: everything after it is what the app managed to do.
 */
trace('app.entry', { pid: typeof global === 'object' ? 'js' : 'unknown' });

/*
 * The safe-area frame is deliberately **not** corrected here.
 *
 * A branch once called `installSafeAreaCorrection()` at this point, rewriting
 * `react-native-safe-area-context`'s module-level `initialWindowMetrics` on the premise that a
 * device had reported a frame that was not the app window. The premise was wrong for the
 * device it was written for: its top inset was an ordinary 51.8pt status bar, never rejected.
 * What the rewrite did do is feed a synthetic frame to `@react-navigation/elements` and
 * `BottomTabView`, which capture that constant for their own geometry — and the tab screens
 * opened with their top half blank, measured at exactly 50.0% of the window.
 *
 * A device's frame is therefore left exactly as the device reports it. A screen inside the tab
 * navigator takes its top inset through `useTabTopInset()`, which is a decision about that
 * screen's own padding and cannot move a navigator.
 */
// The trail writes through `console.error` on purpose (it is the one level React Native does
// not drop), and a screen full of LogBox notices would cover the screen being diagnosed.
LogBox.ignoreLogs([/EconoFlowTrace/]);

registerRootComponent(App);
