/**
 * schema-watch: local SQLite log — snapshots + diffs, owned by THIS vessel.
 *
 * Deliberately not a SurrealDB table on the shared hub store: this is an
 * operator-facing observability log for one tool, not substrate learning-loop
 * data, and it should not need a hub-side deployment (a migration, a new
 * discovery shape) to exist or change shape. `bun:sqlite` is Bun's built-in
 * driver — no dependency, no network, one file on this vessel's own disk.
 *
 * Every row is now tagged with a `target` (a `DbTarget.key` from
 * `./targets.ts`, e.g. "activity-system/learning_loop") — Tables/Diff-history
 * can point at more than one database now, and a snapshot taken of one must
 * never surface as history for another.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DEFAULT_TARGET } from "./targets.js";

export interface SchemaSnapshotTable {
  name: string;
  columns: string[];
  columnCount: number;
  rowCount: number | null;
  rowCountApproximate: boolean;
  /**
   * When this table first appeared in a DIFF (a genuine, observed creation) —
   * `null` for a table that was already present in the very first snapshot
   * this vessel ever took, since nothing before that was ever observed to say
   * when it was actually created.
   */
  createdAt: string | null;
}

export interface SchemaSnapshot {
  id: string;
  takenAt: string;
  tables: SchemaSnapshotTable[];
}

export interface SchemaTableChange {
  table: string;
  columnsAdded: string[];
  columnsRemoved: string[];
  rowCountBefore: number | null;
  rowCountAfter: number | null;
}

export interface SchemaSnapshotDiff {
  id: string;
  fromSnapshot: string | null;
  toSnapshot: string;
  at: string;
  tablesAdded: string[];
  tablesRemoved: string[];
  tablesChanged: SchemaTableChange[];
}

const DB_PATH = process.env["SCHEMA_WATCH_SQLITE_PATH"] ?? "./data/schema-watch.sqlite";

