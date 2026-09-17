/**
 * "Clear lesson history" — a LOCAL view filter, not a delete.
 *
 * The board shows every dispatch the fleet has seen, not just this reader's
 * own — that's what "it tends to get overwhelmed" is: on a busy substrate the
 * list is mostly other work. Real dispatch history belongs to the substrate's
 * trace store and must not be touched from a browser tab; what this clears is
 * only this browser's OWN opinion of "how far back do I want to see", stored
 * in `localStorage` so it survives a reload the way a deliberate choice
 * should, and always reversible — "clear" moves the cutoff forward, it never
 * deletes the cutoff itself, so "show everything again" is always one click
 * away.
 */

const STORAGE_KEY = "dojo.historyClearedBeforeMs.v1";

export function getHistoryClearedBeforeMs(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Hide every run whose start predates now. Returns the cutoff it set. */
export function clearHistoryBeforeNow(): number {
  const now = Date.now();
  try {
    window.localStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    /* storage unavailable — the clear just won't persist across a reload */
  }
  return now;
}

export function showAllHistory(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clean up if storage was never reachable */
  }
}
