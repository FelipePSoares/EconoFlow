import { useNotificationStore } from '../notificationStore';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('notificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      expoPushToken: null,
      notificationsEnabled: false,
      hasPromptedForPermission: false,
      pushPermissionStatus: 'undetermined',
      canAskForPermission: true,
      currentUserKey: null,
      lastPermissionError: null,
    });
  });

  describe('setExpoPushToken', () => {
    it('sets the push token', () => {
      useNotificationStore.getState().setExpoPushToken('ExponentPushToken[abc]');
      expect(useNotificationStore.getState().expoPushToken).toBe('ExponentPushToken[abc]');
    });
  });

  describe('setNotificationsEnabled', () => {
    it('sets notificationsEnabled to true', () => {
      useNotificationStore.getState().setNotificationsEnabled(true);
      expect(useNotificationStore.getState().notificationsEnabled).toBe(true);
    });

    it('sets notificationsEnabled to false', () => {
      useNotificationStore.getState().setNotificationsEnabled(true);
      useNotificationStore.getState().setNotificationsEnabled(false);
      expect(useNotificationStore.getState().notificationsEnabled).toBe(false);
    });
  });

  describe('permission state (#1053)', () => {
    it('starts unprompted with an undetermined OS permission', () => {
      const state = useNotificationStore.getState();

      expect(state.hasPromptedForPermission).toBe(false);
      expect(state.pushPermissionStatus).toBe('undetermined');
      expect(state.canAskForPermission).toBe(true);
    });

    it('setHasPromptedForPermission records that the user answered the prompt', () => {
      useNotificationStore.getState().setHasPromptedForPermission(true);

      expect(useNotificationStore.getState().hasPromptedForPermission).toBe(true);
    });

    it('setPermissionState stores the OS status and whether it can still be asked', () => {
      useNotificationStore.getState().setPermissionState('denied', false);

      expect(useNotificationStore.getState().pushPermissionStatus).toBe('denied');
      expect(useNotificationStore.getState().canAskForPermission).toBe(false);
    });

    it('setPermissionState defaults canAskForPermission to true when omitted', () => {
      useNotificationStore.getState().setPermissionState('granted');

      expect(useNotificationStore.getState().pushPermissionStatus).toBe('granted');
      expect(useNotificationStore.getState().canAskForPermission).toBe(true);
    });
  });

  describe('persistence (#1053)', () => {
    // The prompt answer has to survive an app restart: a token purge, a reinstall-free
    // update or a second login must not ask the OS again. `partialize` decides what is
    // written to SecureStore, so it is asserted directly.
    it('persists hasPromptedForPermission alongside the token state', () => {
      const options = (useNotificationStore as unknown as {
        persist: { getOptions: () => { partialize: (s: unknown) => Record<string, unknown> } };
      }).persist.getOptions();

      const persisted = options.partialize({
        ...useNotificationStore.getState(),
        hasPromptedForPermission: true,
      });

      expect(persisted).toMatchObject({ hasPromptedForPermission: true });
    });
  });

  describe('clearNotificationState', () => {
    it('resets push token and disabled notifications', () => {
      useNotificationStore.getState().setExpoPushToken('ExponentPushToken[abc]');
      useNotificationStore.getState().setNotificationsEnabled(true);

      useNotificationStore.getState().clearNotificationState();

      expect(useNotificationStore.getState().expoPushToken).toBeNull();
      expect(useNotificationStore.getState().notificationsEnabled).toBe(false);
    });

    it('keeps the permission answer on a plain sign-out (#1053)', () => {
      // Signing out must not turn the next login into a fresh install: the OS already
      // answered for this user, so the rationale and the prompt stay suppressed.
      useNotificationStore.getState().setHasPromptedForPermission(true);
      useNotificationStore.getState().setPermissionState('denied', false);

      useNotificationStore.getState().clearNotificationState();

      expect(useNotificationStore.getState().hasPromptedForPermission).toBe(true);
      expect(useNotificationStore.getState().pushPermissionStatus).toBe('denied');
    });
  });

  describe('resetPermissionPrompt (#1053)', () => {
    it('forgets that the user was prompted, so the next session asks again', () => {
      useNotificationStore.getState().setHasPromptedForPermission(true);
      useNotificationStore.getState().setPermissionState('denied', false);

      useNotificationStore.getState().resetPermissionPrompt();

      expect(useNotificationStore.getState().hasPromptedForPermission).toBe(false);
      expect(useNotificationStore.getState().pushPermissionStatus).toBe('undetermined');
      expect(useNotificationStore.getState().canAskForPermission).toBe(true);
    });

    it('is what a different account gets on sign-out, while the same user keeps the answer', () => {
      const { setCurrentUserKey } = useNotificationStore.getState() as unknown as {
        setCurrentUserKey: (key: string | null) => void;
      };

      setCurrentUserKey('user-a');
      useNotificationStore.getState().setHasPromptedForPermission(true);
      setCurrentUserKey(null);

      expect(useNotificationStore.getState().hasPromptedForPermission).toBe(true);
    });

    it('resets the answer when a different account signs in after a sign-out', () => {
      const { setCurrentUserKey } = useNotificationStore.getState() as unknown as {
        setCurrentUserKey: (key: string | null) => void;
      };

      setCurrentUserKey('user-a');
      useNotificationStore.getState().setHasPromptedForPermission(true);
      // Sign-out does not clear the answer — the same user logging back in stays silent…
      setCurrentUserKey(null);
      // …but a different account on the shared device starts from scratch.
      setCurrentUserKey('user-b');

      expect(useNotificationStore.getState().hasPromptedForPermission).toBe(false);
      expect(useNotificationStore.getState().currentUserKey).toBe('user-b');
    });

    it('keeps the answer when the same account signs in again', () => {
      // `clearAuth` does not touch this store, so the key survives a sign-out: the same
      // id coming back is not a new user and must stay silent.
      const { setCurrentUserKey } = useNotificationStore.getState() as unknown as {
        setCurrentUserKey: (key: string | null) => void;
      };

      setCurrentUserKey('user-a');
      useNotificationStore.getState().setHasPromptedForPermission(true);
      setCurrentUserKey('user-a');

      expect(useNotificationStore.getState().hasPromptedForPermission).toBe(true);
    });

    it('resets the answer when a different account signs in', () => {
      const { setCurrentUserKey } = useNotificationStore.getState() as unknown as {
        setCurrentUserKey: (key: string | null) => void;
      };

      setCurrentUserKey('user-a');
      useNotificationStore.getState().setHasPromptedForPermission(true);

      setCurrentUserKey('user-b');

      expect(useNotificationStore.getState().hasPromptedForPermission).toBe(false);
    });
  });
});
