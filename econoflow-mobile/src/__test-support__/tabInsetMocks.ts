/**
 * The safe-area insets a tab screen reads, as a Jest module mock.
 *
 * The tab root screens (Overview, Plans, Profile, Projects) pad their own header with the
 * top inset, and the defect they are tested against is exactly that padding — so their suites
 * must be able to say what the device reported. A case assigns `mockTabInsets.current` and
 * renders; the hook reads it on **every call**, so nothing here can be captured once and go
 * stale (the same rule as `lockStoreMocks.ts`).
 *
 * Used from inside a `jest.mock('react-native-safe-area-context', …)` factory
 * (`jest.requireActual`) — a factory may only reach into other modules.
 */

export type TabInsets = { top: number; bottom: number; left: number; right: number };

/** The insets the device reports; tests move this. */
export const mockTabInsets: { current: TabInsets } = {
  current: { top: 0, bottom: 0, left: 0, right: 0 },
};

/** The steady device: a status bar and a gesture bar. */
export const defaultTabInsets = (): TabInsets => ({ top: 48, bottom: 24, left: 0, right: 0 });

/** Resets the insets between cases. */
export function resetTabInsets(): void {
  mockTabInsets.current = { top: 0, bottom: 0, left: 0, right: 0 };
}
