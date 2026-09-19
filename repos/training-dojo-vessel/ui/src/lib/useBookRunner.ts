/**
 * The lessonbook runner — "Run all" / "Start reading" and the per-step
 * "Send" button share this one state machine.
 *
 * There is no server-side orchestrator. A step's prompt goes out through the
 * exact same `useDispatchGoal` this whole surface already uses (so it still
 * gets shape-vocabulary attribution, same as any other lesson), this hook
 * polls that one dispatch's `goalWalkState` via `useWalk`, and only on a
 * TERMINAL state does it record the outcome and — if running the whole book —
 * advance. Advancing requires `reached === true`, not merely a terminal
 * status: a hollow `completed` must stop the run exactly as a `failed` would,
 * or a harder step would be taught on top of a simpler one that never
 * actually landed.
 *
 * "Run all" resumes rather than restarts: it starts from the first step whose
 * `passed !== true`, so re-opening a book mid-curriculum or retrying after a
 * stop never re-sends prompts that already passed. `passed` — not the raw
 * `reached` — is what "advance" means everywhere in this file: for every
 * ordinary step they're the same value, but a `redteam` step's grading is
 * inverted server-side (the substrate refusing IS the pass), and this hook
 * has to advance on the same criterion the server just computed or a
 * resisted attack would look like a stop.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { recordBookStepRun, resetBookStepRun } from "../api/client";
import { queryKeys, useDispatchGoal, useWalk } from "../api/queries";
import { useQueryClient } from "@tanstack/react-query";
import type { Book, BookStep } from "../api/types";

export interface BookRunnerState {
  /** The step currently dispatched and being polled, if any. */
  readonly activeStepId: string | null;
  /** True only while a "Run all" sequence is advancing on its own. */
  readonly isRunningAll: boolean;
  /** Set the moment a run-all sequence stops on a step that did not reach. */
  readonly stoppedOnStepId: string | null;
  readonly dispatchError: string | null;
}

