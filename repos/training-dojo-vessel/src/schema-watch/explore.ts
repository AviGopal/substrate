/**
 * Table Explorer's backend half — fetch, and now create/edit/delete, rows in
 * ONE named table on demand, over the same SSH+SurrealDB route `runSurrealQL`
 * already uses for scanning. Reads are never cached, never pre-loaded, and
 * never run until a reader explicitly asks. Writes are gated at TWO layers on
 * purpose — here (defense in depth) and again in `routes/proxy.ts` (the
 * actual security boundary, since that is where a request originates): a
 * `DbTarget.editable === false` target (the substrate's own
 * `activity-system/learning_loop`) must never be reachable from a generic
 * row editor, full stop — CLAUDE.md is explicit that this database is never
 * hand-edited outside a migration. `training-dojo/lessonbook` is this
 * vessel's own data and editable — the Lessonbook UI already writes to it
 * through its own routes; this is the same data through a second door, not a
 * new privilege.
 */
import { isSafeIdent, runSurrealQL } from "./surreal.js";
import type { DbTarget } from "./targets.js";

export const EXPLORER_MAX_ROWS = 500;

function resultOf(stmt: { status: "OK" | "ERR"; result?: unknown } | undefined): unknown {
  return stmt?.status === "OK" ? stmt.result : undefined;
}

function assertEditable(target: DbTarget): void {
  if (!target.editable) {
    throw new Error(`'${target.label}' is read-only — this vessel will not hand-edit the substrate's own database`);
  }
}

export interface TableRowsResult {
  readonly table: string;
  readonly rows: readonly Record<string, unknown>[];
  readonly limit: number;
  readonly fetchedAt: string;
}

/**
 * `limit` is clamped, not refused — a reader asking for 5000 rows almost
 * certainly wants "as many as you'll give me", and 500 is a real answer to
 * that rather than an error over a preference.
 */
export async function fetchTableRows(target: DbTarget, tableName: string, limit: number): Promise<TableRowsResult> {
  if (!isSafeIdent(tableName)) {
    throw new Error(`'${tableName}' is not a table name this explorer will query`);
  }
  const clamped = Math.max(1, Math.min(EXPLORER_MAX_ROWS, Math.trunc(limit) || 1));
  const results = await runSurrealQL(`SELECT * FROM ${tableName} LIMIT ${clamped};`, { ns: target.ns, db: target.db });
  const rows = (resultOf(results[0]) as Record<string, unknown>[] | undefined) ?? [];
  return { table: tableName, rows, limit: clamped, fetchedAt: new Date().toISOString() };
}

/** A brand-new row, with a SurrealDB-assigned id. */
export async function createTableRow(target: DbTarget, tableName: string, fields: Record<string, unknown>): Promise<Record<string, unknown>> {
  assertEditable(target);
  if (!isSafeIdent(tableName)) throw new Error(`'${tableName}' is not a table name this explorer will write to`);
  const results = await runSurrealQL(`CREATE ${tableName} CONTENT ${JSON.stringify(fields)};`, { ns: target.ns, db: target.db });
  const rows = (resultOf(results[0]) as Record<string, unknown>[] | undefined) ?? [];
  const row = rows[0];
  if (!row) throw new Error("the row was not created");
  return row;
}

/**
 * `recordId` is the EXACT `id` field a prior `fetchTableRows`/`createTableRow`
 * call returned (e.g. `dojo_lesson:⟨abc-123⟩`) — never re-derived from a
 * bare id, so this can never target a different table than the one it was
 * read from by accident.
 */
export async function updateTableRow(target: DbTarget, tableName: string, recordId: string, fields: Record<string, unknown>): Promise<Record<string, unknown>> {
  assertEditable(target);
  if (!isSafeIdent(tableName)) throw new Error(`'${tableName}' is not a table name this explorer will write to`);
  if (!recordId.startsWith(`${tableName}:`)) throw new Error(`record id does not belong to table '${tableName}'`);
  const results = await runSurrealQL(`UPDATE ${recordId} MERGE ${JSON.stringify(fields)};`, { ns: target.ns, db: target.db });
  const rows = (resultOf(results[0]) as Record<string, unknown>[] | undefined) ?? [];
  const row = rows[0];
  if (!row) throw new Error("the row was not found");
  return row;
}

export async function deleteTableRow(target: DbTarget, tableName: string, recordId: string): Promise<void> {
  assertEditable(target);
  if (!isSafeIdent(tableName)) throw new Error(`'${tableName}' is not a table name this explorer will write to`);
  if (!recordId.startsWith(`${tableName}:`)) throw new Error(`record id does not belong to table '${tableName}'`);
  await runSurrealQL(`DELETE ${recordId};`, { ns: target.ns, db: target.db });
}
