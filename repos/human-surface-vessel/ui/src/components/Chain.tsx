/**
 * The run as a chain: each output with the impulses it consumed under it, then
 * what was produced and not used. Content is whatever the record holds — a
 * preview of up to 2,000 characters — and says so; the full content cannot be
 * read by reference until goal-host serves it (coordinator ask C1, gated on
 * route authentication).
 */

import type { ReactNode } from "react";
import type { GoalWalkState, RouteAround } from "../api/types";
import { buildChains, inputsOf, isSeed, type ChainNode, type RunChains } from "../lib/chain";
import { creditFor, readCredit, type CreditRow, type RunCredit } from "../lib/credit";
import { fromProvenance } from "../lib/content";
import { Rendered } from "./Rendered";

const MAX_DEPTH = 4;

function count(n: number): string {
  return n.toLocaleString("en-US");
}

function producerLabel(n: ChainNode): string | null {
  if (!n.producedBy || n.producedBy === "goal-host-walk") return null;
  return n.producedBy;
}

function deltaText(r: CreditRow): string {
  const parts: string[] = [];
  if (r.dAlpha) parts.push(`+${r.dAlpha} α`);
  if (r.dBeta) parts.push(`+${r.dBeta} β`);
  return parts.join(" ");
}

/** The credit the node's producer received in this run, shown where the reviewer reads the node. */
function CreditBadge({ row }: { row: CreditRow | null }): ReactNode {
  if (!row) return null;
  return (
    <span className="sf-credit-badge" data-credit={row.dAlpha > 0 ? "credited" : "penalised"} title={`learning delta for ${row.templateId}`}>
      {row.dAlpha > 0 ? "credited" : "penalised"} {deltaText(row)}
    </span>
  );
}

function NodeContent({ n, density, credit }: { n: ChainNode; density: "full" | "inline"; credit: RunCredit | null }): ReactNode {
  const content = fromProvenance(n.raw);
  if (!content) return null;
  return (
    <Rendered
      content={content}
      density={density}
      region="run_chain"
      extraHeader={
        <>
          {n.producerExecutionId ? <span className="sf-muted sf-mono">{n.producerExecutionId}</span> : null}
          <CreditBadge row={creditFor(n.producedBy, credit)} />
        </>
      }
    />
  );
}

/** A collapsed input: one line until opened. */
function InputRow({ n, chains, depth, seen, credit }: { n: ChainNode; chains: RunChains; depth: number; seen: ReadonlySet<string>; credit: RunCredit | null }): ReactNode {
  const content = fromProvenance(n.raw);
  const producer = producerLabel(n);
  return (
    <li className="sf-chain-input">
      <details>
        <summary>
          <span className="sf-shape-badge">{n.shape}</span>
          {isSeed(n) ? <span className="sf-muted">from the request</span> : producer ? <span className="sf-mono sf-muted">{producer}</span> : null}
          <span className="sf-muted">{n.chars > 0 ? `${count(n.chars)} chars` : "no content"}</span>
          <CreditBadge row={creditFor(n.producedBy, credit)} />
          {content ? <Rendered content={content} density="row" /> : null}
        </summary>
        <div className="sf-chain-input-body">
          <NodeContent n={n} density="inline" credit={credit} />
          <Inputs n={n} chains={chains} depth={depth + 1} seen={seen} credit={credit} />
        </div>
      </details>
    </li>
  );
}

function Inputs({ n, chains, depth, seen, credit }: { n: ChainNode; chains: RunChains; depth: number; seen: ReadonlySet<string>; credit: RunCredit | null }): ReactNode {
  if (n.consumedIds.length === 0 || depth > MAX_DEPTH || seen.has(n.id)) return null;
  const { inputs, missing } = inputsOf(n, chains);
  const next = new Set(seen).add(n.id);
  return (
    <div className="sf-chain-inputs">
      <p className="sf-chain-label">consumed</p>
      <ul>
        {inputs.map((i) => (
          <InputRow key={i.id} n={i} chains={chains} depth={depth} seen={next} credit={credit} />
        ))}
      </ul>
      {missing.length > 0 ? (
        <p className="sf-muted sf-note">
          {missing.length} input{missing.length === 1 ? "" : "s"} no longer on the record
        </p>
      ) : null}
    </div>
  );
}

