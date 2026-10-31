import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { captureError } from '../monitoring/sentry';

interface SecureStorage {
  getItem(name: string): Promise<string | null>;
  setItem(name: string, value: string): Promise<void>;
  removeItem(name: string): Promise<void>;
}

const secureStorage: SecureStorage = {
  getItem: (name) => SecureStore.getItemAsync(name),
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  removeItem: (name) => SecureStore.deleteItemAsync(name),
};

/**
 * Mirrors `expo-notifications`' permission status. Kept as a plain union so the store
 * stays importable outside the push flow — the package may not be loaded at module
 * scope on Expo Go (expo/expo#52175).
 */
export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface NotificationState {
  expoPushToken: string | null;
  /**
   * Derived, not authoritative: true only when the OS grants notifications *and* the
   * token was registered with the backend.
   */
  notificationsEnabled: boolean;
  /**
   * `true` once the user answered the notification prompt — or declined the rationale —
   * for the current account. Persisted so a restart or a second login does not ask again.
   */
  hasPromptedForPermission: boolean;
  /** Last permission status read from (or returned by) the OS. */
  pushPermissionStatus: PushPermissionStatus;
  /** Whether the OS can still show the permission dialog (`denied` + "don't ask again" = false). */
  canAskForPermission: boolean;
  /** Key of the account the prompt answer belongs to; a different account starts over. */
  currentUserKey: string | null;
  /**
   * Key of the account that is signed in for this app run, bound by the auth store on a
   * login *and* on a relaunch. Never persisted: the rehydration binds it again.
   *
   * The post-login prompt waits for `currentUserKey` to match it, so it can tell "the read
   * of the stored answer has not landed yet" (the two stores hydrate in either order)
   * apart from "this account has never answered" (#1053).
   */
  signedInUserKey: string | null;
  /**
   * Whether this app run has been bound to an account yet — by a login or by the
   * rehydrated auth state. A field of its own so a subscriber can tell "the launch knows
   * whose answer this is" even when the account keys happen to be unchanged. Never
   * persisted: every launch binds again.
   */
  sessionBound: boolean;
  /** `false` until SecureStore rehydration settles, so the post-login flow does not race it. */
  hasHydrated: boolean;
  /**
   * Last failure reported by the shared permission flow, so screens that did not start
   * it (Profile) can still explain why nothing happened.
   */
  lastPermissionError: 'device' | 'unavailable' | 'permission' | 'api' | 'unknown' | null;
  setExpoPushToken: (token: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setHasPromptedForPermission: (prompted: boolean) => void;
  /**
   * Records that the user has answered the rationale or the OS dialog for this account.
   *
   * One write instead of two: `hasPromptedForPermission` and `canAskForPermission` are
   * separate fields, and a caller that wrote the first while the second was still `false`
   * (a `set` built by spreading a stale snapshot) silently undid its own answer — which
   * made the rationale reappear on the next launch.
   */
  markAsked: () => void;
  setPermissionState: (status: PushPermissionStatus, canAskAgain?: boolean) => void;
  setLastPermissionError: (reason: NotificationState['lastPermissionError']) => void;
  setCurrentUserKey: (key: string | null) => void;
  /** Binds this app run to an account (login and relaunch); resets a different account's answer. */
  bindSignedInUser: (key: string | null) => void;
  /** Forget the prompt answer for the next session, keeping the token/registration state. */
  resetPermissionPrompt: () => void;
  clearNotificationState: () => void;
}

const initialPermissionState = {
  hasPromptedForPermission: false,
  pushPermissionStatus: 'undetermined' as PushPermissionStatus,
  canAskForPermission: true,
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      expoPushToken: null,
      notificationsEnabled: false,
      ...initialPermissionState,
      currentUserKey: null,
      signedInUserKey: null,
      sessionBound: false,
      hasHydrated: false,
      lastPermissionError: null,
      setExpoPushToken: (token) => set({ expoPushToken: token }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setHasPromptedForPermission: (prompted) => set({ hasPromptedForPermission: prompted }),
      markAsked: () => set({ hasPromptedForPermission: true }),
      setPermissionState: (status, canAskAgain = true) =>
        set({ pushPermissionStatus: status, canAskForPermission: canAskAgain }),
      setLastPermissionError: (reason) => set({ lastPermissionError: reason }),
      setCurrentUserKey: (key) => {
        const previousKey = get().currentUserKey;
        // The prompt is per user: another account on the same device has never answered
        // for itself, so it gets its own rationale + one OS prompt. A plain sign-out
        // (`null` key) keeps the answer — the same user logging back in is not new — but
        // once a *different* account signs in (even after that null), it starts over.
        const isDifferentUser = key !== null && key !== previousKey;
        set(
          isDifferentUser
            ? { currentUserKey: key, ...initialPermissionState }
            : { currentUserKey: key },
        );
      },
      bindSignedInUser: (key) => {
        // `setCurrentUserKey` must run first: for a different account it clears the
        // previous answer, and a plain assignment here would leave `signedInUserKey`
        // looking already-answered-by-this-account to the prompt.
        get().setCurrentUserKey(key);
        set({ signedInUserKey: key, sessionBound: true });
      },
      resetPermissionPrompt: () => set({ ...initialPermissionState }),
      clearNotificationState: () => set({ expoPushToken: null, notificationsEnabled: false }),
    }),
    {
      name: 'econoflow-notifications',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        expoPushToken: state.expoPushToken,
        notificationsEnabled: state.notificationsEnabled,
        hasPromptedForPermission: state.hasPromptedForPermission,
        pushPermissionStatus: state.pushPermissionStatus,
        canAskForPermission: state.canAskForPermission,
        currentUserKey: state.currentUserKey,
      }),
      onRehydrateStorage: () => (_state, error) => {
        // A failed read still ends the wait: the flow must not hang on a broken keychain.
        if (error) {
          captureError(error, { screen: 'notificationStore', action: 'rehydrate' });
        }
        useNotificationStore.setState({ hasHydrated: true });
      },
    },
  ),
);
