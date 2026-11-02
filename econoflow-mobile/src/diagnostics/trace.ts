import { NativeModules } from 'react-native';

/**
 * The app's diagnostic trail.
 *
 * ## Why this exists
 *
 * Diagnosing #1116 (a successful login that ends on a blank screen) took hours for one
 * reason: **the app could not say what it was doing.**
 *
 * Measured on the emulator, repeatedly: `console.log`, `console.warn` and `console.error`
 * from the app's own JavaScript never reach `adb logcat` in this build, with or without a
 * Detox session attached. Only React Native's *internal* error reporter gets through. Every
 * design built on `console` therefore recorded nothing.
 *
 * ## The sink that works
 *
 * `modules/econoflow-log` is a local Expo module whose Kotlin side calls `Log.i`. The binding
 * is resolved **once, at module load**, and the resolved form is recorded as the trail's first
 * event — because "the module did not load" and "nothing is calling trace()" look identical in
 * an empty log, and telling them apart is the whole game.
 *
 *     adb logcat -s EconoFlowTrace
 *
 * The module is looked up defensively (`NativeModules`, then `expo.modules`, then
 * `requireOptionalNativeModule`): a build without it — Expo Go, a stale dev client — records
 * that fact and carries on. A diagnostic must never be the reason the app fails to start.
 */

export interface DiagnosticRecord {
  /** Monotonic per app run, so order survives coarse timestamps. */
  seq: number;
  /** Epoch milliseconds. */
  at: number;
  /** `area.action`, e.g. `pinsetup.navigate.dispatch`. */
  event: string;
  data?: Record<string, unknown>;
}

interface NativeLogBinding {
  log(level: string, tag: string, message: string): void;
}

const TAG = 'EconoFlowTrace';
const MAX_ENTRIES = 500;

const entries: DiagnosticRecord[] = [];
let sequence = 0;

/** How the native sink was found — reported by the trail's own first event. */
type BindingSource = 'expo.modules' | 'NativeModules' | 'optional' | 'none';

const binding = resolveNativeLog();

function resolveNativeLog(): { source: BindingSource; module: NativeLogBinding | null } {
  // 1. `globalThis.expo.modules` — where this SDK's module registry puts them.
  try {
    const registry = (globalThis as {
      expo?: { modules?: Record<string, NativeLogBinding> };
    }).expo?.modules;
    if (registry && typeof registry.EconoFlowLog?.log === 'function') {
      return { source: 'expo.modules', module: registry.EconoFlowLog };
    }
  } catch {
    // Fall through to the next lookup.
  }

  // 2. The classic bridge.
  try {
    const classic = NativeModules.EconoFlowLog as NativeLogBinding | undefined;
    if (classic && typeof classic.log === 'function') {
      return { source: 'NativeModules', module: classic };
    }
  } catch {
    // Fall through.
  }

  return { source: 'none', module: null };
}

/** Whether the native sink was found; the first trail event records the same fact. */
export const hasNativeLogSink = (): boolean => binding.module !== null;

/**
 * Records one event. Never throws: a diagnostic that fails must not become the failure.
 *
 * The native log is written first and synchronously — a crash or a navigation that leaves the
 * tree unpainted cannot take it away — then the in-memory ring, which is what a unit test
 * asserts on.
 */
export function trace(event: string, data?: Record<string, unknown>): void {
  sequence += 1;
  const record: DiagnosticRecord = { seq: sequence, at: Date.now(), event, data };

  entries.push(record);
  if (entries.length > MAX_ENTRIES) entries.shift();

  writeToNativeLog(record);
}

/** Records an event once the current work has finished — order relative to a frame matters. */
export function traceAfterFrame(event: string, data?: Record<string, unknown>): void {
  requestAnimationFrame(() => trace(event, data));
}

/** The trail held in memory, oldest first. */
export const diagnosticEntries = (): DiagnosticRecord[] => entries.slice();

/** The trail as JSON lines, for a report from a running app. */
export const diagnosticLines = (): string[] => entries.map(serialise);

/** Erases the in-memory trail. The device log is cleared with `adb logcat -c`. */
export function resetDiagnostics(): void {
  entries.length = 0;
  sequence = 0;
}

function writeToNativeLog(record: DiagnosticRecord): void {
  const sink = binding.module;
  if (!sink) return;
  try {
    sink.log('info', TAG, `${record.seq} ${record.event}${record.data ? ` ${safeJson(record.data)}` : ''}`);
  } catch {
    // The in-memory ring above still has the event.
  }
}

function serialise(record: DiagnosticRecord): string {
  try {
    return JSON.stringify(record, (_key, value) => (value instanceof Error
      ? `${value.name}: ${value.message}`
      : value));
  } catch {
    return JSON.stringify({ seq: record.seq, at: record.at, event: record.event, data: { unserialisable: true } });
  }
}

function safeJson(data: Record<string, unknown>): string {
  try {
    return JSON.stringify(data);
  } catch {
    return '{"unserialisable":true}';
  }
}

// The trail's first event, written as soon as this module is evaluated: it says whether the
// native sink was found, and how. An empty log with this line missing means nothing is calling
// `trace()`; this line present with `source` other than `expo.modules`/`NativeModules` means the
// module did not bind.
trace('diagnostics.init', { source: binding.source });
