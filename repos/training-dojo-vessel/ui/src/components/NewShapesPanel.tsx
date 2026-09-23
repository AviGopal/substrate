/**
 * NEW SHAPES — a dedicated container, not a note buried inside "what it
 * produced". The corner square (`.sf-shape-card` in styles.css) is a visual
 * convention: any box carrying that mark is shape-vocabulary information, a
 * different kind of fact from a run's ordinary output.
 *
 * "New" here means the honest thing `shapeAttribution.ts` can prove: a shape
 * absent from the fleet's vocabulary the instant this run was dispatched,
 * present in the pool now. Reuse of an existing shape is not silence here — it
 * is stated explicitly, because "this run made nothing new" is exactly the
 * signal a table-reuse lesson needs to see as much as "it minted one" is.
 *
 * Content, not just the shape name: a badge alone cannot answer "was this
 * table actually necessary", only the field content underneath can — the same
 * `planContent`/`ContentRender` pipeline the main evidence ledger uses, so a
 * new shape's content reads exactly like everything else on this surface
 * rather than as a bespoke second renderer.
 */
import type { ReactNode } from "react";
import type { GoalWalkState, RawProvenance } from "../api/types";
import { normalizeProvenance, planContent } from "../lib/ledger";
import { dispatchVocabularyOf, newShapesFor } from "../lib/shapeAttribution";
import { ContentRender } from "./ContentRender";

function ShapeContent({
  shapeName,
  provenance,
  formByShape,
}: {
  shapeName: string;
  provenance: readonly RawProvenance[];
  formByShape?: Readonly<Record<string, string>>;
}): ReactNode {
  const raw = provenance.find((p) => p.shape === shapeName);
  const entry = raw ? normalizeProvenance(raw) : null;

  if (!entry) {
    return (
      <p className="sf-note sf-muted">
        No pool record for this shape survived to the dispatch — it exists in the vocabulary
        now, but this run's own trace does not carry what it contained.
      </p>
    );
  }
  if (entry.kind === "empty") {
    return <p className="sf-note sf-muted">Created with no content carried.</p>;
  }
  const plan = planContent(entry.shape, entry.preview, entry.truncated, formByShape);
  return <ContentRender plan={plan} />;
}

export function NewShapesPanel({
  walk,
  formByShape,
}: {
  walk: GoalWalkState;
  formByShape?: Readonly<Record<string, string>>;
}): ReactNode {
  const before = dispatchVocabularyOf(walk.dispatchId);

  if (before === null) {
    return (
      <div className="sf-shape-card">
        <p className="sf-label">New shapes this run created</p>
        <p className="sf-note sf-muted">
          Not available for this run — its vocabulary at dispatch time was never recorded (it
          predates this feature, or was dispatched from a different browser).
        </p>
      </div>
    );
  }

  const fresh = newShapesFor(walk.poolShapes, before);

  if (fresh.length === 0) {
    return (
      <div className="sf-shape-card">
        <p className="sf-label">New shapes this run created</p>
        <p className="sf-note sf-muted">
          None — every shape this run touched already existed in the fleet's vocabulary before
          it was dispatched. Reuse, not a new table.
        </p>
      </div>
    );
  }

  return (
    <div className="sf-shape-card">
      <p className="sf-label">New shapes this run created</p>
      <p className="sf-note sf-muted">
        Absent from the fleet's vocabulary the moment this run was dispatched, present in the
        pool now. The content below is what that shape actually carried — the part worth
        reading before deciding whether this should have been a new table at all, or an
        existing one.
      </p>
      <ul className="sf-shape-card-list">
        {fresh.map((shapeName) => (
          <li key={shapeName} className="sf-shape-card-entry">
            <span className="sf-shape-badge">{shapeName}</span>
            <ShapeContent shapeName={shapeName} provenance={walk.poolProvenance} formByShape={formByShape} />
          </li>
        ))}
      </ul>
    </div>
  );
}
