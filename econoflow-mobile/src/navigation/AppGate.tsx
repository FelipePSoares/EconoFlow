import React, { useEffect, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import i18next from 'i18next';
import { useAppTheme } from '../theme/useAppTheme';
import { useAuthStore } from '../store/authStore';
import {
  hydrateBiometricStore,
  isBiometricAnswerKnown,
  subscribeBiometricAnswering,
} from '../store/biometricStore';
import { hydratePinStore, isPinAnswerKnown, subscribePinAnswering } from '../store/pinStore';
import { AuthNavigator } from './AuthNavigator';
import { SessionNavigator } from './SessionNavigator';
import { trace } from '../diagnostics/trace';

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

  // The session's first screen (the unlock gate) decides from the stored PIN and biometric
  // flag, and a login re-reads both (#1116). Mounting it over that read let it decide on
  // the defaults — "create a PIN" for a device that had one — so the session tree waits for
  // the answers, subscribing so it appears when they land.
  const pinKnown = useSyncExternalStore(subscribePinAnswering, isPinAnswerKnown);
  const biometricKnown = useSyncExternalStore(subscribeBiometricAnswering, isBiometricAnswerKnown);
  const lockStoresReady = pinKnown && biometricKnown;

  useEffect(() => {
    // A session the client restored by itself (or a second one in the same app run) has
    // nobody else starting these reads; both calls join a read already in flight.
    if (!isAuthenticated) return;
    void hydratePinStore();
    void hydrateBiometricStore();
  }, [isAuthenticated]);


  if (!isAuthenticated) {
    return <AuthNavigator key="auth" />;
  }

  // ── Waiting is a screen, never nothing (#1116) ─────────────────────────────
  //
  // These two branches used to `return null`, and that is precisely the reported defect: the
  // activity stays in front, the process stays alive, the screen is blank, and restarting the
  // app is the only way out. A visible wait cannot be mistaken for a broken app — and if a
  // read ever fails to settle, the screen says *which* one instead of showing nothing.
  if (!restoredSessionReady || !lockStoresReady) {
    return <SessionStartingScreen waitingFor={!restoredSessionReady ? 'session' : 'lock'} />;
  }

  trace('appgate.mount-session', { pinKnown, biometricKnown });

  return <SessionNavigator key="session" />;
};

/**
 * What the customer sees between a successful login and the session's first screen.
 *
 * It exists because "nothing" is ambiguous: a blank window cannot be told apart from a hung
 * app, and the report behind #1116 was exactly that. Colours come from the app theme, so a
 * slow start looks like the product rather than like a failure.
 */
const SessionStartingScreen: React.FC<{ waitingFor: 'session' | 'lock' }> = ({ waitingFor }) => {
  const { colors } = useAppTheme();
  return (
    <View
      style={[styles.startingScreen, { backgroundColor: colors.background }]}
      testID="session-starting"
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.startingHint, { color: colors.onSurfaceVariant }]}>
        {i18next.t(waitingFor === 'session' ? 'SessionStarting' : 'SessionUnlocking')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  startingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  startingHint: {
    fontSize: 14,
  },
});





