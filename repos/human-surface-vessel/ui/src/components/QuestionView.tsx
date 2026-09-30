/**
 * One question from the system, open in the main pane, with the response form.
 *
 * The exact revision being answered is held; a newer revision must be reviewed
 * before a response can be sent against it. Retrying an uncertain delivery
 * reuses its response id, so it cannot manufacture a second response.
 */

import { useMutation } from "@tanstack/react-query";
import { useId, useRef, useState, type ReactNode } from "react";
import { sendContribution, type Contribution, type Question } from "../api/participation";
import { useRenderPolicy } from "../api/queries";
import { planContent } from "../lib/ledger";
import { reportExposureAct } from "../lib/exposure-reporter";
import { useLiveControls } from "../state/liveControls";
import { questionGapId, questionSubject, useQuestions } from "../state/questions";
import { ComplainButton } from "./ComplainButton";
import { ContentRender } from "./ContentRender";
import { FormDecisionRecorder } from "./FormDecisionRecorder";

/** The pin key a question body is planned under. */
export const QUESTION_CONTENT_SHAPE = "human_question";

function contentText(value: unknown): string {
  return typeof value === "string" ? value : (JSON.stringify(value, null, 2) ?? "");
}

function QuestionCard({ incoming }: { incoming: Question }): ReactNode {
  const { recordReceipt } = useQuestions();
  const { paused, intervalMs } = useLiveControls();
  const renderPolicy = useRenderPolicy({ enabled: !paused, intervalMs }).data;
  const [question, setQuestion] = useState(incoming);
  const [text, setText] = useState("");
  const [format, setFormat] = useState<"text" | "json">("text");
  const [ask, setAsk] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  const pending = useRef<{ signature: string; contribution: Contribution } | null>(null);
  const mutation = useMutation({ mutationFn: sendContribution, retry: false, onSuccess: recordReceipt });
  const revised = incoming.revision !== question.revision;
  const gapId = questionGapId(question);

  function submit(kind: "answer" | "dismiss"): void {
    setError("");
    let value: unknown = text;
    if (kind === "answer" && !text.trim()) {
      setError("Write a response first.");
      return;
    }
    if (kind === "answer" && format === "json") {
      try {
        value = JSON.parse(text);
      } catch {
        setError("Not valid JSON.");
        return;
      }
    }
    const content = {
      panel_id: question.id,
      panel_revision: question.revision,
      ...(kind === "answer" && ask ? { ask_id: ask } : {}),
      kind,
      value,
    };
    const signature = JSON.stringify(content);
    if (pending.current?.signature !== signature) {
      pending.current = { signature, contribution: { ...content, response_id: crypto.randomUUID() } };
    }
    mutation.mutate(pending.current.contribution);
  }

  const plan = planContent(QUESTION_CONTENT_SHAPE, contentText(question.body), false, renderPolicy?.formByShape);

  return (
    <article className="sf-question" aria-labelledby={`${id}-title`}>
      <header className="sf-view-head">
        <p className="sf-view-eyebrow">{question.title}</p>
        <h2 id={`${id}-title`} className="sf-view-title sf-question-subject">
          {questionSubject(question)}
        </h2>
        <p className="sf-view-facts">
          {gapId ? <span className="sf-mono">{gapId}</span> : null}
          {question.answered ? <span className="sf-chip">answered</span> : null}
          {question.declined ? <span className="sf-chip">declined</span> : null}
          {question.because?.map((reason) => (
            <span key={reason} className="sf-chip sf-chip-quiet">
              {reason}
            </span>
          ))}
        </p>
      </header>

      <section className="sf-view-section">
        <ContentRender plan={plan} />
        <FormDecisionRecorder
          shape={QUESTION_CONTENT_SHAPE}
          plan={plan}
          truncated={false}
          policyRevision={renderPolicy?.revision ?? null}
          region="question_card"
        />
        {question.asks?.map((part) => (
          <p key={part.id}>
            <strong>{part.prompt}</strong>
            {part.choices?.length ? ` — ${part.choices.join(" · ")}` : ""}
          </p>
        ))}
      </section>

      {revised ? (
        <div className="sf-warn">
          This question changed.{" "}
          <button
            type="button"
            className="sf-button"
            onClick={() => {
              setQuestion(incoming);
              setAsk("");
              mutation.reset();
              setError("");
              pending.current = null;
            }}
          >
            Show new version
          </button>
        </div>
      ) : null}

      <form
        className="sf-view-section sf-respond"
        onSubmit={(event) => {
          event.preventDefault();
          submit("answer");
        }}
      >
        {question.asks?.length ? (
          <select
            aria-label="Respond to"
            className="sf-select"
            value={ask}
            disabled={mutation.isPending}
            onChange={(event) => setAsk(event.target.value)}
          >
            <option value="">Whole question</option>
            {question.asks.map((part) => (
              <option key={part.id} value={part.id}>
                {part.prompt}
              </option>
            ))}
          </select>
        ) : null}
        <textarea
          aria-label="Your response"
          className="sf-textarea"
          value={text}
          disabled={mutation.isPending}
          placeholder={question.answered ? "Add to your response" : "Your response"}
          onChange={(event) => {
            setText(event.target.value);
            mutation.reset();
          }}
        />
        <div className="sf-respond-actions">
          <button type="submit" className="sf-button sf-button-primary" disabled={mutation.isPending || revised}>
            {mutation.isPending ? "Sending…" : "Send"}
          </button>
          <button
            type="button"
            className="sf-button"
            disabled={mutation.isPending || revised}
            onClick={() => submit("dismiss")}
          >
            Decline
          </button>
          <select
            aria-label="Response format"
            className="sf-select sf-select-quiet"
            value={format}
            disabled={mutation.isPending}
            onChange={(event) => {
              setFormat(event.target.value as "text" | "json");
              mutation.reset();
            }}
          >
            <option value="text">Text</option>
            <option value="json">JSON</option>
          </select>
          <span className="sf-respond-status" role="status">
            {error ? <span className="sf-error-inline">{error}</span> : null}
            {mutation.isError ? (
              <span className="sf-error-inline">Not delivered: {mutation.error.message}. Retry sends the same response.</span>
            ) : null}
            {mutation.data ? (
              <span className="sf-ok-inline">{mutation.data.kind === "dismiss" ? "Declined" : "Sent"}</span>
            ) : null}
          </span>
        </div>
      </form>

      <details className="sf-view-section sf-history">
        <summary>
          History · {incoming.responses.length} response{incoming.responses.length === 1 ? "" : "s"} · rev{" "}
          {question.revision}
        </summary>
        {incoming.responses.map((response) => (
          <div key={response.id} className="sf-history-item">
            <p className="sf-history-meta">
              {response.kind} · rev {response.panelRevision ?? 1}
              {response.askId ? ` · part ${response.askId}` : ""} · <span className="sf-mono">{response.id}</span>
            </p>
            <pre className="sf-verbatim">{contentText(response.value)}</pre>
          </div>
        ))}
        <p className="sf-history-meta">
          <span className="sf-mono">{question.id}</span>
        </p>
      </details>

      <div className="sf-question-complain">
        <ComplainButton region={question.id} onFiled={() => reportExposureAct(question.id, "complained")} />
      </div>
    </article>
  );
}

export function QuestionView({ questionId }: { questionId: string }): ReactNode {
  const { ordered, query } = useQuestions();
  const question = ordered.find((q) => q.id === questionId);
  if (!question) {
    return <p className="sf-main-empty">{query.isPending ? "Loading…" : "This question is no longer listed."}</p>;
  }
  // Keyed so a different question gets a fresh draft and a fresh held revision.
  return <QuestionCard key={question.id} incoming={question} />;
}
