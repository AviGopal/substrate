/**
 * A run's trace: activity selections and the impulses they put in the pool,
 * in time order, each impulse drawn in the form its shape calls for.
 *
 * Content is rendered at full size — this pane is the reading surface, and a
 * capped box inside it is a second scroller hiding the evidence.
 *
 * A dispatch may walk several times; the trace is split into attempts (see
 * lib/attempts) and every attempt stays on screen, so a retry appends rather
 * than replacing what the reader was looking at.
 *
 * Join, within an attempt: events carry time and source; provenance carries
 * content. Each event takes the first unused provenance entry of its shape;
 * provenance no event claimed is appended untimed. Steps sort by `at`, then `index`,
 * because several are stamped in the same millisecond.
 */

import type { ReactNode } from "react";
import type { GoalWalkState, PoolEvent, WalkStep } from "../api/types";
import { normalizeLedger, planContent, type LedgerEntry } from "../lib/ledger";
import { formatChars } from "../lib/time";
import { segmentAttempts, type AttemptSegment } from "../lib/attempts";
import { walkLogText } from "../lib/walk";
import { ContentRender } from "./ContentRender";
import { FormDecisionRecorder } from "./FormDecisionRecorder";

type TraceItem =
  | { readonly kind: "step"; readonly at: number | null; readonly order: number; readonly step: WalkStep }
  | {
      readonly kind: "impulse";
      readonly at: number | null;
      readonly order: number;
      readonly shape: string;
      readonly source: string | null;
      readonly entry: LedgerEntry | null;
    };

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function buildItems(segment: AttemptSegment): readonly TraceItem[] {
  const entries = segment.provenance ? normalizeLedger(segment.provenance) : [];
  const used = new Set<number>();
  const items: TraceItem[] = [];
  const shownShapes = new Set<string>();
  let order = 0;

  segment.events.forEach((event: PoolEvent) => {
    const shape = event.shape ?? "impulse";
    const idx = entries.findIndex((e, i) => !used.has(i) && e.shape === shape);
    if (idx >= 0) used.add(idx);
    const entry = idx >= 0 ? (entries[idx] ?? null) : null;
    // A re-seed of a shape already shown, with no content of its own, is noise.
    if (!entry && shownShapes.has(shape)) return;
    shownShapes.add(shape);
    items.push({ kind: "impulse", at: num(event.at), order: order++, shape, source: str(event.source), entry });
  });

  segment.steps.forEach((step) => {
    items.push({ kind: "step", at: num(step["at"]), order: num(step["index"]) ?? order, step });
    order++;
  });

  items.sort((a, b) => {
    if (a.at !== null && b.at !== null && a.at !== b.at) return a.at - b.at;
    if (a.at === null && b.at !== null) return 1;
    if (b.at === null && a.at !== null) return -1;
    return a.order - b.order;
  });

  entries.forEach((entry, i) => {
    if (!used.has(i)) items.push({ kind: "impulse", at: null, order: order++, shape: entry.shape, source: null, entry });
  });
  return items;
}

function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function selectionLabel(selected: Record<string, unknown> | null): string {
  if (!selected) return "";
  const source = str(selected["source"]) ?? "";
  const score = num(selected["sampledScore"]);
  const alpha = num(selected["alpha"]);
  const beta = num(selected["beta"]);
  const parts = [source];
  if (score !== null) parts.push(score.toFixed(2));
  if (alpha !== null && beta !== null) parts.push(`α${alpha.toFixed(1)} β${beta.toFixed(1)}`);
  return parts.filter(Boolean).join(" ");
}

