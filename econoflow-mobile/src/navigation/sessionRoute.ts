/**
 * Which screen a session is currently showing, for the pieces outside the session stack.
 *
 * The unlock gate is a screen of `SessionNavigator`, but `LockOverlay` is rendered by `App`
 * over the whole tree and has to know whether it is looking at a session that is still
 * opening or at one that is already running. Importing the navigator (or a screen) from the
 * overlay would be a cycle: the gate imports the overlay's siblings, and the overlay is part
 * of App's tree.
 *
 * So the navigator publishes its state here, and everything else reads it. It is a one-way
 * dependency: this module knows nothing about React or navigation.
 */
let currentRouteName: string | null = null;

/** The routes a session opens on: the lock screens, before the app itself. */
const UNLOCK_ROUTES: ReadonlySet<string> = new Set(['BiometricGate', 'PinEntry', 'PinSetup']);

/**
 * Records the route a session stack is on.
 *
 * Called from `SessionNavigator` on every state change, and cleared when the session goes
 * away, so a stale value can never outlive the stack that wrote it.
 */
export const setSessionRoute = (routeName: string | null): void => {
  currentRouteName = routeName;
};

/** The route the session stack is showing, or `null` when no session is mounted. */
export const getSessionRoute = (): string | null => currentRouteName;

/**
 * Whether the session is still on one of its unlock screens.
 *
 * `false` at launch, before the session mounts: nothing is locked in front of the customer
 * yet, and the overlay that asks this is only rendered for an authenticated session.
 */
export const isSessionOnUnlockScreen = (): boolean =>
  currentRouteName !== null && UNLOCK_ROUTES.has(currentRouteName);