export function useBookRunner(book: Book | undefined): BookRunnerState & {
  readonly startRunAll: () => void;
  readonly stop: () => void;
  readonly sendStep: (step: BookStep) => void;
  readonly retryUnit: (testStep: BookStep) => void;
} {
  const client = useQueryClient();
  const dispatch = useDispatchGoal();

  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [activeDispatchId, setActiveDispatchId] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [stoppedOnStepId, setStoppedOnStepId] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // Refs mirror the state above for use inside the walk-effect's closure,
  // which must always act on the LATEST intent (did the reader press Stop
  // between polls?) rather than whatever was true when the effect was set up.
  const runningAllRef = useRef(false);
  const bookRef = useRef<Book | undefined>(book);
  bookRef.current = book;

  const walk = useWalk(activeDispatchId, { enabled: activeDispatchId !== null, intervalMs: 2000 });

  const invalidate = useCallback(() => {
    if (!book) return;
    void client.invalidateQueries({ queryKey: queryKeys.book(book.id) });
    void client.invalidateQueries({ queryKey: queryKeys.books });
  }, [client, book]);

  const dispatchStep = useCallback(
    (step: BookStep) => {
      setDispatchError(null);
      setActiveStepId(step.id);
      dispatch.mutate(
        {
          goal: step.prompt,
          operator: "training-dojo-lessonbook",
          tags: ["lessonbook", step.bookId],
          // A curriculum step is authored content, never a person steering
          // this surface — see the note on `dispatchGoal` for why the
          // ask-box's own default (checking first) is wrong here.
          checkSurfaceIntent: false,
        },
        {
          onSuccess: (outcome) => {
            if (outcome.kind === "accepted") {
              setActiveDispatchId(outcome.dispatchId);
              return;
            }
            // Every other outcome means nothing is running to poll — a refusal, a
            // reshape, a drain, a rejection. Record it as failed so the book's own
            // history is honest about it, and stop rather than silently stall.
            const message =
              outcome.kind === "refused"
                ? (outcome.reason ?? "refused")
                : outcome.kind === "rejected"
                  ? outcome.message
                  : outcome.kind === "draining"
                    ? outcome.message
                    : "the surface reshaped this instead of sending it";
            setDispatchError(message);
            setActiveStepId(null);
            setIsRunningAll(false);
            runningAllRef.current = false;
            setStoppedOnStepId(step.id);
          },
          onError: (err) => {
            setDispatchError(err instanceof Error ? err.message : String(err));
            setActiveStepId(null);
            setIsRunningAll(false);
            runningAllRef.current = false;
            setStoppedOnStepId(step.id);
          },
        },
      );
    },
    [dispatch],
  );

  const sendStep = useCallback(
    (step: BookStep) => {
      setIsRunningAll(false);
      runningAllRef.current = false;
      setStoppedOnStepId(null);
      dispatchStep(step);
    },
    [dispatchStep],
  );

  const startRunAll = useCallback(() => {
    const current = bookRef.current;
    if (!current) return;
    const next = current.steps.find((s) => s.passed !== true);
    if (!next) return;
    setStoppedOnStepId(null);
    setIsRunningAll(true);
    runningAllRef.current = true;
    dispatchStep(next);
  }, [dispatchStep]);

  const stop = useCallback(() => {
    setIsRunningAll(false);
    runningAllRef.current = false;
  }, []);

  /**
   * A test's own sublessons are inserted BEFORE it (see `addStep`'s
   * `beforeStepId`) specifically so this works by resetting only the test:
   * "Run all" resumes from the first not-reached step, which is now whatever
   * fresh sublesson sits right before this test, then the test itself —
   * "more examples, then try again" falls out of the ordering rather than
   * needing its own traversal here.
   */
  const retryUnit = useCallback(
    (testStep: BookStep) => {
      setStoppedOnStepId(null);
      // `startRunAll` only needs `reached !== true`, which this step's stale
      // cached state already satisfies (it failed) — the reset itself is
      // about clearing the old dispatch/status for display, not a
      // precondition for resuming, so it does not need to be awaited first.
      void resetBookStepRun(testStep.id).then(invalidate);
      startRunAll();
    },
    [invalidate, startRunAll],
  );

  // Handled-once guard: `walk.data` keeps returning the SAME terminal object on
  // every poll until `activeDispatchId` is cleared below, and clearing it is
  // itself a state update that lands on a later render — without this ref the
  // effect body would run again on that in-between render and try to advance
  // twice for one terminal outcome.
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const w = walk.data;
    if (!w || !activeStepId) return;
    if (w.status === "running") return;
    if (handledRef.current === w.dispatchId) return;
    handledRef.current = w.dispatchId;

    const finishedStepId = activeStepId;
    void recordBookStepRun(finishedStepId, {
      dispatchId: w.dispatchId,
      status: w.status,
      reached: w.reached,
      reason: w.goalReachReason,
    })
      .then((updated) => {
        invalidate();
        setActiveStepId(null);
        setActiveDispatchId(null);

        const passed = updated.passed === true;
        if (runningAllRef.current && passed) {
          const current = bookRef.current;
          const next = current?.steps.find((s) => s.id !== finishedStepId && s.passed !== true);
          if (next) {
            dispatchStep(next);
            return;
          }
        }
        // Either the book is done, or this step did not pass — either way a
        // run-all sequence stops here, and the reader can see exactly which step.
        if (runningAllRef.current && !passed) setStoppedOnStepId(finishedStepId);
        runningAllRef.current = false;
        setIsRunningAll(false);
      })
      .catch(() => {
        invalidate();
        setActiveStepId(null);
        setActiveDispatchId(null);
        setStoppedOnStepId(finishedStepId);
        runningAllRef.current = false;
        setIsRunningAll(false);
      });
  }, [walk.data, activeStepId, dispatchStep, invalidate]);

  return { activeStepId, isRunningAll, stoppedOnStepId, dispatchError, startRunAll, stop, sendStep, retryUnit };
}
