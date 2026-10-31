import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import { useBiometricStore } from '../store/biometricStore';

/**
 * How many times the sensor may fail before the app stops asking and leaves the PIN as the
 * only way in (#1052).
 */
export const MAX_BIOMETRIC_FAILURES = 3;

/**
 * Outcomes of `authenticateAsync` that end the prompt without the customer answering it.
 *
 * The sensor was never read, so nothing was proved against the customer: the app keeps the
 * lock (it is what dismissed the prompt) and asks again when it is back in front. A real
 * refusal (`authentication_failed`, `lockout`) still counts, and enough of them hand the
 * lock to the keypad.
 */
const COMPLETED_WITHOUT_ANSWER: ReadonlySet<string> = new Set([
  'system_cancel',
  'app_cancel',
  'user_cancel',
  'user_fallback',
]);

/** The app was away and is in front again: a prompt the system cancelled is owed anew. */
const isBackInFront = (previous: AppStateStatus, next: AppStateStatus): boolean =>
  previous !== 'active' && next === 'active';

/**
 * The one biometric prompt of the app. Every unlock screen uses it, so the sensor behaves
 * the same whether it is reached from the gate or from the PIN fallback:
 *
 * - with biometrics enabled it prompts **on its own**, and nothing else is shown next to
 *   it — the PIN is not a parallel option, it appears only once the sensor gave up;
 * - the prompt is opened at most once at a time: a second one would stack on top of an
 *   already-visible system dialog;
 * - when the screen that shows it is left, an in-flight prompt is cancelled, so the user
 *   is never holding a keypad with a fingerprint dialog still over it.
 */
export interface BiometricUnlock {
  /** Failures so far, out of `MAX_BIOMETRIC_FAILURES`. */
  failures: number;
  /** The sensor is out of attempts; the PIN takes over. */
  exhausted: boolean;
  /** The device cannot do biometrics at all (no hardware, nothing enrolled). */
  unavailable: boolean;
  /** The OS locked the sensor out; retrying in-app will not help. */
  lockedOut: boolean;
  /** A prompt is on screen. */
  prompting: boolean;
  /** Whether a PIN may be offered right now. */
  canUsePin: boolean;
  /** Opens the prompt (the automatic first attempt). */
  prompt: () => Promise<void>;
  /** A user-initiated attempt: clears the lockout and opens a new prompt. */
  retry: () => Promise<void>;
}

export interface BiometricUnlockOptions {
  /** `false` while the caller's own PIN fallback must not be offered yet. */
  escapeAvailable?: boolean;
  /**
   * `false` for a screen that shows the PIN: the prompt must never open on its own there,
   * only from an explicit "try biometrics again" (#1052).
   */
  autoPrompt?: boolean;
}

const noop = () => {};

