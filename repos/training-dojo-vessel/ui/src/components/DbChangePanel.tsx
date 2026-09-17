/**
 * DATABASE CHANGES — the piece that closes the teach → monitor → correct loop.
 *
 * A lesson about schema design does its real work in SurrealDB, not in this
 * walk's own text output — the Tables/Diff-history pages already watch that,
 * but a reader mid-lesson should not have to leave the page they are on to
 * find out what just happened. This is that same scan, right here: pressing
 * it takes a fresh snapshot (the honest, immediate before/after this exact
 * moment gives you — NOT an automatic per-lesson attribution, which this
 * surface cannot make honestly since scans are not one-per-dispatch) and
 * shows the resulting diff inline, plus a direct way to turn what you saw
 * into the next lesson.
 */
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useSchemaSnapshot, useScanNow } from "../api/queries";

const SCAN_POLL_MS = 4_000;
const SCAN_MAX_WAIT_MS = 5 * 60 * 1000;

export function DbChangePanel({ goal }: { goal: string | null }): ReactNode {
  const [scanning, setScanning] = useState(false);
  const [scanStartedAt, setScanStartedAt] = useState<number | null>(null);
  const snapshot = useSchemaSnapshot(undefined, scanning ? SCAN_POLL_MS : false);
  const scan = useScanNow();

  useEffect(() => {
    if (!scanning || !scanStartedAt) return;
    if (snapshot.data && new Date(snapshot.data.takenAt).getTime() > scanStartedAt) {
      setScanning(false);
      return;
    }
    if (Date.now() - scanStartedAt > SCAN_MAX_WAIT_MS) setScanning(false);
  }, [scanning, scanStartedAt, snapshot.data]);

  const handleScan = (): void => {
    setScanStartedAt(Date.now());
    setScanning(true);
    scan.mutate();
  };

  // The scan that just landed, if it landed AFTER this button was pressed —
  // a snapshot from before this click is the wrong thing to show as "what
  // this scan found", even though it is still sitting in `snapshot.data`.
  const justScanned = Boolean(
    scanStartedAt && snapshot.data && new Date(snapshot.data.takenAt).getTime() > scanStartedAt && !scanning,
  );

  return (
    <div className="sf-detail-part">
      <p className="sf-label">Database changes</p>
      <p className="sf-note sf-muted">
        Scan the shared SurrealDB now to see exactly what this lesson touched — table and column
        changes only surface here once you scan; nothing is attributed automatically.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sf-space-3)", flexWrap: "wrap" }}>
        <button type="button" className="sf-button sf-button-primary" disabled={scanning} onClick={handleScan}>
          {scanning ? "Scanning…" : "Scan DB now"}
        </button>
        {goal ? (
          <Link to="/" search={{ redo: goal }} className="sf-button sf-button-quiet">
            Teach a correction
          </Link>
        ) : null}
        <Link to="/diffs" className="sf-note" style={{ textDecoration: "underline" }}>
          full diff history →
        </Link>
      </div>

      {scan.isError ? (
        <p className="sf-error">The scan did not start: {(scan.error as Error).message}.</p>
      ) : null}

      {justScanned && snapshot.data ? (
        <p className="sf-ok" style={{ marginTop: "var(--sf-space-2)" }}>
          Scanned — {snapshot.data.tables.length} tables as of{" "}
          {new Date(snapshot.data.takenAt).toLocaleTimeString()}. Check{" "}
          <Link to="/diffs" style={{ textDecoration: "underline" }}>
            diff history
          </Link>{" "}
          for exactly what changed since the last scan, or{" "}
          <Link to="/tables" style={{ textDecoration: "underline" }}>
            the full table list
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
