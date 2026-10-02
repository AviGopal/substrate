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

function NodeContent({ n, density }: { n: ChainNode; density: "full" | "inline" }): ReactNode {
  const content = fromProvenance(n.raw);
  if (!content) return null;
  return (
    <Rendered
      content={content}
      density={density}
      region="run_chain"
      extraHeader={n.producerExecutionId ? <span className="sf-muted sf-mono">{n.producerExecutionId}</span> : null}
    />
  );
}

/** A collapsed input: one line until opened. */
function InputRow({ n, chains, depth, seen }: { n: ChainNode; chains: RunChains; depth: number; seen: ReadonlySet<string> }): ReactNode {
  const content = fromProvenance(n.raw);
  const producer = producerLabel(n);
  return (
    <li className="sf-chain-input">
      <details>
        <summary>
          <span className="sf-shape-badge">{n.shape}</span>
          {isSeed(n) ? <span className="sf-muted">from the request</span> : producer ? <span className="sf-mono sf-muted">{producer}</span> : null}
          <span className="sf-muted">{n.chars > 0 ? `${count(n.chars)} chars` : "no content"}</span>
          {content ? <Rendered content={content} density="row" /> : null}
        </summary>
        <div className="sf-chain-input-body">
          <NodeContent n={n} density="inline" />
          <Inputs n={n} chains={chains} depth={depth + 1} seen={seen} />
        </div>
      </details>
    </li>
  );
}

function Inputs({ n, chains, depth, seen }: { n: ChainNode; chains: RunChains; depth: number; seen: ReadonlySet<string> }): ReactNode {
  if (n.consumedIds.length === 0 || depth > MAX_DEPTH || seen.has(n.id)) return null;
  const { inputs, missing } = inputsOf(n, chains);
  const next = new Set(seen).add(n.id);
  return (
    <div className="sf-chain-inputs">
      <p className="sf-chain-label">consumed</p>
      <ul>
        {inputs.map((i) => (
          <InputRow key={i.id} n={i} chains={chains} depth={depth} seen={next} />
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

export function Chain({ walk, hasAnswer }: { walk: GoalWalkState; hasAnswer: boolean }): ReactNode {
  const chains = buildChains(walk);
  const routes = walk.routeArounds ?? [];
  const terminal = walk.status !== "running";

  if (!chains.retained) {
    return terminal ? (
      <section className="sf-view-section sf-chain" aria-label="Outputs">
        <h3 className="sf-view-label">Outputs</h3>
        <p className="sf-note">
          Not retained — the server keeps the content of its newest 100 runs, and this run is older.
        </p>
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
          <NodeContent n={n} density="full" />
          <Inputs n={n} chains={chains} depth={0} seen={new Set()} />
        </article>
      ))}

      {chains.unused.length > 0 ? (
        <details className="sf-chain-unused" open={lead.length === 0}>
          <summary>
            {lead.length === 0 ? "Produced" : "Also produced, not used by any output"} · {chains.unused.length}
          </summary>
          <ul>
            {chains.unused.map((n) => (
              <InputRow key={n.id} n={n} chains={chains} depth={MAX_DEPTH} seen={new Set()} />
            ))}
          </ul>
        </details>
      ) : null}

      <RouteArounds items={routes} />
    </section>
  );
}
