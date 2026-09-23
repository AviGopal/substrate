/**
 * The RUNS board.
 *
 * Fixed height, from `--sf-live-region-height`. It does not grow with its
 * contents, so nothing on the page below it moves when a run arrives.
 *
 * Three rules meet here:
 *
 *  P3 — arrivals that would land ABOVE the reader's viewport are buffered
 *       behind a count they accept, never spliced in. A row sliding out from
 *       under a moving hand is the attested failure this region was rebuilt to
 *       fix: a run left the board the instant it settled, which is exactly when
 *       it became worth reading.
 *  P5 — the sort key is fixed for a run's lifetime, so an existing row never
 *       moves; only insertions can disturb the layout, and P3 governs those.
 *  P6 — pause and interval controls, plus freeze-on-interaction implemented as
 *       the query's `enabled` flag so state is HELD rather than discarded.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useBoard } from "../api/queries";
import type { ActiveDispatch } from "../api/types";
import { clearHistoryBeforeNow, getHistoryClearedBeforeMs, showAllHistory } from "../lib/historyClear";
import { sortRuns } from "../lib/sort";
import { parseStartedAt } from "../lib/time";
import { useNow } from "../lib/useNow";
import { useLiveControls, useRegionFreeze } from "../state/liveControls";
import { LiveControls } from "./LiveControls";
import { RunRow } from "./RunRow";

/** How many in-flight rows may hold their own walk query. */
const LIVE_DETAIL_BUDGET = 6;

interface Positioned {
  readonly row: ActiveDispatch;
  readonly dispatchId: string;
  readonly startedAtMs: number;
}

function position(rows: readonly ActiveDispatch[], fallback: number): readonly Positioned[] {
  return rows.map((row) => ({
    row,
    dispatchId: row.dispatchId,
    startedAtMs: parseStartedAt(row.startedAt, fallback),
  }));
}

