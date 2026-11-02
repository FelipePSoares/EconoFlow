import { useEffect, useRef } from 'react';
import { trace } from './trace';

type NavigationListeners = {
  addListener: (event: 'focus' | 'blur', callback: () => void) => () => void;
};

export type OnScreenRef = React.MutableRefObject<boolean>;

/**
 * Records when a screen mounts and unmounts, and answers "is this screen still on screen?".
 *
 * The question this exists for is the one a blank screen hides: **was the screen that
 * navigated still on screen when the navigation landed?** A `navigation` object captured by
 * a screen that has since unmounted still dispatches — into a navigator that no longer owns
 * the route — and the only visible result is nothing.
 *
 *   const onScreen = useScreenTrace('PinSetup');
 *   onScreen.current           // still mounted right now?
 *
 * Focus and blur are recorded through `attachNavigationListeners(navigation, screen, ref)`,
 * called with the `navigation` prop the screen already has. This hook deliberately touches no
 * navigation context, so a screen rendered on its own — a unit test, a preview — still records
 * its mount and cannot fail to render because of a diagnostic.
 */
export function useScreenTrace(screen: string): OnScreenRef {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    trace('screen.mount', { screen });
    return () => {
      mountedRef.current = false;
      trace('screen.unmount', { screen });
    };
  }, [screen]);

  return mountedRef;
}

/**
 * Records focus and blur for `screen`. Returns the unsubscribe function an effect returns.
 *
 * A navigator-less render passes no `navigation`, and this does nothing: the mount/unmount
 * trail is all there is to record, and all that is needed.
 */
export function attachNavigationListeners(
  navigation: NavigationListeners | undefined,
  screen: string,
  mountedRef: OnScreenRef,
): () => void {
  if (!navigation || typeof navigation.addListener !== 'function') return () => undefined;

  const focused = (): void => {
    mountedRef.current = true;
    trace('screen.focus', { screen });
  };
  const blurred = (): void => {
    mountedRef.current = false;
    trace('screen.blur', { screen });
  };

  const offFocus = navigation.addListener('focus', focused);
  const offBlur = navigation.addListener('blur', blurred);
  return () => {
    offFocus();
    offBlur();
  };
}
