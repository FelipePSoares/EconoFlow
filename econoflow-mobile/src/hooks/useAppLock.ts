import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useLockStore } from '../store/lockStore';

export const useAppLock = () => {
  const setBackgroundTimestamp = useLockStore((s) => s.setBackgroundTimestamp);
  const checkAndLock = useLockStore((s) => s.checkAndLock);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
        setBackgroundTimestamp();
      }
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        checkAndLock();
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [setBackgroundTimestamp, checkAndLock]);
};
