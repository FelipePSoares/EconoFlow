import { useCallback, useEffect, useRef, useState } from 'react';
import { useNotificationStore } from '../store/notificationStore';
import { requestNotificationPermissionAndRegister } from './usePushNotifications';
import { captureError } from '../monitoring/sentry';

/**
 * Drives the first-login notification prompt (#1053).
 *
 * Every authenticated path — password login, registration auto-login, 2FA — ends up on
 * the same post-login screen, which mounts this hook once. That placement matters: the
 * OS dialog is only requested after the navigator has settled (the biometric gate has
 * already run and the screen that triggered the login has unmounted), which is the
 * situation where Android 13+ used to swallow the POST_NOTIFICATIONS prompt.
 */
export interface NotificationPermissionPromptState {
  /** `true` while the user has never answered for this account. */
  shouldShowRationale: boolean;
  /** `true` after the OS refused and cannot be asked again in-app. */
  permissionDenied: boolean;
  canAskForPermission: boolean;
  /** Runs the permission + registration flow, resolving the rationale. */
  request: () => Promise<void>;
  /** The user declined the rationale: treat it as an answer and stop asking. */
  dismissPermissionDenied: () => void;
}

export const useNotificationPermissionPrompt = (): NotificationPermissionPromptState => {
  const hasPromptedForPermission = useNotificationStore((s) => s.hasPromptedForPermission);
  const pushPermissionStatus = useNotificationStore((s) => s.pushPermissionStatus);
  const canAskForPermission = useNotificationStore((s) => s.canAskForPermission);
  const hasHydrated = useNotificationStore((s) => s.hasHydrated);
  const [isDismissed, setIsDismissed] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    // SecureStore rehydrates asynchronously: acting before it settles would treat a
    // returning user as a fresh install and re-open the OS dialog.
    if (!hasHydrated || hasRun.current) return;
    hasRun.current = true;
    // `.catch` also covers a synchronous throw from the flow, so the automatic bootstrap
    // can never crash the screen.
    Promise.resolve(requestNotificationPermissionAndRegister()).catch((err: unknown) => {
      captureError(err, { screen: 'NotificationPermissionPrompt', action: 'bootstrap' });
    });
  }, [hasHydrated]);

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
    useNotificationStore.getState().setHasPromptedForPermission(true);
    setIsDismissed(true);
  }, []);

  const permissionDenied = pushPermissionStatus === 'denied'
    && hasPromptedForPermission
    && !canAskForPermission
    && !isDismissed;

  // Negative: "the user has not answered yet". `hasPromptedForPermission` is recorded
  // when the dialog is shown (whatever the answer) or when the rationale is skipped, so
  // this only re-opens after an answer that was never persisted.
  const shouldShowRationale = !hasPromptedForPermission && canAskForPermission && !isDismissed;

  return {
    shouldShowRationale,
    permissionDenied,
    canAskForPermission,
    request,
    dismissPermissionDenied,
  };
};
