import { useColorScheme } from 'react-native';

export interface AuroraSkin {
  dark: boolean;
  /** Primary text */
  ink: string;
  /** Secondary/muted text */
  ink2: string;
  /** Page background */
  bg: string;
  /** Hairline divider */
  hair: string;
}

/**
 * Pure function — use when `dark` arrives as a prop rather than from the
 * colour-scheme hook (e.g. inside components that receive dark as a prop).
 */
export const auroraTokens = (dark: boolean): AuroraSkin => ({
  dark,
  ink:  dark ? '#e6edf3' : '#0d2137',
  ink2: dark ? '#8aa0b6' : '#5b6b7c',
  bg:   dark ? '#061e33' : '#e6eff6',
  hair: dark ? 'rgba(255,255,255,0.08)' : 'rgba(13,33,55,0.08)',
});

/**
 * Hook — use in screens and root-level components that own the colour-scheme
 * query. Calls `useColorScheme` internally so the caller doesn't have to.
 */
export const useAuroraSkin = (): AuroraSkin => {
  const dark = useColorScheme() === 'dark';
  return auroraTokens(dark);
};