export function RunsRegion({
  selectedDispatchId,
  onSelect,
}: {
  selectedDispatchId: string | null;
  onSelect: (dispatchId: string) => void;
}): ReactNode {
  const { paused, intervalMs } = useLiveControls();
  const { frozen, handlers } = useRegionFreeze();
  const live = !paused && !frozen;
  const now = useNow(paused);

  const board = useBoard({ enabled: live, intervalMs });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [committed, setCommitted] = useState<readonly Positioned[]>([]);
  const [buffered, setBuffered] = useState<readonly Positioned[]>([]);

  /**
   * "Mine" means `operator === "training-dojo"` — every goal this component
   * dispatches (see `AskRegion`'s `dispatch.mutate`) carries that operator
   * value. It is a proxy, not an identity: any training-dojo-vessel anywhere
   * in the fleet asking on someone else's behalf reads as "mine" too, because
   * `operator` does not carry a per-person id. Said plainly in the toggle
   * label rather than implied, so it cannot be read as more than it is.
   *
   * Filtering happens at RENDER time only — `committed`/`buffered` above stay
   * full accounts of everything this region has seen, so flipping the toggle
   * is instant and lossless (rule P6's "state is HELD, not discarded" applies
   * to this filter exactly as it does to pause).
   */
  const [mineOnly, setMineOnly] = useState(false);
  const isMine = useCallback((p: Positioned): boolean => p.row.operator === "training-dojo", []);

  /**
   * Free-text filter over the goal itself, e.g. "normalization" to find every
   * past attempt at teaching it, win or lose, without hunting through the
   * whole history by eye. Render-time only, same as `mineOnly` above — the
   * underlying `committed`/`buffered` account stays complete regardless of
   * what the reader is currently searching for.
   */
  const [search, setSearch] = useState("");
  const searchNeedle = search.trim().toLowerCase();
  const matchesSearch = useCallback(
    (p: Positioned): boolean => searchNeedle.length === 0 || (p.row.goal ?? "").toLowerCase().includes(searchNeedle),
    [searchNeedle],
  );

  /**
   * "Clear lesson history" — a render-time cutoff, same footing as
   * `mineOnly`/`search` above: `committed`/`buffered` stay the full account,
   * only what reaches the screen is filtered, and lifting the cutoff via
   * "Show all history" is instant and lossless. See `lib/historyClear.ts` —
   * this never touches the substrate's own trace store, only this browser's
   * opinion of how far back to look.
   */
  const [clearedBeforeMs, setClearedBeforeMs] = useState<number | null>(() => getHistoryClearedBeforeMs());
  const isAfterClear = useCallback(
    (p: Positioned): boolean => clearedBeforeMs === null || p.startedAtMs >= clearedBeforeMs,
    [clearedBeforeMs],
  );
  const handleClearHistory = useCallback(() => {
    setClearedBeforeMs(clearHistoryBeforeNow());
  }, []);
  const handleShowAllHistory = useCallback(() => {
    showAllHistory();
    setClearedBeforeMs(null);
  }, []);

  /**
   * The roving tab stop, held as a DISPATCH ID rather than as an index.
   *
   * Same reasoning as the P4 key: committing the buffer inserts rows at the
   * top, and an index would silently hand the tab stop to a different run —
   * the reader would arrow away from where they thought they were.
   */
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const data = board.data;
  /** Every dispatch id this region has ever accounted for, committed or buffered. */
  const knownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!data) return;
    const incoming = position(data, Date.now());
    const incomingById = new Map(incoming.map((p) => [p.dispatchId, p]));

    // The reader is at the top and not interacting: an arrival lands at the top
    // of the viewport where they can see it, which is the live-tail behaviour a
    // board at rest should have. Anywhere else, buffer — an insertion above the
    // viewport pushes everything the reader is looking at downward.
    const atTop = (scrollRef.current?.scrollTop ?? 0) <= 0;
    const acceptsArrivals = atTop && !frozen && !paused;

    const arrivals = incoming.filter((p) => !knownRef.current.has(p.dispatchId));

    setCommitted((prev) => {
      // Existing rows: refresh their DATA in place, but PIN the sort key to
      // what it was at first observation.
      //
      // This is the P5 failure the spec warns a parser cannot see: the
      // comparator is clean, and it can still be fed a value that changes. A
      // row whose `startedAt` arrived null gets a synthetic fallback of
      // `Date.now()`, and taking the incoming entry wholesale would restamp
      // that fallback on EVERY poll — so the row would drift around the board
      // every couple of seconds for no reason a reader could ever explain.
      // Pinning at first observation makes the key immutable in fact, not just
      // in intent.
      const refreshed = prev
        .map((p) => {
          const next = incomingById.get(p.dispatchId);
          return next ? { ...next, startedAtMs: p.startedAtMs } : p;
        })
        // A row that has fallen off the 50-run board is dropped only when the
        // reader is not in the middle of using the region, and never when it is
        // the run they have open.
        .filter(
          (p) =>
            incomingById.has(p.dispatchId) ||
            p.dispatchId === selectedDispatchId ||
            frozen ||
            !atTop,
        );
      return acceptsArrivals && arrivals.length > 0
        ? sortRuns([...refreshed, ...arrivals])
        : sortRuns(refreshed);
    });

    if (!acceptsArrivals && arrivals.length > 0) {
      setBuffered((prev) => {
        const seen = new Set(prev.map((p) => p.dispatchId));
        const fresh = arrivals.filter((p) => !seen.has(p.dispatchId));
        return fresh.length === 0 ? prev : sortRuns([...prev, ...fresh]);
      });
    }

    for (const p of arrivals) knownRef.current.add(p.dispatchId);
  }, [data, frozen, paused, selectedDispatchId]);

  // The rendered subset. `committed`/`buffered` above stay the full account —
  // everything below this line reads ONLY what the current filter allows on
  // screen, so a filtered-out row that is still `selected` (open in DETAIL)
  // stays reachable by its own URL even though this toggle hid it from the list.
  const applyFilters = useCallback(
    (rows: readonly Positioned[]): readonly Positioned[] =>
      rows.filter((p) => (!mineOnly || isMine(p)) && matchesSearch(p) && isAfterClear(p)),
    [mineOnly, isMine, matchesSearch, isAfterClear],
  );
  const visibleCommitted = applyFilters(committed);
  const visibleBuffered = applyFilters(buffered);

  /**
   * The reader ASKED for the arrivals, so this is the one place the board may
   * move: it commits the buffer and takes them to the top. An explicit gesture,
   * not an ambush.
   *
   * Commits the WHOLE buffer, not just the visible slice — accepting is about
   * the underlying account catching up, not about the filter. A reader who
   * un-mines the toggle right after must see the runs they just accepted.
   */
  const acceptBuffered = useCallback(() => {
    setCommitted((prev) => {
      const known = new Set(prev.map((p) => p.dispatchId));
      const fresh = buffered.filter((p) => !known.has(p.dispatchId));
      return sortRuns([...prev, ...fresh]);
    });
    setBuffered([]);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [buffered]);

  /**
   * Arrow-key traversal within the list.
   *
   * Before this, the list was 50 consecutive tab stops that a keyboard reader
   * could not get past, and every stop scrolled the fixed-height window — so
   * the act of moving toward a target moved the target. One tab stop enters
   * the list; arrows move inside it; Tab leaves.
   */
  const onListKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
      if (!keys.includes(event.key)) return;
      if (visibleCommitted.length === 0) return;

      const currentId = focusedId ?? visibleCommitted[0]?.dispatchId ?? null;
      const at = visibleCommitted.findIndex((p) => p.dispatchId === currentId);
      // A row that fell off the board (or off the current filter) leaves the
      // tab stop at the top rather than at a position, which would be
      // somebody else's run.
      const from = at === -1 ? 0 : at;

      let next = from;
      if (event.key === "ArrowDown") next = Math.min(from + 1, visibleCommitted.length - 1);
      if (event.key === "ArrowUp") next = Math.max(from - 1, 0);
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = visibleCommitted.length - 1;

      const target = visibleCommitted[next];
      if (!target) return;
      event.preventDefault();
      setFocusedId(target.dispatchId);
      const el = scrollRef.current?.querySelector<HTMLElement>(
        `[data-dispatch-id="${CSS.escape(target.dispatchId)}"]`,
      );
      el?.focus();
      // `nearest` so a row already in view does not scroll the window under
      // the reader just because focus arrived on it.
      el?.scrollIntoView({ block: "nearest" });
    },
    [visibleCommitted, focusedId],
  );

  /**
   * The one row that holds the list's tab stop.
   *
   * The membership test is load-bearing: a run that has fallen off the 50-row
   * board leaves `focusedId` naming a row that no longer exists, and without
   * this every row would get `tabIndex={-1}` — a list no keyboard could enter
   * at all, which is a worse failure than the 50 stops this replaced.
   */
  const rovingId = visibleCommitted.some((p) => p.dispatchId === focusedId)
    ? focusedId
    : (visibleCommitted[0]?.dispatchId ?? null);

  /**
   * A poll that has failed, held until one succeeds. `isError` alone flaps
   * while a query cycles through `pending`, and a region that hides its own
   * outage one second in three is worse than one that never reported it.
   */
  const failed = board.isError || board.failureCount > 0;
  const errorMessage =
    board.error instanceof Error ? board.error.message : "the upstream did not answer";

  // Scoped to VISIBLE rows: a row the current filter hides never mounts a
  // `RunRow`, so spending live-query budget on it would poll for a display
  // that does not exist.
  const nonTerminalSeen = new Set<string>();
  for (const p of visibleCommitted) {
    if (p.row.status === "running" && nonTerminalSeen.size < LIVE_DETAIL_BUDGET) {
      nonTerminalSeen.add(p.dispatchId);
    }
  }

  return (
    <section className="sf-region" aria-labelledby="sf-runs-title" {...handlers}>
      <div className="sf-region-head">
        <h2 className="sf-region-title" id="sf-runs-title">
          Lesson history
        </h2>
        <input
          type="search"
          className="sf-input sf-search-input"
          placeholder="Search past lessons…"
          aria-label="Search past lessons by text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="sf-live-controls">
          <button
            type="button"
            className="sf-button"
            aria-pressed={mineOnly}
            title='Filter to operator="training-dojo" — every goal asked from this box carries that value. Not a per-person identity: another training-dojo-vessel elsewhere in the fleet reads as "mine" too.'
            onClick={() => setMineOnly((v) => !v)}
          >
            {mineOnly ? "Mine" : "Everything"}
          </button>
          <button
            type="button"
            className="sf-button"
            title="Hide every run started before now, in THIS browser only. The runs still exist in the fleet's own trace store — this never deletes anything, and Show all history undoes it instantly."
            onClick={handleClearHistory}
          >
            Clear
          </button>
        </div>
        <LiveControls frozen={frozen} regionName="runs" />
      </div>

      {clearedBeforeMs !== null ? (
        <p className="sf-note sf-muted" style={{ margin: "0", padding: "var(--sf-space-2) var(--sf-space-4)" }}>
          Showing only lessons started after {new Date(clearedBeforeMs).toLocaleTimeString()} — nothing was
          deleted, only hidden from this view.{" "}
          <button type="button" className="sf-button sf-button-quiet" onClick={handleShowAllHistory}>
            Show all history
          </button>
        </p>
      ) : null}

      <div className="sf-runs-viewport">
        {visibleBuffered.length > 0 ? (
          <button type="button" className="sf-new-pill" onClick={acceptBuffered}>
            ↑ {visibleBuffered.length} new — show {visibleBuffered.length === 1 ? "it" : "them"}
          </button>
        ) : null}

        <div
          className="sf-runs-scroll"
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={board.isFetching}
        aria-label="Dispatched runs, newest first"
        onKeyDown={onListKeyDown}
      >
        {/*
          * `failed`, not `isError`. A poll that is in flight toward a retry
          * momentarily reports neither error nor data, and rendering the
          * loading placeholder on that moment made the region alternate once
          * per second between its own honest failure banner and a neutral
          * "Reading the board…" — a measured L E E L E E over thirty seconds.
          * Once a poll has failed, the failure stands until one succeeds.
          */}
        {failed && committed.length === 0 ? (
          <p className="sf-error" role="status" style={{ margin: "var(--sf-space-4)" }}>
            The history could not be read: {errorMessage}. This is the surface failing, not the
            fleet being idle — nothing here says anything about what is running.
          </p>
        ) : null}

        {committed.length === 0 && !failed ? (
          <p className="sf-empty">
            {board.isLoading ? (
              "Reading the history…"
            ) : (
              <>
                <strong>No lesson has been taught yet.</strong>
                Give one in the box above and it lands here, verdict first — reached or not
                reached, never a status.
              </>
            )}
          </p>
        ) : null}

        {/* Distinct from the empty state above: there IS history, the current
            filter(s) are just hiding all of it. Reading this as "nothing has
            been taught" would be a lie the filter told, not the history. */}
        {committed.length > 0 && visibleCommitted.length === 0 && !failed ? (
          <p className="sf-empty">
            <strong>
              {committed.length} lesson{committed.length === 1 ? "" : "s"} in the history, none
              match the current filter.
            </strong>
            {mineOnly ? ' Switch to "Everything", or ' : " "}
            {searchNeedle.length > 0 ? "clear the search box" : "clear the filter above"}
            {clearedBeforeMs !== null ? (
              <>
                , or{" "}
                <button type="button" className="sf-button sf-button-quiet" onClick={handleShowAllHistory}>
                  show all history
                </button>
                .
              </>
            ) : (
              "."
            )}
          </p>
        ) : null}

        {visibleCommitted.map((p) => (
          // P4: keyed on the dispatch id. An index key here would rebind a row's
          // component state — its stall clock, its open state — to a POSITION,
          // so one arrival at the top would silently hand every row below it
          // somebody else's history.
          <RunRow
            key={p.dispatchId}
            row={p.row}
            startedAtMs={p.startedAtMs}
            now={now}
            selected={p.dispatchId === selectedDispatchId}
            liveDetail={nonTerminalSeen.has(p.dispatchId)}
            onSelect={onSelect}
            intervalMs={intervalMs}
            tabStop={p.dispatchId === rovingId}
            onFocused={setFocusedId}
          />
        ))}
        </div>
      </div>

      <div className="sf-region-head" style={{ borderTop: "1px solid var(--sf-rule)", borderBottom: "none" }}>
        <p className="sf-note" style={{ margin: 0 }}>
          The history carries at most 50 lessons. A verdict here is what the walk recorded — open
          a lesson to see what it actually produced.
        </p>
      </div>
    </section>
  );
}