function openDb(): Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");

  // Bare CREATE TABLE only — no indexes here. MEASURED BUG: a `CREATE INDEX
  // ... ON schema_snapshot(target, ...)` in this same multi-statement block
  // throws "no such column: target" against a pre-existing install, because
  // `CREATE TABLE IF NOT EXISTS` is a no-op on a table that already exists
  // (so the column never gets declared this way) while `CREATE INDEX`
  // evaluates the column reference immediately regardless of `IF NOT
  // EXISTS` — and that throw happens BEFORE the ALTER-based migration below
  // ever runs, so the column migration never even started. Indexes move
  // below, after the ALTERs, where the column is guaranteed to exist.
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_snapshot (
      id TEXT PRIMARY KEY,
      target TEXT NOT NULL DEFAULT '${DEFAULT_TARGET.key}',
      taken_at TEXT NOT NULL,
      tables_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS schema_snapshot_diff (
      id TEXT PRIMARY KEY,
      target TEXT NOT NULL DEFAULT '${DEFAULT_TARGET.key}',
      from_snapshot TEXT,
      to_snapshot TEXT NOT NULL,
      at TEXT NOT NULL,
      diff_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS table_first_seen (
      target TEXT NOT NULL DEFAULT '${DEFAULT_TARGET.key}',
      name TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      PRIMARY KEY (target, name)
    );
  `);

  // Pre-existing installs had no `target` column at all — `CREATE TABLE IF
  // NOT EXISTS` is a no-op against a table that already exists, so a fresh
  // ALTER is the only way an upgrade actually gets the column (see the
  // identical gotcha, and why it needs this exact check, in
  // `../lessonbook/store.ts`'s history).
  for (const [table, cols] of [
    ["schema_snapshot", ["target"]],
    ["schema_snapshot_diff", ["target"]],
    ["table_first_seen", ["target"]],
  ] as const) {
    const existing = new Set((db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name));
    for (const col of cols) {
      if (!existing.has(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT NOT NULL DEFAULT '${DEFAULT_TARGET.key}'`);
    }
  }

  // Indexes last, now that `target` is guaranteed to exist on every table.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_schema_snapshot_target_taken_at ON schema_snapshot(target, taken_at);
    CREATE INDEX IF NOT EXISTS idx_schema_snapshot_diff_target_at ON schema_snapshot_diff(target, at);
  `);

  return db;
}

let db: Database | null = null;
function getDb(): Database {
  if (!db) db = openDb();
  return db;
}

export function saveSnapshot(target: string, snapshot: SchemaSnapshot): void {
  getDb()
    .query("INSERT INTO schema_snapshot (id, target, taken_at, tables_json) VALUES (?, ?, ?, ?)")
    .run(snapshot.id, target, snapshot.takenAt, JSON.stringify(snapshot.tables));
}

export function saveDiff(target: string, diff: SchemaSnapshotDiff): void {
  getDb()
    .query(
      "INSERT INTO schema_snapshot_diff (id, target, from_snapshot, to_snapshot, at, diff_json) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      diff.id,
      target,
      diff.fromSnapshot,
      diff.toSnapshot,
      diff.at,
      JSON.stringify({
        tablesAdded: diff.tablesAdded,
        tablesRemoved: diff.tablesRemoved,
        tablesChanged: diff.tablesChanged,
      }),
    );
}

function firstSeenOf(target: string, name: string): string | null {
  const row = getDb().query("SELECT first_seen_at FROM table_first_seen WHERE target = ? AND name = ?").get(target, name) as
    | { first_seen_at: string }
    | null;
  return row?.first_seen_at ?? null;
}

/** Called once per name in a diff's `tablesAdded` — the moment a creation was actually observed. */
export function recordTablesFirstSeen(target: string, names: readonly string[], at: string): void {
  const stmt = getDb().query("INSERT OR IGNORE INTO table_first_seen (target, name, first_seen_at) VALUES (?, ?, ?)");
  for (const name of names) stmt.run(target, name, at);
}

/**
 * Called on `tablesRemoved` — a dropped table's next creation is a genuinely
 * new one, so its old timestamp must not survive to be misattributed to a
 * same-named table that shows up again later.
 */
export function clearTablesFirstSeen(target: string, names: readonly string[]): void {
  const stmt = getDb().query("DELETE FROM table_first_seen WHERE target = ? AND name = ?");
  for (const name of names) stmt.run(target, name);
}

export function latestSnapshot(target: string): SchemaSnapshot | null {
  const row = getDb()
    .query("SELECT id, taken_at, tables_json FROM schema_snapshot WHERE target = ? ORDER BY taken_at DESC LIMIT 1")
    .get(target) as { id: string; taken_at: string; tables_json: string } | null;
  if (!row) return null;
  const tables = JSON.parse(row.tables_json) as SchemaSnapshotTable[];
  for (const t of tables) t.createdAt = firstSeenOf(target, t.name);
  return { id: row.id, takenAt: row.taken_at, tables };
}

export function recentDiffs(target: string, limit: number): SchemaSnapshotDiff[] {
  const rows = getDb()
    .query(
      "SELECT id, from_snapshot, to_snapshot, at, diff_json FROM schema_snapshot_diff WHERE target = ? ORDER BY at DESC LIMIT ?",
    )
    .all(target, limit) as { id: string; from_snapshot: string | null; to_snapshot: string; at: string; diff_json: string }[];
  return rows.map((row) => {
    const parsed = JSON.parse(row.diff_json) as {
      tablesAdded: string[];
      tablesRemoved: string[];
      tablesChanged: SchemaTableChange[];
    };
    return {
      id: row.id,
      fromSnapshot: row.from_snapshot,
      toSnapshot: row.to_snapshot,
      at: row.at,
      tablesAdded: parsed.tablesAdded,
      tablesRemoved: parsed.tablesRemoved,
      tablesChanged: parsed.tablesChanged,
    };
  });
}
