/**
 * LESSON — one box, and what happens the moment you use it.
 *
 * A human sends a lesson (a goal, in the substrate's own vocabulary) in plain
 * language. This surface does not ask anyone to pre-decompose a request, name a
 * target shape, or speak the system's internal vocabulary: if a lesson only
 * works after somebody rewrites it with file paths and expected shapes, that
 * rewriting is a gap in the system, not a workflow to institutionalise here.
 *
 * The run contract appears ON SUBMIT, not before — it describes the walk that
 * was just accepted, and it carries a duration BAND rather than an estimate and
 * no confidence number at all.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDispatchGoal, useFleetShapes } from "../api/queries";
import type { DispatchOutcome } from "../api/types";
import { buildContract, type RunContract } from "../lib/contract";
import { inferTargetShapes } from "../lib/starters";
import { formatDurationBand } from "../lib/time";
import { DbLessonTemplates } from "./DbLessonTemplates";
import { StarterChips } from "./StarterChips";

function ContractPanel({ contract, goal }: { contract: RunContract; goal: string }): ReactNode {
  return (
    <div className="sf-contract">
      <dl>
        <dt>What this is</dt>
        <dd>{contract.klass}</dd>

        <dt>Aiming at</dt>
        <dd>
          {contract.targetShapes.length > 0 ? (
            <>
              {contract.targetShapes.map((shape, i) => (
                <span key={shape}>
                  {i > 0 ? ", " : ""}
                  <span className="sf-mono">{shape}</span>
                </span>
              ))}{" "}
              <span className="sf-muted">
                — inferred from your wording against the live vocabulary. The walk decides for
                itself; this is what it looks like it is heading for.
              </span>
            </>
          ) : (
            <span className="sf-muted">
              Nothing in your wording matched a known shape name. The walk will infer its own
              targets — this is not a problem, only something this surface cannot preview.
            </span>
          )}
        </dd>

        <dt>How long</dt>
        <dd>
          {formatDurationBand(contract.lowSec, contract.highSec)}
          <br />
          <span className="sf-muted">{contract.bandBasis}.</span>
        </dd>

        <dt>It will ask you about</dt>
        <dd>
          <ul style={{ margin: 0, paddingLeft: "var(--sf-space-5)" }}>
            {contract.willAskAbout.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </dd>

        <dt>What was sent</dt>
        <dd className="sf-mono sf-muted">{goal}</dd>
      </dl>
    </div>
  );
}

function OutcomeNote({
  outcome,
  onSuggest,
}: {
  outcome: DispatchOutcome;
  /** P2: puts the text in the box. It must not be able to send. */
  onSuggest: (text: string) => void;
}): ReactNode {
  switch (outcome.kind) {
    case "reshaped":
      // Say plainly that NOTHING was dispatched. The reader is watching a runs
      // board; if this read like an acceptance they would wait for a row that
      // is never coming.
      return (
        // A DIV, not a P. This block carries lists, and a <ul> inside a <p> is
        // auto-closed by the parser — the browser silently ends the paragraph
        // before the list and reparents everything after it, so the outcome note
        // loses its own styling exactly when it has the most to say.
        <div className="sf-outcome" role="status">
          This changed the interface itself — nothing was dispatched and no run will appear below.
          {outcome.revision >= 0 ? ` Render policy is now revision ${outcome.revision}.` : ""}
          <ul className="sf-outcome-changes">
            {outcome.changes.map((c) => (
              <li key={`${c.field}-${c.to}`}>
                <b>{c.field}</b>: {c.from} → {c.to}
                {c.because ? <span className="sf-outcome-because"> · from “{c.because}”</span> : null}
              </li>
            ))}
          </ul>
          {outcome.unparsed.length > 0 ? (
            <span className="sf-outcome-unparsed">
              Not understood, and therefore not applied. The rest was applied.
              <ul className="sf-outcome-unparsed-list">
                {outcome.unparsed.map((u) => (
                  <li key={u.text}>
                    “{u.text}”
                    {u.reason ? <span className="sf-outcome-because"> — {u.reason}</span> : null}
                    {u.suggestedGoal ? (
                      // P2: a suggestion INSERTS into the box. It never sends.
                      // The parser refusing a clause is not permission to guess
                      // what the person meant and dispatch it for them.
                      <button
                        type="button"
                        className="sf-button sf-button-quiet sf-outcome-suggest"
                        onClick={() => onSuggest(u.suggestedGoal)}
                      >
                        put “{u.suggestedGoal}” in the box
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </span>
          ) : null}
        </div>
      );
    case "accepted":
      return outcome.coalesced ? (
        <p className="sf-warn">
          Coalesced onto an existing run ({outcome.dispatchId}). This is an OLDER dispatch that was
          already in flight for the same goal — you did not create it, and it may already be part
          way through. What it produces will answer someone else's ask as much as yours.
        </p>
      ) : (
        <p className="sf-ok">
          Accepted as {outcome.dispatchId}. Accepted means the walk was received — not that anything
          has happened yet. The board says what it actually does.
        </p>
      );
    case "refused":
      return (
        <p className="sf-error">
          Refused before anything ran{outcome.dispatchId ? ` (${outcome.dispatchId})` : ""}.{" "}
          {outcome.reason ?? "No reason was given."} Nothing was dispatched and nothing will appear
          on the board.
        </p>
      );
    case "draining":
      return (
        <p className="sf-warn">
          The dispatcher is draining and did not take this: {outcome.message}. It is shutting down
          or restarting — retry shortly. Your goal was not queued.
        </p>
      );
    case "rejected":
    default:
      return (
        <p className="sf-error">
          Not dispatched: {outcome.message}. Nothing ran.
        </p>
      );
  }
}

export function AskRegion({
  onDispatched,
  initialGoal,
}: {
  onDispatched: (dispatchId: string) => void;
  /** From the Trace/Log page's "Teach a correction" link — pre-fills, never pre-sends (P2). */
  initialGoal?: string;
}): ReactNode {
  const [goal, setGoal] = useState(initialGoal ?? "");
  const [contract, setContract] = useState<{ contract: RunContract; goal: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shapes = useFleetShapes();
  const dispatch = useDispatchGoal();

  // A correction link navigates to an ALREADY-MOUNTED Lessons page (the
  // reader is one click from Trace back to Lessons, so this component does
  // not remount) — `useState`'s initial value alone would miss that arrival.
  // Focus follows it, same as a starter chip's `insert()` does, so the
  // reader lands with the cursor ready to edit the correction, not just read it.
  useEffect(() => {
    if (!initialGoal) return;
    setGoal(initialGoal);
    const el = textareaRef.current;
    if (el) {
      el.focus();
      window.requestAnimationFrame(() => {
        el.selectionStart = el.value.length;
        el.selectionEnd = el.value.length;
      });
    }
  }, [initialGoal]);

  /** P2: insert and focus. This function cannot dispatch — nothing here can. */
  const insert = (text: string): void => {
    setGoal((current) => (current.trim().length === 0 ? text : `${current.trimEnd()} ${text}`));
    const el = textareaRef.current;
    if (el) {
      el.focus();
      // Cursor at the end, so finishing the sentence is the obvious next act.
      window.requestAnimationFrame(() => {
        el.selectionStart = el.value.length;
        el.selectionEnd = el.value.length;
      });
    }
  };

  /**
   * P2 again, but REPLACING rather than appending.
   *
   * `insert` appends, which is right for a starter chip building up a sentence.
   * It is wrong here: the box still holds the instruction whose clause was just
   * refused (submit does not clear it), so appending would produce the refused
   * words followed by the goal that replaces them. Taking the suggestion means
   * switching from steering the surface to asking for work, so the old text goes.
   * This still cannot dispatch — nothing in this component can.
   */
  const replaceWith = (text: string): void => {
    setGoal(text);
    const el = textareaRef.current;
    if (el) {
      el.focus();
      window.requestAnimationFrame(() => {
        el.selectionStart = el.value.length;
        el.selectionEnd = el.value.length;
      });
    }
  };

  const submit = (): void => {
    const text = goal.trim();
    if (text.length === 0) return;
    const inferred = inferTargetShapes(text, shapes.data?.shapes ?? []);
    setContract({ contract: buildContract(text, inferred), goal: text });
    dispatch.mutate(
      { goal: text, operator: "training-dojo", tags: ["surface:dojo-lesson"] },
      {
        onSuccess: (outcome) => {
          // The contract describes A WALK THAT WILL RUN. It is built optimistically
          // on submit, because the reader deserves to see it before the wait — but
          // only ACCEPTED means a walk actually runs. On every other outcome it is
          // withdrawn, or the surface would show "what will happen" beside "nothing
          // was dispatched" and contradict itself in one frame. That is the exact
          // failure this surface exists to prevent, so it must not commit it.
          if (outcome.kind !== "accepted") setContract(null);
          // ACCEPTED navigates to the trace/log page — the deliberate divergence
          // from the base "do-anything" surface (where the board stays put and the
          // row arrives live). The whole point of a lesson is watching the agent
          // think and act, so submitting one takes the reader straight to it rather
          // than leaving them to spot the new row and click it themselves.
          //
          // REFUSED also navigates: it is the one outcome with nothing else to
          // select, since a refusal "reshaped" or otherwise produces no board row
          // (see OutcomeNote: "nothing will appear on the board"), so its own page
          // is the only place a reader can see anything about it at all.
          if ((outcome.kind === "accepted" || outcome.kind === "refused") && outcome.dispatchId) {
            onDispatched(outcome.dispatchId);
          }
        },
      },
    );
  };

  return (
    <section className="sf-region" aria-labelledby="sf-ask-title">
      <div className="sf-region-head">
        <h2 className="sf-region-title" id="sf-ask-title">
          Give a lesson
        </h2>
      </div>
      <div className="sf-region-body">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="sf-goal" className="sf-visually-hidden">
            What's today's lesson?
          </label>
          <textarea
            id="sf-goal"
            ref={textareaRef}
            className="sf-textarea"
            placeholder="What's today's lesson?"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sf-space-3)",
              marginTop: "var(--sf-space-3)",
            }}
          >
            <button
              type="submit"
              className="sf-button sf-button-primary"
              disabled={goal.trim().length === 0 || dispatch.isPending}
            >
              {dispatch.isPending ? "Teaching…" : "Teach"}
            </button>
            <span className="sf-note sf-muted">⌘/Ctrl + Enter</span>
            {contract ? (
              <button
                type="button"
                className="sf-button sf-button-quiet"
                onClick={() => {
                  setContract(null);
                  dispatch.reset();
                }}
              >
                dismiss the contract
              </button>
            ) : null}
          </div>
        </form>

        <DbLessonTemplates onInsert={insert} />
        <StarterChips onInsert={insert} />

        {dispatch.isError ? (
          <p className="sf-error">
            The dispatch never left this surface: {(dispatch.error as Error).message}. Nothing ran.
          </p>
        ) : null}
        {dispatch.data ? <OutcomeNote outcome={dispatch.data} onSuggest={replaceWith} /> : null}
        {contract ? <ContractPanel contract={contract.contract} goal={contract.goal} /> : null}
      </div>
    </section>
  );
}
