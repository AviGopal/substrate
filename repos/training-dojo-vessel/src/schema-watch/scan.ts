/**
 * schema-watch: one scan-and-diff cycle — the thing both the periodic tick
 * and the "Scan now" button do, identically.
 *
 * Row counts are the expensive part, measured directly against this hub's
 * SurrealDB: `SELECT count() FROM execution GROUP ALL` alone took ~30s+ of a
 * ~36s six-table batch that included it (execution: ~990k rows and growing).
 * Counting every one of ~99 tables on every tick would make a "every ~4
 * minutes" cadence meaningless. So: a table is only recounted for real when
 * it is new or was small (< LARGE_TABLE_ROWS) last time; once it is known
 * large, its row count is carried forward from the previous snapshot and
 * marked `rowCountApproximate: true` rather than re-measured. Columns are
 * always read fresh (INFO FOR TABLE is metadata-only, no scan, cheap) — only
 * counting is throttled.
 *
 * Target-aware now: `runScan` takes a `DbTarget` (see `./targets.ts`) so
 * Tables/Diff-history can watch either the substrate's own database or this
 * vessel's own lessonbook database — the snapshot/diff log is kept per
 * target (see `./store.ts`), so switching which one you're looking at never
 * shows one database's history as if it were the other's.
 */

import { randomUUID } from "node:crypto";
import { isSafeIdent, runSurrealQL, type SurrealStatementResult } from "./surreal.js";
import {
  clearTablesFirstSeen,
  latestSnapshot,
  recordTablesFirstSeen,
  saveDiff,
  saveSnapshot,
  type SchemaSnapshot,
  type SchemaSnapshotDiff,
  type SchemaSnapshotTable,
  type SchemaTableChange,
} from "./store.js";
import { DEFAULT_TARGET, type DbTarget } from "./targets.js";

const LARGE_TABLE_ROWS = 50_000;

function resultOf(stmt: SurrealStatementResult | undefined): unknown {
  return stmt?.status === "OK" ? stmt.result : undefined;
}

