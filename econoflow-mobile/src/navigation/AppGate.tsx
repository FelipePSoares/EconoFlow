import React from 'react';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { SessionNavigator } from './SessionNavigator';

/**
 * Chooses the tree by auth state and re-renders when it changes.
 *
 * This must be a component of its own, above the navigator. When the choice lived inside
 * `AppGate` — as either a conditional screen list or a computed `initialRouteName` —
 * login could not land anywhere: `initialRouteName` is only read when the navigator
 * mounts, so writing the tokens re-rendered the same root navigator, which recomputed a
 * prop it had already captured. The symptom was exactly a successful login that stays on
 * the Login screen.
 *
 * Keying by `isAuthenticated` also discards the signed-out history, so a sign-out cannot
 * navigate back into the previous session.
 *
 * A restored session waits for the auth store to finish reading its own storage (#1052),
 * because the unlock gate decides from stores that only the rehydration binds — a relaunch
 * used to render straight back into `Main`'s content through the gate, before any of it
 * was known.
 */
export const AppGate: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // The store module always hydrates on import, before React renders anything: by the
  // time this component runs, the session is either restored or was never there.
  const restoredSessionReady = useAuthStore.persist.hasHydrated();

  if (!isAuthenticated) {
    return <AuthNavigator key="auth" />;
  }

  // Signed out → signed in during this run (login): the lock decision belongs to the
  // rehydration and has already happened.
  if (!restoredSessionReady) {
    return null;
  }

  return <SessionNavigator key="session" />;
};
