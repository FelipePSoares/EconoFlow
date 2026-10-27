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
 */
export const AppGate: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return isAuthenticated
    ? <SessionNavigator key="session" />
    : <AuthNavigator key="auth" />;
};
