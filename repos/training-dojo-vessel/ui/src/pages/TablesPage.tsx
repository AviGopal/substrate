/**
 * TABLES — the shared SurrealDB, as of the last scan. Route `/tables`.
 *
 * This exists because agents doing dev work create real tables/columns in the
 * substrate's own store as a side effect of the lessons they're given, and
 * that has been invisible — the whole point of this page is to make it
 * watchable. It reads whatever the periodic `db_admin`/`schema_snapshot`
 * timer last wrote (~every 4 minutes) plus whatever "Scan now" adds on
 * demand; it never queries SurrealDB itself (law 11 — resolvers live where
 * the data lives, this surface only reads what the resolver already wrote).
 */
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { DbTargetPicker } from "../components/DbTargetPicker";
import { useSchemaSnapshot, useScanNow } from "../api/queries";

function formatTakenAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * A cold first scan runs well past any reasonable request timeout (measured
 * ~36s for just two of this hub's largest tables), so "Scan now" starts a
 * BACKGROUND scan (the mutation itself resolves in well under a second) and
 * this page polls `/api/schema/latest` every few seconds until a snapshot
 * newer than `scanStartedAt` shows up, then stops — polling only while a
 * scan is actually in flight, never as a steady-state behaviour.
 */
const SCAN_POLL_MS = 4_000;
const SCAN_MAX_WAIT_MS = 5 * 60 * 1000;

export function TablesPage(): ReactNode {
  const [targetKey, setTargetKey] = useState<string | undefined>(undefined);
  const [scanning, setScanning] = useState(false);
  const [scanStartedAt, setScanStartedAt] = useState<number | null>(null);
  const query = useSchemaSnapshot(targetKey, scanning ? SCAN_POLL_MS : false);
  const scan = useScanNow();
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!scanning || !scanStartedAt) return;
    if (query.data && new Date(query.data.takenAt).getTime() > scanStartedAt) {
      setScanning(false);
      return;
    }
    if (Date.now() - scanStartedAt > SCAN_MAX_WAIT_MS) setScanning(false); // stop polling forever if something upstream wedges
  }, [scanning, scanStartedAt, query.data]);

  const handleScan = (): void => {
    setScanStartedAt(Date.now());
    setScanning(true);
    scan.mutate(targetKey);
  };

  return (
    <section className="sf-region" aria-labelledby="sf-tables-title">
      <div className="sf-region-head">
        <h2 className="sf-region-title" id="sf-tables-title">
          Tables
        </h2>
        <DbTargetPicker value={targetKey} onChange={setTargetKey} />
        <button
          type="button"
          className="sf-button sf-button-primary"
          disabled={scan.isPending || scanning}
          onClick={handleScan}
        >
          {scan.isPending || scanning ? "Scanning…" : "Scan now"}
        </button>
      </div>
      <div className="sf-region-body">
        {scan.isError ? (
          <p className="sf-error">The scan did not start: {(scan.error as Error).message}.</p>
        ) : null}
        {scanning ? (
          <p className="sf-note">
            Scanning — a first-ever scan of a large table can take a couple of minutes; this page
            updates on its own once it lands.
          </p>
        ) : null}

        {query.isError ? (
          <p className="sf-error">
            Could not read the schema snapshot: {(query.error as Error).message}.
          </p>
        ) : null}

        {!query.isError && query.isLoading ? <p className="sf-empty">Reading the last snapshot…</p> : null}

        {!query.isError && !query.isLoading && !query.data ? (
          <p className="sf-empty">
            <strong>No snapshot has ever been taken.</strong>
            The periodic scan runs roughly every four minutes once the vessel and the
            schema-watch capability are both up — or press "Scan now" above to take the first
            one immediately.
          </p>
        ) : null}

        {query.data ? (
          <>
            <p className="sf-note sf-muted">
              As of {formatTakenAt(query.data.takenAt)} — {query.data.tables.length} table
              {query.data.tables.length === 1 ? "" : "s"}.
            </p>
            <div className="sf-scroll-x">
              <table className="sf-table">
                <thead>
                  <tr>
                    <th>table</th>
                    <th>columns</th>
                    <th>rows</th>
                    <th>created</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.tables.map((t) => (
                    <tr key={t.name}>
                      <td>{t.name}</td>
                      <td>
                        <button
                          type="button"
                          className="sf-button sf-button-quiet"
                          onClick={() => setExpanded((cur) => (cur === t.name ? null : t.name))}
                        >
                          {t.columnCount} column{t.columnCount === 1 ? "" : "s"}
                          {expanded === t.name ? " (hide)" : " (show)"}
                        </button>
                        {expanded === t.name ? (
                          <ul className="sf-shape-list" style={{ marginTop: "var(--sf-space-1)" }}>
                            {t.columns.map((col) => (
                              <li key={col} className="sf-shape-badge">
                                {col}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                      <td>
                        {t.rowCount === null ? (
                          <span className="sf-cell-summary">unknown</span>
                        ) : (
                          <>
                            {t.rowCountApproximate ? "≈ " : ""}
                            {t.rowCount.toLocaleString()}
                          </>
                        )}
                      </td>
                      <td>
                        {t.createdAt ? (
                          <span className="sf-mono sf-note">{formatTakenAt(t.createdAt)}</span>
                        ) : (
                          <span className="sf-cell-summary" title="Already present in the first snapshot this vessel ever took — its real creation was never observed.">
                            before tracking began
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