function RouteArounds({ items }: { items: readonly RouteAround[] }): ReactNode {
  if (items.length === 0) return null;
  return (
    <details className="sf-chain-routes">
      <summary>
        The walk stalled {items.length} time{items.length === 1 ? "" : "s"}
      </summary>
      <ol>
        {items.map((r, i) => (
          <li key={`${r.at ?? i}`}>
            {r.missing_producer && r.missing_producer.length > 0 ? (
              <>
                nothing could produce <span className="sf-mono">{r.missing_producer.join(", ")}</span>
              </>
            ) : (
              r.termination ?? "stalled"
            )}
            {r.route_taken ? <span className="sf-muted"> · then {r.route_taken}</span> : null}
            {r.failed_producers && r.failed_producers.length > 0 ? (
              <span className="sf-muted">
                {" "}
                · {r.failed_producers.length} producer{r.failed_producers.length === 1 ? "" : "s"} failed
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

/** What the run taught the learner, from the record's learning sink. */
function CreditSection({ credit, reached }: { credit: RunCredit | null; reached: boolean | null }): ReactNode {
  if (!credit) return null;
  const facts = [
    credit.goalPathRecorded === true ? "path recorded" : credit.goalPathRecorded === false ? "path not recorded" : null,
    credit.gapsFiled > 0 ? `${credit.gapsFiled} gap${credit.gapsFiled === 1 ? "" : "s"} filed` : null,
    credit.oracleLabelWritten === true ? "oracle label written" : null,
  ].filter((f): f is string => f !== null);
  return (
    <details className="sf-chain-credit" open={credit.rows.some((r) => r.dAlpha > 0)}>
      <summary>
        Credit ·{" "}
        {credit.rows.length === 0
          ? reached === true
            ? "nothing credited"
            : "no credit or penalty recorded"
          : `${credit.rows.filter((r) => r.dAlpha > 0).length} credited, ${credit.rows.filter((r) => r.dAlpha <= 0).length} penalised`}
        {facts.length > 0 ? <span className="sf-muted"> · {facts.join(" · ")}</span> : null}
      </summary>
      {credit.rows.length > 0 ? (
        <ul>
          {credit.rows.map((r) => (
            <li key={r.templateId}>
              <span className="sf-mono">{r.templateId}</span> <CreditBadge row={r} />
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}

export function Chain({ walk, hasAnswer }: { walk: GoalWalkState; hasAnswer: boolean }): ReactNode {
  const chains = buildChains(walk);
  const credit = readCredit(walk.learning);
  const routes = walk.routeArounds ?? [];
  const terminal = walk.status !== "running";

  if (!chains.retained) {
    return terminal ? (
      <section className="sf-view-section sf-chain" aria-label="Outputs">
        <h3 className="sf-view-label">Outputs</h3>
        <p className="sf-note">
          Not retained — the server keeps the content of its newest 100 runs, and this run is older.
        </p>
        <CreditSection credit={credit} reached={walk.reached} />
        <RouteArounds items={routes} />
      </section>
    ) : null;
  }

  const lead = chains.outputs;
  return (
    <section className="sf-view-section sf-chain" aria-label="Outputs">
      <h3 className="sf-view-label">{hasAnswer ? "How the answer was produced" : "Outputs"}</h3>
      {!chains.edgesRecorded ? (
        <p className="sf-note">This run was recorded before edges were kept, so what fed what is not known.</p>
      ) : lead.length > 0 && !hasAnswer ? (
        <p className="sf-note sf-muted">
          No answer is marked on this run. Outputs that were built from other outputs come first, largest first.
        </p>
      ) : null}

      {lead.map((n) => (
        <article key={n.id} className="sf-chain-output">
          <NodeContent n={n} density="full" credit={credit} />
          <Inputs n={n} chains={chains} depth={0} seen={new Set()} credit={credit} />
        </article>
      ))}

      {chains.unused.length > 0 ? (
        <details className="sf-chain-unused" open={lead.length === 0}>
          <summary>
            {lead.length === 0 ? "Produced" : "Also produced, not used by any output"} · {chains.unused.length}
          </summary>
          <ul>
            {chains.unused.map((n) => (
              <InputRow key={n.id} n={n} chains={chains} depth={MAX_DEPTH} seen={new Set()} credit={credit} />
            ))}
          </ul>
        </details>
      ) : null}

      <CreditSection credit={credit} reached={walk.reached} />
      <RouteArounds items={routes} />
    </section>
  );
}
