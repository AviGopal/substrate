/**
 * ONE BOOK, read step by step. Route `/lessonbook/$bookId`.
 *
 * "Start reading" / "Run all" dispatches the first not-yet-reached step,
 * waits for a REACH (not merely a terminal status — see `useBookRunner`), then
 * dispatches the next. A step's own "Send" runs it alone, same dispatch path,
 * without touching the sequence.
 *
 * Three kinds of row: 'lesson' (ordinary), 'test' (a review of the 5 lessons
 * before it — see `insertMissingTests` server-side), 'sublesson' (a remedial
 * example added because a specific test failed, indented under it). A failed
 * test gets two extra controls: "Add sublesson" (more worked examples, run
 * before the test is tried again) and "Retry unit" (which, because a new
 * sublesson is inserted BEFORE its test, just means resuming the run from
 * here — see `useBookRunner.retryUnit`).
 */
import { Link, useParams } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  useAddBookStep,
  useAddSublesson,
  useAddTestNote,
  useAutotestBook,
  useBook,
  useResetBookRuns,
  useTestNotes,
} from "../api/queries";
import { useBookRunner } from "../lib/useBookRunner";
import type { BookStep } from "../api/types";

function StepStatus({ step, isActive }: { step: BookStep; isActive: boolean }): ReactNode {
  if (isActive) return <span className="sf-book-step-status is-running">running…</span>;
  if (step.status === "pending") return <span className="sf-book-step-status is-pending">not run</span>;
  if (step.status === "running") return <span className="sf-book-step-status is-running">running…</span>;
  // `passed`, never raw `reached` — a redteam step that got refused has
  // reached:false but passed:true (it resisted), and showing "not reached"
  // for that would read backwards.
  if (step.passed === true) {
    return (
      <span className="sf-book-step-status is-reached">
        {step.kind === "redteam" ? "resisted" : "reached"}
      </span>
    );
  }
  return (
    <span className="sf-book-step-status is-not-reached">
      {step.kind === "redteam" ? "leaked" : "not reached"}
    </span>
  );
}

function KindLabel({ kind }: { kind: BookStep["kind"] }): ReactNode {
  if (kind === "test") return <span className="sf-book-step-kind is-test">unit test</span>;
  if (kind === "sublesson") return <span className="sf-book-step-kind">sublesson</span>;
  if (kind === "redteam") return <span className="sf-book-step-kind is-test">redteam</span>;
  return null;
}

const stepIsFailed = (step: BookStep): boolean =>
  (step.status === "completed" || step.status === "failed") && step.passed !== true;

function AddStepForm({ bookId }: { bookId: string }): ReactNode {
  const [prompt, setPrompt] = useState("");
  const add = useAddBookStep(bookId);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const p = prompt.trim();
    if (p.length === 0) return;
    add.mutate({ prompt: p }, { onSuccess: () => setPrompt("") });
  };

  return (
    <form onSubmit={submit} className="sf-book-add-step">
      <textarea
        className="sf-textarea"
        style={{ minHeight: "3rem" }}
        placeholder="Next prompt in the sequence…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button type="submit" className="sf-button" disabled={add.isPending || prompt.trim().length === 0}>
        {add.isPending ? "Adding…" : "Add step"}
      </button>
    </form>
  );
}

/** Toggled open per-row — "add a lesson in between" without leaving the list. */
function InsertLessonInline({ bookId, afterStepId }: { bookId: string; afterStepId: string }): ReactNode {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const add = useAddBookStep(bookId);

  if (!open) {
    return (
      <button type="button" className="sf-button sf-button-quiet" onClick={() => setOpen(true)}>
        + insert lesson after this
      </button>
    );
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const p = prompt.trim();
    if (p.length === 0) return;
    add.mutate({ prompt: p, afterStepId }, { onSuccess: () => setOpen(false) });
  };

  return (
    <form onSubmit={submit} className="sf-book-inline-form">
      <textarea
        className="sf-textarea"
        style={{ minHeight: "2.5rem" }}
        autoFocus
        placeholder="New lesson to insert right after this one…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div style={{ display: "flex", gap: "var(--sf-space-2)" }}>
        <button type="submit" className="sf-button" disabled={add.isPending || prompt.trim().length === 0}>
          {add.isPending ? "Inserting…" : "Insert"}
        </button>
        <button type="button" className="sf-button sf-button-quiet" onClick={() => setOpen(false)}>
          cancel
        </button>
      </div>
    </form>
  );
}

