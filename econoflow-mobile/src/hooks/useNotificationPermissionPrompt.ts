import { useCallback, useEffect, useRef, useState } from 'react';
import { useNotificationStore } from '../store/notificationStore';
import { requestNotificationPermissionAndRegister } from './usePushNotifications';
import { captureError } from '../monitoring/sentry';

/**
 * Drives the first-login notification prompt (#1053).
 *
 * Every authenticated path — password login, registration auto-login, 2FA, a relaunch —
 * ends up on the same post-login screen, which mounts this hook once. That placement
 * matters: the OS dialog is only requested after the navigator has settled (the unlock
 * gate has already run and the screen that triggered the login has unmounted), which is
 * the situation where Android 13+ used to swallow the POST_NOTIFICATIONS prompt.
 *
 * Nothing is decided until the state of this app *for the signed-in account* is known.
 * On a relaunch the stored answer and the rehydrated account arrive as two independent
 * asynchronous reads, in either order; deciding on the first one told every returning
 * user that notifications had never been allowed, so they were asked again on each
 * launch and the activation message never appeared for anyone who answered it.
 */
export interface NotificationPermissionPromptState {
  /**
   * `true` while notifications are not active for this account and it has never answered
   * the prompt. Stays `false` while the stored answer and the account are still unknown.
   */
  shouldShowRationale: boolean;
  /** `true` after the OS refused and cannot be asked again in-app. */
  permissionDenied: boolean;
  canAskForPermission: boolean;
  /** Runs the permission + registration flow, resolving the rationale. */
  request: () => Promise<void>;
  /** The user declined the rationale: treat it as an answer and stop asking. */
  dismissPermissionDenied: () => void;
}

/** Key recorded when a session was decided before any account was bound. */
const ANONYMOUS_SESSION = '<no-account>';

/**
 * Whether the account this app run was started for has already been decided.
 *
 * `hydrated && bound`: the stored answer has been read and the launch knows whose answer
 * it is. Only then may `hasPromptedForPermission === false` be read as "never asked" —
 * before that it is simply the default.
 */
const isAnswerKnown = ({
  hasHydrated,
  sessionBound,
}: {
  hasHydrated: boolean;
  sessionBound: boolean;
}): boolean => hasHydrated && sessionBound;

/**
 * Which session the last decision was made for, so a second account bound in the same
 * app run (sign-out, sign-in) is decided again. Kept at module scope: the hook unmounts
 * with the session navigator, and a remount must not lose the fact that it already ran.
 */
let decidedForAccount: string | null = null;

export const useNotificationPermissionPrompt = (): NotificationPermissionPromptState => {
  const hasPromptedForPermission = useNotificationStore((s) => s.hasPromptedForPermission);
  const pushPermissionStatus = useNotificationStore((s) => s.pushPermissionStatus);
  const canAskForPermission = useNotificationStore((s) => s.canAskForPermission);
  const hasHydrated = useNotificationStore((s) => s.hasHydrated);
  const sessionBound = useNotificationStore((s) => s.sessionBound);
  const signedInUserKey = useNotificationStore((s) => s.signedInUserKey);
  // `notificationsEnabled` only becomes true once the device is registered with the
  // backend, which is the app's own record that this installation is active (#1053).
  const notificationsEnabled = useNotificationStore((s) => s.notificationsEnabled);
  const [isDismissed, setIsDismissed] = useState(false);
  const hasRun = useRef(false);

  const ready = isAnswerKnown({ hasHydrated, sessionBound });

  useEffect(() => {
    if (!ready) return;
    // A different account in the same app run starts over: it has its own answer.
    const account = signedInUserKey ?? ANONYMOUS_SESSION;
    if (decidedForAccount !== null && decidedForAccount !== account) {
      hasRun.current = false;
    }
    decidedForAccount = account;
    if (hasRun.current) return;

    // The store, not this render: the answer and the account can land in the same commit.
    const store = useNotificationStore.getState();

    if (store.hasPromptedForPermission) {
      // Answered before, for this account: silence is the whole point.
      hasRun.current = true;
      return;
    }

    if (store.notificationsEnabled) {
      // Registered already (a backgrounded app that was not killed): there is no
      // activation to announce and nothing to ask.
      hasRun.current = true;
      store.markAsked();
      return;
    }

    hasRun.current = true;
    // `.catch` also covers a synchronous throw from the flow, so the automatic bootstrap
    // can never crash the screen.
    Promise.resolve(requestNotificationPermissionAndRegister()).catch((err: unknown) => {
      captureError(err, { screen: 'NotificationPermissionPrompt', action: 'bootstrap' });
    });
  }, [ready, signedInUserKey, hasPromptedForPermission, notificationsEnabled]);

  const request = useCallback(async () => {
    hasRun.current = true;
    // The user changed their mind after "Not now": the rationale is answered either way
    // by the dialog that is about to open, so the card stops showing immediately.
    setIsDismissed(true);
    try {
      await requestNotificationPermissionAndRegister();
    } catch (err) {
      // The flow reports its own failures (Sentry + `lastPermissionError`); letting the
      // rejection escape here would surface as an unhandled promise on a button press.
      captureError(err, { screen: 'NotificationPermissionPrompt', action: 'request' });
    }
  }, []);

  const dismissPermissionDenied = useCallback(() => {
    // Declining the rationale counts as the user's answer, otherwise the next login
    // would show it again forever without ever reaching the OS dialog.
    useNotificationStore.getState().markAsked();
    setIsDismissed(true);
  }, []);

  const permissionDenied = ready
    && pushPermissionStatus === 'denied'
    && hasPromptedForPermission
    && !canAskForPermission
    && !isDismissed;

  // Negative: "the user has not answered yet". `hasPromptedForPermission` is recorded
  // when the dialog is shown (whatever the answer) or when the rationale is skipped, so
  // this only re-opens after an answer that was never persisted.
  const shouldShowRationale = ready
    && !notificationsEnabled
    && !hasPromptedForPermission
    && canAskForPermission
    && !isDismissed;

  return {
    shouldShowRationale,
    permissionDenied,
    canAskForPermission,
    request,
    dismissPermissionDenied,
  };
};
