import { useCallback, useEffect, useRef, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { hydrateBiometricStore, useBiometricStore } from '../store/biometricStore';

/**
 * Why biometrics could not be turned on. The UI words each case differently, because a
 * device without a sensor, a device with no enrolled fingerprint and a sensor that fails
 * to answer need three different fixes.
 */
export type BiometricFailure = 'hardware' | 'not-enrolled' | 'unknown' | 'not-hydrated';

export type BiometricToggleResult =
  | { ok: true }
  | { ok: false; reason: BiometricFailure };

export interface BiometricToggle {
  /** Whether biometrics are on, as persisted. */
  biometricEnabled: boolean;
  /** Whether the persisted state has been read; a tap before that is refused. */
  isHydrated: boolean;
  /** Whether a check (enabling) is in flight. */
  isPending: boolean;
  /** Whether the row should accept a tap right now. */
  enabled: boolean;
  /**
   * One entry point for the Profile row and the enrollment button. Enabling checks the
   * hardware and the enrolment first and only then persists `true`, so the switch cannot
   * read ON on a device that will fail at unlock (#1052).
   */
  setBiometricEnabled: (enabled: boolean) => Promise<BiometricToggleResult>;
}

const NOT_ENROLLED: BiometricToggleResult = { ok: false, reason: 'not-enrolled' };
const NO_HARDWARE: BiometricToggleResult = { ok: false, reason: 'hardware' };
const UNKNOWN: BiometricToggleResult = { ok: false, reason: 'unknown' };
const NOT_READY: BiometricToggleResult = { ok: false, reason: 'not-hydrated' };
const OK: BiometricToggleResult = { ok: true };

/**
 * Shared state of the single "turn biometrics on/off" flow.
 *
 * Both the Profile row and the enrollment screen go through it so they cannot disagree
 * about what is possible on the device, and so a double tap cannot run the native checks
 * (or the store write) twice: every caller joins the request already in flight.
 */
const inFlightRequests = new Map<boolean, Promise<BiometricToggleResult>>();

const checkBiometricsAvailable = async (): Promise<BiometricToggleResult> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    // Asking whether anything is enrolled on hardware that cannot answer is pointless,
    // and on some Androids it throws instead of returning false.
    if (!hasHardware) return NO_HARDWARE;
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return isEnrolled ? OK : NOT_ENROLLED;
  } catch {
    // A native module that is missing or refuses to answer is not a permission problem:
    // the setting stays off and the row says so instead of failing silently.
    return UNKNOWN;
  }
};

export const useBiometricToggle = (): BiometricToggle => {
  const biometricEnabled = useBiometricStore((s) => s.biometricEnabled);
  const storeHydrated = useBiometricStore((s) => s.hydrated);
  const setStoreBiometricEnabled = useBiometricStore((s) => s.setBiometricEnabled);

  // Reads the persisted value once per app run. Until it lands the row stays disabled, so
  // a tap cannot be applied to defaults that a read in flight would then overwrite (#1052).
  const [hydrationRequested, setHydrationRequested] = useState(false);
  useEffect(() => {
    let cancelled = false;
    hydrateBiometricStore().finally(() => {
      if (!cancelled) setHydrationRequested(true);
    });
    return () => { cancelled = true; };
  }, []);

  const [pendingRequest, setPendingRequest] = useState<Promise<BiometricToggleResult> | null>(null);
  // Read outside the render cycle: two taps in the same frame both see the first request.
  const pendingRef = useRef<Promise<BiometricToggleResult> | null>(null);

  const isHydrated = storeHydrated || hydrationRequested || useBiometricStore.persist.hasHydrated();
  const isPending = pendingRequest !== null;

  const setBiometricEnabled = useCallback(
    (enabled: boolean): Promise<BiometricToggleResult> => {
      // Turning the feature off must always work; turning it on needs the stored value to
      // be known first, or the request would be applied over a state that is about to be
      // replaced by the persisted one.
      if (!enabled) {
        setStoreBiometricEnabled(false);
        return Promise.resolve(OK);
      }

      if (!isHydrated) return Promise.resolve(NOT_READY);

      const inFlight = inFlightRequests.get(true);
      if (inFlight) return inFlight;

      const request = (async (): Promise<BiometricToggleResult> => {
        try {
          const availability = await checkBiometricsAvailable();
          if (!availability.ok) return availability;
          setStoreBiometricEnabled(true);
          // The declined offer is left declined: turning biometrics on from Profile is a
          // proactive move that needs no offer, while clearing the flag made the next
          // launch navigate back to the enrollment screen (#1052).
          return OK;
        } catch {
          return UNKNOWN;
        }
      })();

      inFlightRequests.set(true, request);
      pendingRef.current = request;
      setPendingRequest(request);

      return request.finally(() => {
        inFlightRequests.delete(true);
        if (pendingRef.current === request) {
          pendingRef.current = null;
          setPendingRequest(null);
        }
      });
    },
    [isHydrated, setStoreBiometricEnabled],
  );

  return {
    biometricEnabled,
    isHydrated,
    isPending,
    enabled: isHydrated && !isPending,
    setBiometricEnabled,
  };
};