/** Only ever shown on a FAILED test row — the remediation half of the loop. */
function AddSublessonInline({ bookId, testStepId }: { bookId: string; testStepId: string }): ReactNode {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const add = useAddSublesson(bookId);

  if (!open) {
    return (
      <button type="button" className="sf-button sf-button-quiet" onClick={() => setOpen(true)}>
        + add sublesson (more examples)
      </button>
    );
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const p = prompt.trim();
    if (p.length === 0) return;
    add.mutate({ testStepId, prompt: p }, { onSuccess: () => setOpen(false) });
  };

  return (
    <form onSubmit={submit} className="sf-book-inline-form">
      <textarea
        className="sf-textarea"
        style={{ minHeight: "2.5rem" }}
        autoFocus
        placeholder="A worked example targeting what this test just showed it missed…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div style={{ display: "flex", gap: "var(--sf-space-2)" }}>
        <button type="submit" className="sf-button" disabled={add.isPending || prompt.trim().length === 0}>
          {add.isPending ? "Adding…" : "Add sublesson"}
        </button>
        <button type="button" className="sf-button sf-button-quiet" onClick={() => setOpen(false)}>
          cancel
        </button>
      </div>
    </form>
  );
}

/**
 * A reviewer's own qualitative read of a test's result — separate from the
 * mechanical reached/not-reached verdict above it, and fetched only once this
 * is opened (same "don't preload" posture as Table Explorer's rows).
 */
function TestNotesInline({ stepId }: { stepId: string }): ReactNode {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const notes = useTestNotes(stepId, open);
  const add = useAddTestNote(stepId);

  if (!open) {
    return (
      <button type="button" className="sf-button sf-button-quiet" onClick={() => setOpen(true)}>
        test notes
      </button>
    );
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const t = text.trim();
    if (t.length === 0) return;
    add.mutate({ note: t }, { onSuccess: () => setText("") });
  };

  return (
    <div className="sf-book-inline-form">
      {notes.isLoading ? <p className="sf-note sf-muted">Reading notes…</p> : null}
      {notes.data && notes.data.length > 0 ? (
        <ul className="sf-test-notes">
          {notes.data.map((n) => (
            <li key={n.id}>
              <span className="sf-note sf-muted">
                {n.author} · {new Date(n.createdAt).toLocaleString()}
              </span>
              <p>{n.note}</p>
            </li>
          ))}
        </ul>
      ) : notes.data ? (
        <p className="sf-note sf-muted">No notes yet on this test.</p>
      ) : null}
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "var(--sf-space-2)" }}>
        <textarea
          className="sf-textarea"
          style={{ minHeight: "2.5rem" }}
          placeholder="Was this result actually good? What would make the next attempt better?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div style={{ display: "flex", gap: "var(--sf-space-2)" }}>
          <button type="submit" className="sf-button" disabled={add.isPending || text.trim().length === 0}>
            {add.isPending ? "Adding…" : "Add note"}
          </button>
          <button type="button" className="sf-button sf-button-quiet" onClick={() => setOpen(false)}>
            close
          </button>
        </div>
      </form>
    </div>
  );
}

export function LessonbookDetailPage(): ReactNode {
  const { bookId } = useParams({ from: "/lessonbook/$bookId" });
  return <LessonbookDetailInner bookId={bookId} />;
}

/**
 * Split out so `useBookRunner(book)` can be called with the query's actual
 * data — `useBook` has to run first to produce it, and calling a hook with a
 * value from a hook declared below it is not an ordering React allows.
 */
