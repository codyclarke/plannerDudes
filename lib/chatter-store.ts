// Live message/unread counts per event, published by the Chatter section
// and read by the "💬 12 messages · 3 new" chip in the event header.

export type ChatterCounts = { total: number; unread: number };

const counts = new Map<string, ChatterCounts>();
const listeners = new Set<() => void>();

export function publishCounts(eventId: string, next: ChatterCounts) {
  const prev = counts.get(eventId);
  if (prev && prev.total === next.total && prev.unread === next.unread) return;
  counts.set(eventId, next);
  listeners.forEach((l) => l());
}

export function subscribeCounts(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export const getCounts = (eventId: string) => counts.get(eventId) ?? null;