function StepRow({ step, t }: { step: WalkStep; t: string }): ReactNode {
  const selected =
    typeof step["selected"] === "object" && step["selected"] !== null
      ? (step["selected"] as Record<string, unknown>)
      : null;
  const template = str(selected?.["templateId"]) ?? step.templateId ?? "—";
  const candidates = Array.isArray(step["candidates"]) ? (step["candidates"] as Record<string, unknown>[]) : [];
  const newShapes = Array.isArray(step["newShapes"]) ? (step["newShapes"] as unknown[]).filter((s) => typeof s === "string") : [];
  const status = step.status ?? null;

  return (
    <li className="sf-trace-item sf-trace-step" data-status={status ?? undefined}>
      <span className="sf-trace-time">{t}</span>
      <div className="sf-trace-main">
        <div className="sf-trace-line">
          <span className="sf-trace-kind">step</span>
          <span className="sf-mono sf-trace-template">{template}</span>
          <span className="sf-trace-select">{selectionLabel(selected)}</span>
          {status ? <span className="sf-trace-status">{status}</span> : null}
          {newShapes.length > 0 ? <span className="sf-trace-produced">→ {newShapes.join(", ")}</span> : null}
        </div>
        {candidates.length > 0 ? (
          <details className="sf-trace-candidates">
            <summary>{candidates.length} other candidates</summary>
            <ul>
              {candidates.map((c, i) => (
                <li key={`${String(c["templateId"])}-${i}`}>
                  <span className="sf-mono">{str(c["templateId"]) ?? "?"}</span>{" "}
                  <span className="sf-trace-select">{selectionLabel(c)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </li>
  );
}

function ImpulseRow({
  item,
  t,
  formByShape,
  policyRevision,
}: {
  item: Extract<TraceItem, { kind: "impulse" }>;
  t: string;
  formByShape?: Readonly<Record<string, string>>;
  policyRevision: number | null;
}): ReactNode {
  const entry = item.entry;
  const plan = entry && entry.kind === "content" ? planContent(entry.shape, entry.preview, entry.truncated, formByShape) : null;

  return (
    <li className="sf-trace-item sf-trace-impulse">
      <span className="sf-trace-time">{t}</span>
      <div className="sf-trace-main">
        <div className="sf-trace-line">
          <span className="sf-shape-badge">{item.shape}</span>
          {item.source && !(entry?.kind === "content" && entry.preview.includes(item.source)) ? (
            <span className="sf-trace-source">{item.source}</span>
          ) : null}
          {entry?.producedBy && entry.producedBy !== "goal-host-walk" ? (
            <span className="sf-trace-source sf-mono">{entry.producedBy}</span>
          ) : null}
          {entry && entry.kind === "content" && entry.truncated ? (
            <span className="sf-trace-cut">
              first {formatChars(entry.preview.length)} of {formatChars(entry.chars)} chars
            </span>
          ) : null}
        </div>
        {entry && plan ? (
          <div className="sf-trace-content">
            <ContentRender plan={plan} />
            <FormDecisionRecorder
              shape={entry.shape}
              plan={plan}
              truncated={entry.kind === "content" && entry.truncated}
              policyRevision={policyRevision}
              region="evidence_ledger"
            />
          </div>
        ) : entry ? (
          <p className="sf-trace-none">empty</p>
        ) : null}
      </div>
    </li>
  );
}

function AttemptItems({
  segment,
  time,
  formByShape,
  policyRevision,
}: {
  segment: AttemptSegment;
  time: (at: number | null) => string;
  formByShape?: Readonly<Record<string, string>>;
  policyRevision: number | null;
}): ReactNode {
  const items = buildItems(segment);
  if (items.length === 0) return <p className="sf-trace-none">Nothing recorded yet</p>;
  return (
    <ol className="sf-trace">
      {items.map((item) =>
        item.kind === "step" ? (
          <StepRow key={`step-${item.order}`} step={item.step} t={time(item.at)} />
        ) : (
          <ImpulseRow
            key={`imp-${item.order}`}
            item={item}
            t={time(item.at)}
            formByShape={formByShape}
            policyRevision={policyRevision}
          />
        ),
      )}
    </ol>
  );
}

export function Trace({
  walk,
  formByShape,
  policyRevision,
}: {
  walk: GoalWalkState;
  formByShape?: Readonly<Record<string, string>>;
  policyRevision: number | null;
}): ReactNode {
  const segments = segmentAttempts(walk);
  const t0 = segments.find((s) => s.startAt !== null)?.startAt ?? null;
  const time = (at: number | null): string => (at !== null && t0 !== null ? clock(at - t0) : "");
  const empty = segments.every((s) => s.events.length === 0 && s.steps.length === 0 && (s.provenance?.length ?? 0) === 0);
  const running = walk.status === "running";

  return (
    <>
      {empty ? (
        <p className="sf-trace-none">No impulses recorded{walk.completionShapes?.length ? ` · covered by ${walk.completionShapes.join(", ")}` : ""}</p>
      ) : segments.length === 1 && segments[0] ? (
        <AttemptItems segment={segments[0]} time={time} formByShape={formByShape} policyRevision={policyRevision} />
      ) : (
        <>
          <nav className="sf-attempt-nav" aria-label="Attempts">
            {segments.map((seg) => (
              <a key={seg.number} href={`#attempt-${walk.dispatchId}-${seg.number}`}>
                {seg.number}
              </a>
            ))}
          </nav>
          {segments.map((seg) => (
            // Every attempt stays where it is; a new one appends below.
            <section
              key={seg.number}
              id={`attempt-${walk.dispatchId}-${seg.number}`}
              className="sf-attempt"
              data-current={seg.current && running}
            >
              <h4 className="sf-attempt-head">
                <span>Attempt {seg.number}</span>
                <span className="sf-attempt-meta">
                  {time(seg.startAt)}
                  {seg.reason ? ` · ${seg.reason}` : ""}
                  {seg.current ? (running ? " · in progress" : " · final") : ""}
                  {seg.partial ? " · earlier events not retained" : ""}
                  {!seg.current && seg.provenance === null ? " · content not retained" : ""}
                </span>
              </h4>
              <AttemptItems segment={seg} time={time} formByShape={formByShape} policyRevision={policyRevision} />
            </section>
          ))}
        </>
      )}
      {walk.walkLog.length > 0 ? (
        <details className="sf-walklog-details">
          <summary>Walk log · {walk.walkLog.length} lines</summary>
          <ol className="sf-walklog">
            {walk.walkLog.map((entry, i) => (
              // @interaction:exempt P4 — walk log is an append-only text stream; line order is the only identity it has
              <li key={`log-${i}`}>{walkLogText(entry)}</li>
            ))}
          </ol>
        </details>
      ) : null}
    </>
  );
}
