/**
 * Rule P7 — grading, and what is deliberately NOT here.
 *
 * There is no agree affordance. No thumbs-up, no "looks right", no star. A
 * correct outcome needs no feedback, and soliciting praise pollutes a corpus
 * that is already a biased failure sample: the verdicts that reach the oracle
 * are overwhelmingly the ones somebody was annoyed enough to file. Adding an
 * easy positive button does not fix that bias, it inverts it.
 *
 * The options are mutually exclusive and collectively exhaustive over the
 * failure space, and they come from VERDICT_OPTIONS in the token package rather
 * than being written inline — one declaration, so the checker can read the set
 * and the surface cannot quietly grow a seventh option.
 *
 * The option set depends on the RENDERED VERDICT: challenging a reach and
 * challenging a non-reach are different acts with different failure spaces.
 */

import { VERDICT_OPTIONS } from "@avigopal/design-tokens";
import { useId, useState, type ReactNode } from "react";
import { useSubmitGrade } from "../api/queries";
import type { OracleVerdict } from "../api/types";

/**
 * Which corpus verdict each option means.
 *
 * Every option under a `reached` run disputes the reach, so all of them map to
 * `not_achieved`. Under a `not-reached` run, only "It actually worked" claims
 * the opposite. The option text travels verbatim in `notes`, so the corpus
 * keeps the granularity the mapping collapses.
 */
function verdictFor(renderedState: "reached" | "not-reached", option: string): OracleVerdict {
  if (renderedState === "reached") return "not_achieved";
  return option === "It actually worked" ? "achieved" : "not_achieved";
}

export function GradeGesture({
  renderedState,
  executionId,
  goal,
  alreadyGraded,
  humanReachNotes,
}: {
  renderedState: "reached" | "not-reached";
  /** ABSENT when goal-host never recorded one — the key is not serialized. */
  executionId: string | undefined;
  goal: string;
  alreadyGraded: boolean;
  humanReachNotes: string | null;
}): ReactNode {
  const groupId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const grade = useSubmitGrade();
  const options = VERDICT_OPTIONS[renderedState];

  if (alreadyGraded) {
    return (
      <div className="sf-grade">
        <p className="sf-note">Graded{humanReachNotes ? `: “${humanReachNotes}”` : ""}</p>
      </div>
    );
  }

  // The write is keyed on execution id, and that key is one of the fields
  // goal-host serializes without a null coalesce — so it is ABSENT, not null,
  // when it was never recorded. A grade button that posts an undefined key
  // would fail silently at the far end; saying so is the honest rendering.
  if (!executionId) {
    return (
      <div className="sf-grade">
        <p className="sf-note sf-muted">No execution id — cannot be graded</p>
      </div>
    );
  }

  return (
    <div className="sf-grade">
      <fieldset className="sf-grade-options">
        <legend className="sf-label">
          Disagree with the verdict?
        </legend>
        {options.map((option) => (
          <label className="sf-grade-option" key={option}>
            <input
              type="radio"
              name={groupId}
              value={option}
              checked={selected === option}
              onChange={() => setSelected(option)}
            />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>

      <label className="sf-label" htmlFor={`${groupId}-note`}>
        Note
      </label>
      <textarea
        id={`${groupId}-note`}
        className="sf-textarea"
        style={{ minHeight: "3.5rem", fontSize: "var(--sf-text-base)" }}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div style={{ marginTop: "var(--sf-space-2)" }}>
        <button
          type="button"
          className="sf-button sf-button-primary"
          disabled={selected === null || grade.isPending}
          onClick={() => {
            if (!selected) return;
            grade.mutate({
              executionId,
              goal,
              verdict: verdictFor(renderedState, selected),
              notes: note.trim() ? `${selected} — ${note.trim()}` : selected,
            });
          }}
        >
          {grade.isPending ? "Recording…" : "Record"}
        </button>
      </div>

      {/* No optimistic green. If the write did not land, it did not land. */}
      {grade.isError ? (
        <p className="sf-error">Not recorded: {(grade.error as Error).message}</p>
      ) : null}
      {grade.isSuccess ? (
        <p className="sf-ok">Recorded</p>
      ) : null}
    </div>
  );
}
