/**
 * shape-watch: local SQLite log — snapshots + diffs of the discovery-vessel
 * shape vocabulary over time, owned by THIS vessel, mirroring
 * ../schema-watch/store.ts's pattern exactly but for a much simpler shape: a
 * snapshot is just a sorted list of shape names, and a diff is just what got
 * added/removed between two snapshots. Not a SurrealDB table on the shared
 * hub store, for the same reason schema-watch isn't: this is operator-facing
 * observability (is the substrate's own capability vocabulary actually
 * growing?), not substrate learning-loop data.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface ShapeSnapshot {
  readonly id: string;
  readonly takenAt: string;
  readonly shapes: readonly string[];
}

export interface ShapeSnapshotDiff {
  readonly id: string;
  readonly fromSnapshot: string | null;
  readonly toSnapshot: string;
  readonly at: string;
  readonly shapesAdded: readonly string[];
  readonly shapesRemoved: readonly string[];
}

const DB_PATH = process.env["SHAPE_WATCH_SQLITE_PATH"] ?? "./data/shape-watch.sqlite";

function openDb(): Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS shape_snapshot (
      id TEXT PRIMARY KEY,
      taken_at TEXT NOT NULL,
      shapes_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shape_snapshot_diff (
      id TEXT PRIMARY KEY,
      from_snapshot TEXT,
      to_snapshot TEXT NOT NULL,
      at TEXT NOT NULL,
      diff_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shape_first_seen (
      name TEXT PRIMARY KEY,
      first_seen_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_shape_snapshot_taken_at ON shape_snapshot(taken_at);
    CREATE INDEX IF NOT EXISTS idx_shape_snapshot_diff_at ON shape_snapshot_diff(at);
  `);
  return db;
}

let db: Database | null = null;
function getDb(): Database {
  if (!db) db = openDb();
  return db;
}

export function saveShapeSnapshot(snapshot: ShapeSnapshot): void {
  getDb()
    .query("INSERT INTO shape_snapshot (id, taken_at, shapes_json) VALUES (?, ?, ?)")
    .run(snapshot.id, snapshot.takenAt, JSON.stringify(snapshot.shapes));
}

export function saveShapeDiff(diff: ShapeSnapshotDiff): void {
  getDb()
    .query("INSERT INTO shape_snapshot_diff (id, from_snapshot, to_snapshot, at, diff_json) VALUES (?, ?, ?, ?, ?)")
    .run(
      diff.id,
      diff.fromSnapshot,
      diff.toSnapshot,
      diff.at,
      JSON.stringify({ shapesAdded: diff.shapesAdded, shapesRemoved: diff.shapesRemoved }),
    );
}

function firstSeenOf(name: string): string | null {
  const row = getDb().query("SELECT first_seen_at FROM shape_first_seen WHERE name = ?").get(name) as
    | { first_seen_at: string }
    | null;
  return row?.first_seen_at ?? null;
}

/** Called once per name in a diff's `shapesAdded` — the moment a new shape was actually observed. */
export function recordShapesFirstSeen(names: readonly string[], at: string): void {
  const stmt = getDb().query("INSERT OR IGNORE INTO shape_first_seen (name, first_seen_at) VALUES (?, ?)");
  for (const name of names) stmt.run(name, at);
}

/** Called on `shapesRemoved` — a dropped shape's next appearance is genuinely new, not a resurrection of the old timestamp. */
export function clearShapesFirstSeen(names: readonly string[]): void {
  const stmt = getDb().query("DELETE FROM shape_first_seen WHERE name = ?");
  for (const name of names) stmt.run(name);
}

export function latestShapeSnapshot(): ShapeSnapshot | null {
  const row = getDb()
    .query("SELECT id, taken_at, shapes_json FROM shape_snapshot ORDER BY taken_at DESC LIMIT 1")
    .get() as { id: string; taken_at: string; shapes_json: string } | null;
  if (!row) return null;
  return { id: row.id, takenAt: row.taken_at, shapes: JSON.parse(row.shapes_json) as string[] };
}

export function recentShapeDiffs(limit: number): ShapeSnapshotDiff[] {
  const rows = getDb()
    .query("SELECT id, from_snapshot, to_snapshot, at, diff_json FROM shape_snapshot_diff ORDER BY at DESC LIMIT ?")
    .all(limit) as { id: string; from_snapshot: string | null; to_snapshot: string; at: string; diff_json: string }[];
  return rows.map((row) => {
    const parsed = JSON.parse(row.diff_json) as { shapesAdded: string[]; shapesRemoved: string[] };
    return {
      id: row.id,
      fromSnapshot: row.from_snapshot,
      toSnapshot: row.to_snapshot,
      at: row.at,
      shapesAdded: parsed.shapesAdded,
      shapesRemoved: parsed.shapesRemoved,
    };
  });
}

export function shapeFirstSeen(name: string): string | null {
  return firstSeenOf(name);
}
