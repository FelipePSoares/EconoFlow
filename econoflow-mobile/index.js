import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';
import { trace } from './src/diagnostics/trace';
import { installSafeAreaCorrection } from './src/navigation/installSafeArea';
import App from './App';

/**
 * The first line of the trail, written before anything renders.
 *
 * A session that dies early — a native module missing, a crash during mount — leaves its
 * only evidence here: everything after it is what the app managed to do.
 */
trace('app.entry', { pid: typeof global === 'object' ? 'js' : 'unknown' });

/**
 * Correct the window's safe-area frame before the app reads it.
 *
 * This must happen before `App` is imported: `@react-navigation/elements` captures
 * `initialWindowMetrics` in a module-level `const`, and a device can report a frame that is
 * not the app window — which starts every screen inside the tab navigator that far down
 * (`src/navigation/installSafeArea.ts`).
 */
installSafeAreaCorrection();

// The trail writes through `console.error` on purpose (it is the one level React Native does
// not drop), and a screen full of LogBox notices would cover the screen being diagnosed.
LogBox.ignoreLogs([/EconoFlowTrace/]);

registerRootComponent(App);