export async function runScan(
  target: DbTarget = DEFAULT_TARGET,
): Promise<{ snapshot: SchemaSnapshot; diff: SchemaSnapshotDiff | null }> {
  const previous = latestSnapshot(target.key);
  const previousByName = new Map(previous?.tables.map((t) => [t.name, t]) ?? []);

  const infoResult = await runSurrealQL("INFO FOR DB;", { ns: target.ns, db: target.db });
  const dbInfo = resultOf(infoResult[0]) as { tables?: Record<string, string> } | undefined;
  const allNames = Object.keys(dbInfo?.tables ?? {}).filter(isSafeIdent).sort();

  // Decide, BEFORE issuing any statement, which tables get a real count this
  // tick vs. a carried-forward one — this is what keeps a steady-state scan
  // cheap regardless of how big the substrate's trace tables get.
  const toCount: string[] = [];
  const carried = new Map<string, number>();
  for (const name of allNames) {
    const prev = previousByName.get(name);
    if (prev && prev.rowCount !== null && prev.rowCount >= LARGE_TABLE_ROWS) {
      carried.set(name, prev.rowCount);
    } else {
      toCount.push(name);
    }
  }

  const stmts: string[] = [];
  for (const name of allNames) stmts.push(`INFO FOR TABLE ${name};`);
  for (const name of toCount) stmts.push(`SELECT count() AS c FROM ${name} GROUP ALL;`);
  // `INFO FOR TABLE` only ever reports `DEFINE FIELD`s — a SCHEMALESS table
  // (every `dojo_*` table this vessel writes: plain `CREATE ... CONTENT
  // {...}`, no field defined anywhere) always comes back with an EMPTY
  // `fields` object no matter how much data is in it. Sample a few real rows
  // for exactly those tables and union their keys instead — cheap (LIMIT 3,
  // batched into this same round trip) and skipped entirely for any table
  // whose `INFO FOR TABLE` already answered, so a real SCHEMAFULL table pays
  // nothing extra.
  const batch = await runSurrealQL(stmts.join("\n"), { ns: target.ns, db: target.db });

  const infoResults = batch.slice(0, allNames.length);
  const countResults = batch.slice(allNames.length, allNames.length + toCount.length);
  const countByName = new Map<string, number | null>();
  toCount.forEach((name, i) => {
    const r = resultOf(countResults[i]) as Array<{ c?: number }> | undefined;
    countByName.set(name, typeof r?.[0]?.c === "number" ? r[0].c : null);
  });

  // Second, small batch — only the schemaless tables need it, and only once
  // we've seen which those are from the first batch's `INFO FOR TABLE` results.
  const needsSample = allNames.filter((name, i) => {
    const fields = (resultOf(infoResults[i]) as { fields?: Record<string, unknown> } | undefined)?.fields ?? {};
    return Object.keys(fields).length === 0;
  });
  const sampleBatch =
    needsSample.length > 0
      ? await runSurrealQL(needsSample.map((name) => `SELECT * FROM ${name} LIMIT 3;`).join("\n"), { ns: target.ns, db: target.db })
      : [];
  const sampledColumnsByName = new Map<string, string[]>();
  needsSample.forEach((name, i) => {
    const rows = (resultOf(sampleBatch[i]) as Array<Record<string, unknown>> | undefined) ?? [];
    const keys = new Set<string>();
    for (const row of rows) for (const k of Object.keys(row)) if (k !== "id") keys.add(k);
    sampledColumnsByName.set(name, [...keys].sort());
  });

  const tables: SchemaSnapshotTable[] = allNames.map((name, i) => {
    const fields = (resultOf(infoResults[i]) as { fields?: Record<string, unknown> } | undefined)?.fields ?? {};
    const definedColumns = Object.keys(fields).sort();
    const columns = definedColumns.length > 0 ? definedColumns : (sampledColumnsByName.get(name) ?? []);
    if (carried.has(name)) {
      return {
        name,
        columns,
        columnCount: columns.length,
        rowCount: carried.get(name)!,
        rowCountApproximate: true,
        // Overwritten on read by `latestSnapshot()`'s lookup — see there for why.
        createdAt: null,
      };
    }
    return {
      name,
      columns,
      columnCount: columns.length,
      rowCount: countByName.get(name) ?? null,
      rowCountApproximate: false,
      createdAt: null,
    };
  });

  const snapshot: SchemaSnapshot = { id: randomUUID(), takenAt: new Date().toISOString(), tables };
  saveSnapshot(target.key, snapshot);

  if (!previous) {
    // First-ever snapshot: nothing to diff against. Not an error, not a
    // fabricated diff — there is genuinely no prior state to compare to.
    return { snapshot, diff: null };
  }

  const nowByName = new Map(tables.map((t) => [t.name, t]));
  const tablesAdded = tables.filter((t) => !previousByName.has(t.name)).map((t) => t.name);
  const tablesRemoved = [...previousByName.keys()].filter((n) => !nowByName.has(n));

  const tablesChanged: SchemaTableChange[] = [];
  for (const [name, prevTable] of previousByName) {
    const nowTable = nowByName.get(name);
    if (!nowTable) continue; // already counted in tablesRemoved
    const columnsAdded = nowTable.columns.filter((c) => !prevTable.columns.includes(c));
    const columnsRemoved = prevTable.columns.filter((c) => !nowTable.columns.includes(c));
    // A carried-forward (approximate) row count did not change BY DEFINITION
    // — it is the same number restated, not a fresh measurement — so it must
    // never register as a row-count change. Only compare when both sides are
    // real counts.
    const rowCountChanged =
      !nowTable.rowCountApproximate &&
      !prevTable.rowCountApproximate &&
      nowTable.rowCount !== prevTable.rowCount;
    if (columnsAdded.length === 0 && columnsRemoved.length === 0 && !rowCountChanged) continue;
    tablesChanged.push({
      table: name,
      columnsAdded,
      columnsRemoved,
      rowCountBefore: prevTable.rowCount,
      rowCountAfter: nowTable.rowCount,
    });
  }

  const diff: SchemaSnapshotDiff = {
    id: randomUUID(),
    fromSnapshot: previous.id,
    toSnapshot: snapshot.id,
    at: snapshot.takenAt,
    tablesAdded,
    tablesRemoved,
    tablesChanged,
  };
  saveDiff(target.key, diff);
  // Order matters only in the pathological case of a table dropped and
  // recreated inside one tick, which cannot happen — a name is in exactly one
  // of the two lists. Recording first, clearing second is still the safer
  // order if that ever changes: a wrongly-kept timestamp is a stale fact,
  // a wrongly-cleared one is a lost one.
  if (tablesAdded.length > 0) recordTablesFirstSeen(target.key, tablesAdded, diff.at);
  if (tablesRemoved.length > 0) clearTablesFirstSeen(target.key, tablesRemoved);

  return { snapshot, diff };
}
