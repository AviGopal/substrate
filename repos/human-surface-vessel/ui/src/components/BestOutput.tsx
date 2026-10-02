/**
 * The best output of a run that did not reach, shown above the trace with what
 * it is said plainly: not reached, which attempt, the judge's reason, and how
 * much of the output is on screen. Selection lives in lib/bestOutput.ts.
 */

import type { ReactNode } from "react";
import type { GoalWalkState } from "../api/types";
import type { AttemptSegment } from "../lib/attempts";
import { pickBestOutput, type BestOutputSource } from "../lib/bestOutput";
import { fromText } from "../lib/content";
import { AnswerBody } from "./Answer";
import { Rendered } from "./Rendered";

const SOURCE_NOTE: Readonly<Record<BestOutputSource, string>> = {
  walk_log_excerpt: "the server kept only an excerpt of this output",
  browser_copy: "this is the copy this browser saw while the run was live",
  pool_preview: "from the run's pool, as the server holds it now",
};

function count(n: number): string {
  return n.toLocaleString("en-US");
}

export function BestOutput({
  walk,
  segments,
  running,
}: {
  walk: GoalWalkState;
  segments: readonly AttemptSegment[];
  running: boolean;
}): ReactNode {
  const best = pickBestOutput(walk, segments);
  if (!best) return null;
  // The run's header already shows the reported attempt's reason; repeat it
  // here only when the output shown came from a different attempt.
  const reported = segments.find((s) => s.reported) ?? null;
  const verdict = best.verdict && (!reported || reported.number !== best.attempt) ? best.verdict : null;
  // Written prose reads as the Answer card does; structured output goes to the
  // shape-form planner like any impulse.
  const structured = /^\s*[[{]/.test(best.text);
  const shown = best.text.length;
  const whole = !best.cut && shown >= best.totalChars;
  const extent = whole
    ? `${count(best.totalChars)} characters`
    : `showing ${count(shown)} of ${count(best.totalChars)} characters`;

  return (
    <section className="sf-view-section sf-best-output" aria-label="Best output" data-source={best.source}>
      <h3 className="sf-view-label">{running ? "Best output so far" : "Best output"} — not reached</h3>
      <p className="sf-view-facts">
        {best.attempt !== null && best.attempts > 1 ? (
          <span className="sf-chip sf-chip-quiet">
            attempt {best.attempt} of {best.attempts}
          </span>
        ) : null}
        <span className="sf-shape-badge">{best.shape}</span>
        <span>{extent}</span>
        {whole ? null : <span className="sf-muted">{SOURCE_NOTE[best.source]}</span>}
      </p>
      {verdict ? <p className="sf-best-verdict">Attempt {best.attempt} was judged not reached: {verdict}</p> : null}
      {structured ? (
        <Rendered
          content={{
            ...fromText(best.shape, best.text, whole ? "full" : "truncated"),
            size: { shown, total: best.totalChars },
          }}
          density="full"
          header={false}
          region="best_output"
        />
      ) : (
        <AnswerBody answerBody={whole ? best.text : `${best.text}\u2026`} goal={walk.goal} />
      )}
    </section>
  );
}
