import type { GlobalDisasterEvent } from './normalizer';

// ─── Delta Types ────────────────────────────────────────────────────────────

export interface DeltaSignal {
  id: string;
  title: string;
  severity: string;
  source: string;
  type: 'new' | 'removed' | 'escalated' | 'deescalated';
  /** Previous severity (for escalation/de-escalation) */
  from?: string;
  /** New severity (for escalation/de-escalation) */
  to?: string;
}

export interface DeltaResult {
  timestamp: string;
  previousTimestamp: string | null;
  signals: DeltaSignal[];
  summary: {
    totalChanges: number;
    newEvents: number;
    removedEvents: number;
    escalated: number;
    deescalated: number;
  };
}

// ─── Severity Ordering (for escalation detection) ───────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
  unknown: 0,
  minor: 1,
  moderate: 2,
  major: 3,
  critical: 4,
};

// ─── Delta Engine ───────────────────────────────────────────────────────────

/**
 * Computes the delta between the current event set and the previous one.
 * Detects new events, removed events, and severity escalations/de-escalations.
 */
export function computeDelta(
  current: GlobalDisasterEvent[],
  previous: GlobalDisasterEvent[],
  previousTimestamp: string | null,
): DeltaResult {
  const signals: DeltaSignal[] = [];

  // Build lookup maps by ID
  const prevMap = new Map(previous.map(e => [e.id, e]));
  const currMap = new Map(current.map(e => [e.id, e]));

  // Detect NEW events (in current but not in previous)
  for (const [id, event] of currMap) {
    const prev = prevMap.get(id);
    if (!prev) {
      signals.push({
        id: event.id,
        title: event.title,
        severity: event.severity,
        source: event.source,
        type: 'new',
      });
    } else {
      // Check for severity changes
      const prevLevel = SEVERITY_ORDER[prev.severity] ?? 0;
      const currLevel = SEVERITY_ORDER[event.severity] ?? 0;

      if (currLevel > prevLevel) {
        signals.push({
          id: event.id,
          title: event.title,
          severity: event.severity,
          source: event.source,
          type: 'escalated',
          from: prev.severity,
          to: event.severity,
        });
      } else if (currLevel < prevLevel) {
        signals.push({
          id: event.id,
          title: event.title,
          severity: event.severity,
          source: event.source,
          type: 'deescalated',
          from: prev.severity,
          to: event.severity,
        });
      }
    }
  }

  // Detect REMOVED events (in previous but not in current)
  for (const [id, event] of prevMap) {
    if (!currMap.has(id)) {
      signals.push({
        id: event.id,
        title: event.title,
        severity: event.severity,
        source: event.source,
        type: 'removed',
      });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    previousTimestamp,
    signals,
    summary: {
      totalChanges: signals.length,
      newEvents: signals.filter(s => s.type === 'new').length,
      removedEvents: signals.filter(s => s.type === 'removed').length,
      escalated: signals.filter(s => s.type === 'escalated').length,
      deescalated: signals.filter(s => s.type === 'deescalated').length,
    },
  };
}
