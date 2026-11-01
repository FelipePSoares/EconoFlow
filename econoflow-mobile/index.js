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

// The trail writes through `console.error` on purpose (it is the one level React Native does
// not drop), and a screen full of LogBox notices would cover the screen being diagnosed.
LogBox.ignoreLogs([/EconoFlowTrace/]);

registerRootComponent(App);
