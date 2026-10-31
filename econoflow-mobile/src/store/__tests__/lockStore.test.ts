import { useLockStore } from '../lockStore';

beforeEach(() => {
  useLockStore.setState({ lastBackgroundTimestamp: null, isLocked: false });
});

describe('lockStore', () => {
  it('starts unlocked with no timestamp', () => {
    const state = useLockStore.getState();
    expect(state.isLocked).toBe(false);
    expect(state.lastBackgroundTimestamp).toBeNull();
  });

  it('setBackgroundTimestamp stores current time', () => {
    const now = Date.now();
    useLockStore.getState().setBackgroundTimestamp();
    const stored = useLockStore.getState().lastBackgroundTimestamp!;
    expect(stored).toBeGreaterThanOrEqual(now);
    expect(stored).toBeLessThanOrEqual(Date.now());
  });

  it('checkAndLock locks after 5 minutes', () => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    useLockStore.setState({ lastBackgroundTimestamp: fiveMinAgo, isLocked: false });
    useLockStore.getState().checkAndLock();
    expect(useLockStore.getState().isLocked).toBe(true);
  });

  it('checkAndLock does not lock before 5 minutes', () => {
    const oneMinAgo = Date.now() - 60 * 1000;
    useLockStore.setState({ lastBackgroundTimestamp: oneMinAgo, isLocked: false });
    useLockStore.getState().checkAndLock();
    expect(useLockStore.getState().isLocked).toBe(false);
  });

  it('checkAndLock does nothing if already locked', () => {
    useLockStore.setState({ lastBackgroundTimestamp: Date.now(), isLocked: true });
    useLockStore.getState().checkAndLock();
    expect(useLockStore.getState().isLocked).toBe(true);
  });

  it('checkAndLock does nothing if no timestamp', () => {
    useLockStore.getState().checkAndLock();
    expect(useLockStore.getState().isLocked).toBe(false);
  });

  it('setUnlocked clears locked state', () => {
    useLockStore.setState({ isLocked: true });
    useLockStore.getState().setUnlocked();
    expect(useLockStore.getState().isLocked).toBe(false);
  });

  // #1052: `checkAndLock` only knows about time spent in a *background* transition. A
  // relaunch is the longest absence of all and never produces one, so without the expired
  // session the unlock gate was skipped entirely and the app opened straight to the data.
  // #1052: the lock must never exist without a session. Starting locked and judging the
  // expiry only afterwards left a first-ever launch — or a signed-out one — locked, and
  // the overlay painted a PIN pad over the Login screen.
  it('is not locked when there is no stored session to restore', () => {
    useLockStore.setState({ lastBackgroundTimestamp: null, isLocked: true });

    useLockStore.getState().lockExpiredSession();

    expect(useLockStore.getState().isLocked).toBe(false);
  });

  it('requires the unlock after a relaunch for a session that expired', () => {
    useLockStore.setState({ lastBackgroundTimestamp: Date.now() - 6 * 60 * 1000, isLocked: false });

    useLockStore.getState().lockExpiredSession();

    expect(useLockStore.getState().isLocked).toBe(true);
  });

  it('does not lock a relaunch when the session was still valid', () => {
    useLockStore.setState({ lastBackgroundTimestamp: Date.now() - 60 * 1000, isLocked: false });

    useLockStore.getState().lockExpiredSession();

    expect(useLockStore.getState().isLocked).toBe(false);
  });

  it('closes the session window once it has been checked, so a quick relaunch is not locked', () => {
    // Backgrounding for a moment and reopening must stay unlocked, which is exactly what
    // the background check gives; the session window has to be consumed to not undo it.
    useLockStore.setState({ lastBackgroundTimestamp: Date.now() - 6 * 60 * 1000, isLocked: false });

    useLockStore.getState().lockExpiredSession();

    expect(useLockStore.getState().lastBackgroundTimestamp).toBeNull();
  });

  // #1052: a sign-out must leave nothing behind. The lock stores hold the next session's
  // shortcuts — a leftover `biometricEnabled`/`hasPin` means the next sign-in is unlocked
  // by the fingerprint dialog instead of asking for a PIN.
  it('a fresh session starts with no lock state at all', () => {
    useLockStore.setState({ lastBackgroundTimestamp: 12345, isLocked: true });

    useLockStore.getState().reset();

    const state = useLockStore.getState();
    expect(state.isLocked).toBe(false);
    expect(state.lastBackgroundTimestamp).toBeNull();
  });

  it('reset clears everything', () => {
    useLockStore.setState({ lastBackgroundTimestamp: 12345, isLocked: true });
    useLockStore.getState().reset();
    const state = useLockStore.getState();
    expect(state.isLocked).toBe(false);
    expect(state.lastBackgroundTimestamp).toBeNull();
  });
});