function LessonbookDetailInner({ bookId }: { bookId: string }): ReactNode {
  const book = useBook(bookId, 2000);
  const runner = useBookRunner(book.data);
  const reset = useResetBookRuns(bookId);
  const autotest = useAutotestBook(bookId);

  if (book.isLoading) return <p className="sf-empty">Opening the book…</p>;
  if (book.isError || !book.data) {
    return (
      <p className="sf-error">
        This book could not be read: {book.isError ? (book.error as Error).message : "not found"}.
      </p>
    );
  }

  const b = book.data;
  const lessonSteps = b.steps.filter((s) => s.kind === "lesson");
  const reachedCount = b.steps.filter((s) => s.passed === true).length;
  const allReached = b.steps.length > 0 && reachedCount === b.steps.length;
  const hasProgress = reachedCount > 0;
  const testCount = b.steps.filter((s) => s.kind === "test").length;
  const untestedLessons = lessonSteps.length - testCount * 5;

  return (
    <>
      <Link to="/lessonbook" className="sf-back-link">
        ← back to the shelf
      </Link>

      <section className="sf-region" aria-labelledby="sf-book-title">
        <div className="sf-region-head">
          <div>
            <h2 className="sf-region-title" id="sf-book-title">
              {b.title}
            </h2>
            {b.topic ? <span className="sf-shape-badge">{b.topic}</span> : null}
          </div>
        </div>
        <div className="sf-region-body" style={{ display: "flex", flexDirection: "column", gap: "var(--sf-space-3)" }}>
          {b.description ? <p className="sf-note sf-muted">{b.description}</p> : null}

          <div className="sf-book-progress-track">
            <div
              className="sf-book-progress-fill"
              style={{ width: `${b.steps.length === 0 ? 0 : Math.round((reachedCount / b.steps.length) * 100)}%` }}
            />
          </div>
          <p className="sf-note sf-mono">
            {reachedCount} / {b.steps.length} reached · {testCount} unit test{testCount === 1 ? "" : "s"}
          </p>

          <div style={{ display: "flex", gap: "var(--sf-space-2)", flexWrap: "wrap" }}>
            <button
              type="button"
              className="sf-button sf-button-primary"
              disabled={runner.isRunningAll || allReached || b.steps.length === 0}
              onClick={runner.startRunAll}
            >
              {allReached
                ? "All steps reached"
                : runner.isRunningAll
                  ? "Reading…"
                  : hasProgress
                    ? "Resume reading"
                    : "Start reading"}
            </button>
            {runner.isRunningAll ? (
              <button type="button" className="sf-button" onClick={runner.stop}>
                Stop after this step
              </button>
            ) : null}
            <button type="button" className="sf-button" disabled={reset.isPending} onClick={() => reset.mutate()}>
              {reset.isPending ? "Resetting…" : "Reset run"}
            </button>
            {untestedLessons >= 5 ? (
              <button
                type="button"
                className="sf-button"
                disabled={autotest.isPending}
                title="Insert a review test after every 5 lessons that doesn't already have one."
                onClick={() => autotest.mutate()}
              >
                {autotest.isPending ? "Adding tests…" : "Add unit tests"}
              </button>
            ) : null}
          </div>

          {runner.dispatchError ? (
            <p className="sf-error">Not sent: {runner.dispatchError}.</p>
          ) : null}
          {runner.stoppedOnStepId && !runner.isRunningAll ? (
            <p className="sf-note" style={{ color: "var(--sf-not-reached)" }}>
              Reading stopped — that step did not reach. Send it again once it is fixed, add a
              sublesson if it was a test, or edit the prompt, then press "Resume reading".
            </p>
          ) : null}
        </div>
      </section>

      <section className="sf-region" aria-label="Steps">
        <div className="sf-region-body">
          {b.steps.length === 0 ? (
            <p className="sf-empty">No steps yet — add the first prompt below.</p>
          ) : (
            <ol className="sf-book-steps">
              {b.steps.map((step, i) => {
                const isActive = runner.activeStepId === step.id;
                const failed = stepIsFailed(step);
                return (
                  <li
                    key={step.id}
                    className={
                      "sf-book-step" +
                      (step.kind === "test" ? " is-test" : "") +
                      (step.kind === "sublesson" ? " is-sublesson" : "") +
                      (isActive ? " is-active" : "") +
                      (runner.stoppedOnStepId === step.id ? " is-stopped" : "")
                    }
                  >
                    <span className="sf-book-step-ord">{i + 1}</span>
                    <div className="sf-book-step-body">
                      <KindLabel kind={step.kind} />
                      <p className="sf-book-step-prompt">{step.prompt}</p>
                      <div className="sf-book-step-foot">
                        <StepStatus step={step} isActive={isActive} />
                        {step.dispatchId ? (
                          <Link to="/trace/$dispatchId" params={{ dispatchId: step.dispatchId }} className="sf-note">
                            view trace →
                          </Link>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: "var(--sf-space-2)", flexWrap: "wrap", marginTop: "var(--sf-space-1)" }}>
                        {step.kind !== "sublesson" ? <InsertLessonInline bookId={bookId} afterStepId={step.id} /> : null}
                        {step.kind === "test" ? <TestNotesInline stepId={step.id} /> : null}
                        {step.kind === "test" && failed ? (
                          <>
                            <AddSublessonInline bookId={bookId} testStepId={step.id} />
                            <button
                              type="button"
                              className="sf-button sf-button-quiet"
                              disabled={runner.isRunningAll}
                              onClick={() => runner.retryUnit(step)}
                            >
                              retry unit
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="sf-button"
                      disabled={runner.isRunningAll || isActive}
                      onClick={() => runner.sendStep(step)}
                    >
                      Send
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>

      <section className="sf-region" aria-label="Add a step">
        <div className="sf-region-body">
          <AddStepForm bookId={bookId} />
        </div>
      </section>
    </>
  );
}
