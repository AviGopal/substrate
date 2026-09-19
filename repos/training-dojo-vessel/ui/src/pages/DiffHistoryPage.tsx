/**
 * DIFF HISTORY — a standalone log of what changed, scan to scan. Route `/diffs`.
 *
 * Deliberately its own page rather than folded under Tables (confirmed with
 * the operator): Tables answers "what does the schema look like right now",
 * this answers "what has the agent been doing to it" — a different question
 * with a different shape (append-only log vs. a point-in-time snapshot), and
 * conflating them would have made the record-of-change scroll underneath a
 * live table a reader is trying to read.
 */
import type { ReactNode } from "react";
import { useState } from "react";
import { DbTargetPicker } from "../components/DbTargetPicker";
import { useSchemaDiffs } from "../api/queries";
import type { SchemaSnapshotDiff } from "../api/types";

function formatAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function rowDelta(before: number | null, after: number | null): string {
  if (before === null || after === null) return "";
  const d = after - before;
  if (d === 0) return "";
  return d > 0 ? ` (+${d.toLocaleString()})` : ` (${d.toLocaleString()})`;
}

function DiffEntry({ diff }: { diff: SchemaSnapshotDiff }): ReactNode {
  const nothingChanged =
    diff.tablesAdded.length === 0 && diff.tablesRemoved.length === 0 && diff.tablesChanged.length === 0;

  return (
    <li
      style={{
        marginBottom: "var(--sf-space-3)",
        paddingBottom: "var(--sf-space-3)",
        borderBottom: "1px solid var(--sf-rule)",
      }}
    >
      {/* Scoped to its own grid container — `.sf-record` is a strict
          key/value grid, and mixing unrelated siblings into it (a paragraph,
          a list) would auto-place them into its narrow first column instead
          of letting them span the row. */}
      <div className="sf-record">
        <div className="sf-record-row">
          <span className="sf-record-key">at</span>
          <span className="sf-record-value">{formatAt(diff.at)}</span>
        </div>
      </div>

      {nothingChanged ? (
        <p className="sf-note sf-muted">No change from the previous snapshot.</p>
      ) : (
        <>
          {diff.tablesAdded.length > 0 ? (
            <>
              <p className="sf-note sf-muted" style={{ marginBottom: 0 }}>
                tables added
              </p>
              <ul className="sf-shape-list">
                {diff.tablesAdded.map((t) => (
                  <li key={t} className="sf-table-diff-box is-added">
                    {t}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {diff.tablesRemoved.length > 0 ? (
            <>
              <p className="sf-note sf-muted" style={{ marginBottom: 0 }}>
                tables removed
              </p>
              <ul className="sf-shape-list">
                {diff.tablesRemoved.map((t) => (
                  <li key={t} className="sf-table-diff-box is-removed">
                    {t}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {diff.tablesChanged.length > 0 ? (
            <ul style={{ listStyle: "none", margin: "var(--sf-space-2) 0 0", padding: 0 }}>
              {diff.tablesChanged.map((tc) => (
                <li
                  key={tc.table}
                  className="sf-diff"
                  style={{ marginBottom: "var(--sf-space-2)" }}
                >
                  <span className="sf-diff-line" data-kind="hunk">
                    {tc.table}
                  </span>
                  {tc.columnsAdded.length > 0 ? (
                    <div className="sf-diff-line" data-kind="added">
                      + {tc.columnsAdded.join(", ")}
                    </div>
                  ) : null}
                  {tc.columnsRemoved.length > 0 ? (
                    <div className="sf-diff-line" data-kind="removed">
                      − {tc.columnsRemoved.join(", ")}
                    </div>
                  ) : null}
                  {tc.rowCountBefore !== tc.rowCountAfter ? (
                    <div className="sf-diff-line" data-kind="meta">
                      rows: {tc.rowCountBefore ?? "unknown"} → {tc.rowCountAfter ?? "unknown"}
                      {rowDelta(tc.rowCountBefore, tc.rowCountAfter)}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </li>
  );
}

export function DiffHistoryPage(): ReactNode {
  const [targetKey, setTargetKey] = useState<string | undefined>(undefined);
  const query = useSchemaDiffs(targetKey, 50);

  return (
    <section className="sf-region" aria-labelledby="sf-diffs-title">
      <div className="sf-region-head">
        <h2 className="sf-region-title" id="sf-diffs-title">
          Diff history
        </h2>
        <DbTargetPicker value={targetKey} onChange={setTargetKey} />
      </div>
      <div className="sf-region-body">
        {query.isError ? (
          <p className="sf-error">Could not read diff history: {(query.error as Error).message}.</p>
        ) : null}

        {!query.isError && query.isLoading ? <p className="sf-empty">Reading diff history…</p> : null}

        {!query.isError && !query.isLoading && (query.data?.length ?? 0) === 0 ? (
          <p className="sf-empty">
            <strong>No diffs recorded yet.</strong>
            This is normal before a second snapshot has ever run — a diff needs two snapshots to
            compare. Visit Tables and scan once, wait for the next tick, and this fills in.
          </p>
        ) : null}

        {query.data && query.data.length > 0 ? (
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {[...query.data]
              .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
              .map((diff) => (
                <DiffEntry key={diff.id} diff={diff} />
              ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