export const useBiometricUnlock = (
  onUnlocked: () => void,
  options: BiometricUnlockOptions = {},
): BiometricUnlock => {
  const { t } = useTranslation();
  const biometricEnabled = useBiometricStore((s) => s.biometricEnabled);
  const [failures, setFailures] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [lockedOut, setLockedOut] = useState(false);
  const [prompting, setPrompting] = useState(false);
  // Which attempt is current: a stale one that settles late must not touch the state.
  const attemptId = useRef(0);
  const mounted = useRef(true);
  // Read through a ref so a changing callback cannot restart or cancel a prompt.
  const onUnlockedRef = useRef(onUnlocked);
  useEffect(() => {
    onUnlockedRef.current = onUnlocked;
  }, [onUnlocked]);

  const autoPrompted = useRef(false);

  // The foreground state this hook last saw, so only a background → active transition
  // re-opens the prompt (not every AppState event, e.g. Android's `blur`/`focus`).
  const appStateRef = useRef<AppStateStatus>((AppState.currentState ?? 'active') as AppStateStatus);
  // Whether the last prompt ended because the system took it away, rather than because the
  // customer answered it. Only that kind is re-opened automatically on the way back.
  const interrupted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    // A fresh mount is a fresh unlock attempt: the automatic prompt is owed again.
    autoPrompted.current = false;
    return () => {
      mounted.current = false;
      // Leave no dialog behind when this screen goes away (the call is optional: not every
      // expo-local-authentication build ships it).
      try {
        void LocalAuthentication.cancelAuthenticate?.()?.catch(noop);
      } catch {
        // Best effort: nothing to clean up if the module cannot cancel.
      }
    };
  }, []);

  const runPrompt = useCallback(async (explicit: boolean): Promise<void> => {
    // A new attempt is allowed even while an older one is still in flight: dismissing the
    // system dialog does not always settle the native promise, and a stuck flag would lock
    // the sensor out of the app for the rest of the session. The busy state is driven by
    // the mount, not by this flag, and the native module already serialises its dialogs.
    // Once the attempts are used up the PIN is the only way in; only a deliberate
    // "try biometrics again" may open one more prompt.
    if (!explicit && failures >= MAX_BIOMETRIC_FAILURES) return;
    const attempt = ++attemptId.current;
    // Opened on the next tick: the automatic attempt runs from an effect, and the busy
    // flags it sets here must not be a synchronous state write inside one.
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    if (!mounted.current || attempt !== attemptId.current) return;
    setPrompting(true);
    // The user is trying again: the next failure must be judged on its own merits.
    setLockedOut(false);

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = hasHardware && await LocalAuthentication.isEnrolledAsync();
      if (!mounted.current) return;

      if (!hasHardware || !isEnrolled) {
        setUnavailable(true);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('BiometricPromptReason'),
        cancelLabel: t('ButtonCancel'),
        disableDeviceFallback: false,
      });
      if (!mounted.current) return;

      if (result.success) {
        onUnlockedRef.current();
        return;
      }

      // The system dismissed the prompt for us (the app left the foreground, a system screen
      // covered it): no failed attempt, and the way back asks again.
      if (COMPLETED_WITHOUT_ANSWER.has(result.error ?? '')) {
        interrupted.current = true;
        return;
      }

      interrupted.current = false;
      if (result.error === 'lockout') setLockedOut(true);
      setFailures((previous) => previous + 1);
    } catch {
      // A sensor that refuses to answer is the same outcome for the user as a failure,
      // and it must not leave the screen waiting forever.
      if (mounted.current) setFailures((previous) => previous + 1);
    } finally {
      if (mounted.current && attempt === attemptId.current) setPrompting(false);
    }
  }, [failures, t]);

  const exhausted = failures >= MAX_BIOMETRIC_FAILURES;
  const canUsePin = options.escapeAvailable !== false || exhausted;

  const prompt = useCallback(() => runPrompt(false), [runPrompt]);
  const retry = useCallback(() => runPrompt(true), [runPrompt]);

  // Read through a ref by the AppState listener, which is registered once and must always
  // call the latest prompt (it closes over the current failure count).
  const promptRef = useRef(prompt);
  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  // The first attempt is the automatic one; later attempts are user-initiated (`retry`).
  // `autoPrompted` is reset by the mount effect above, so a remount is owed a prompt again.
  const autoPromptEnabled = options.autoPrompt !== false;
  useEffect(() => {
    if (!autoPromptEnabled || autoPrompted.current) return;
    if (!biometricEnabled || unavailable || exhausted) return;
    autoPrompted.current = true;
    // Deferred by a task: opening the system dialog is an external side effect, and the
    // busy flags it sets must not be a synchronous state write inside an effect body.
    setTimeout(() => { void runPrompt(false); }, 0);
    // Only the switch matters: a failure is answered by the user, not by this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricEnabled, autoPromptEnabled]);

  // Coming back to the app asks again, on its own, when the prompt the system took away is
  // still the reason the app is locked: the customer opened the app to be let in, not to
  // press "try again". A prompt the customer answered (a real failure) is left as it is —
  // that is what `interrupted` separates.
  //
  // Deliberately not tied to `autoPrompt`: that option is about the *first* prompt of the
  // screen (the gate decides it itself, after its own checks), while this only revives a
  // prompt the customer had already seen and the system interrupted.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const previous = appStateRef.current;
      appStateRef.current = next;
      if (!isBackInFront(previous, next)) return;
      if (!interrupted.current || !biometricEnabled) return;
      interrupted.current = false;
      void promptRef.current();
    });
    return () => subscription.remove();
    // Registered once: the listener reads the current state through the refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    failures,
    exhausted,
    unavailable,
    lockedOut,
    prompting,
    canUsePin,
    prompt,
    retry,
  };
};
