import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useLockStore } from '../store/lockStore';

const INITIAL_APP_STATE: AppStateStatus =
  AppState.currentState === 'background' || AppState.currentState === 'inactive' ? AppState.currentState : 'active';

export const useAppLock = () => {
  const setBackgroundTimestamp = useLockStore((s) => s.setBackgroundTimestamp);
  const checkAndLock = useLockStore((s) => s.checkAndLock);
  const appStateRef = useRef<AppStateStatus>(INITIAL_APP_STATE);

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
