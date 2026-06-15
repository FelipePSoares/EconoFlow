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

  it('reset clears everything', () => {
    useLockStore.setState({ lastBackgroundTimestamp: 12345, isLocked: true });
    useLockStore.getState().reset();
    const state = useLockStore.getState();
    expect(state.isLocked).toBe(false);
    expect(state.lastBackgroundTimestamp).toBeNull();
  });
});
