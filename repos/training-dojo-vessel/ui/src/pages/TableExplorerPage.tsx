/**
 * TABLE EXPLORER — pick a database, pick a table, pick a row count, press
 * Fetch. Route `/explorer`.
 *
 * Nothing here preloads rows. The table PICKER reads the last schema
 * snapshot's table names for the SELECTED database (`useSchemaSnapshot`,
 * already cached by the Tables page if you've visited it — a list of names,
 * not row data) so the dropdown has something to offer, but the actual
 * `SELECT * FROM <table> LIMIT k` only ever runs the instant a reader presses
 * Fetch (`useTableRows`, a mutation — see its own comment for why a mutation
 * and not a query). No poll, no cache, no re-fetch on its own.
 *
 * Create/edit/delete are offered ONLY when the selected database's own
 * `DbTarget.editable` says so (`training-dojo/lessonbook`, this vessel's own
 * data) — the server refuses these calls for any other target regardless of
 * what this page sends, but the controls are hidden here too so a reader is
 * never invited to try something that can only fail. See `schema-watch/
 * explore.ts` for the actual safety boundary.
 */
import { Link } from "@tanstack/react-router";
import { Fragment, useState, type ReactNode } from "react";
import { DbTargetPicker } from "../components/DbTargetPicker";
import { useCreateTableRow, useDbTargets, useDeleteTableRow, useSchemaSnapshot, useTableRows, useUpdateTableRow } from "../api/queries";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** The row's own fields, minus `id` — `id` is addressed separately (`recordId`), never re-sent as a field to write. */
function editableFieldsOf(row: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...rest } = row;
  return rest;
}

function RowEditor({
  initial,
  onCancel,
  onSave,
  saving,
}: {
  initial: Record<string, unknown>;
  onCancel: () => void;
  onSave: (fields: Record<string, unknown>) => void;
  saving: boolean;
}): ReactNode {
  const [text, setText] = useState(() => JSON.stringify(initial, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  const submit = (): void => {
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setParseError("must be a JSON object");
        return;
      }
      setParseError(null);
      onSave(parsed as Record<string, unknown>);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "invalid JSON");
    }
  };

  return (
    <div className="sf-book-inline-form">
      <textarea
        className="sf-textarea sf-mono"
        style={{ minHeight: "8rem" }}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {parseError ? <p className="sf-error">{parseError}</p> : null}
      <div style={{ display: "flex", gap: "var(--sf-space-2)" }}>
        <button type="button" className="sf-button" disabled={saving} onClick={submit}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="sf-button sf-button-quiet" onClick={onCancel}>
          cancel
        </button>
      </div>
    </div>
  );
}

export function TableExplorerPage(): ReactNode {
  const targets = useDbTargets();
  const [targetKey, setTargetKey] = useState<string | undefined>(undefined);
  const activeTarget = targets.data?.find((t) => t.key === targetKey) ?? targets.data?.[0];
  const editable = activeTarget?.editable ?? false;

  const snapshot = useSchemaSnapshot(targetKey, false);
  const [table, setTable] = useState("");
  const [limitInput, setLimitInput] = useState(String(DEFAULT_LIMIT));
  const rows = useTableRows();
  const createRow = useCreateTableRow();
  const updateRow = useUpdateTableRow();
  const deleteRow = useDeleteTableRow();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const tableNames = (snapshot.data?.tables ?? []).map((t) => t.name);
  const parsedLimit = Math.max(1, Math.min(MAX_LIMIT, Number.parseInt(limitInput, 10) || DEFAULT_LIMIT));

  const fetchRows = (): void => {
    if (table.trim().length === 0) return;
    setEditingId(null);
    setCreating(false);
    rows.mutate({ table: table.trim(), limit: parsedLimit, targetKey });
  };

  const refetch = (): void => {
    if (table.trim().length > 0) rows.mutate({ table: table.trim(), limit: parsedLimit, targetKey });
  };

  const columns =
    rows.data && rows.data.rows.length > 0
      ? Array.from(
          rows.data.rows.reduce((set, r) => {
            for (const k of Object.keys(r)) set.add(k);
            return set;
          }, new Set<string>()),
        )
      : [];

  return (
    <section className="sf-region" aria-labelledby="sf-explorer-title">
      <div className="sf-region-head">
        <h2 className="sf-region-title" id="sf-explorer-title">
          Table Explorer
        </h2>
        <DbTargetPicker value={targetKey} onChange={setTargetKey} />
      </div>
      <div className="sf-region-body" style={{ display: "flex", flexDirection: "column", gap: "var(--sf-space-3)" }}>
        <p className="sf-note sf-muted">
          Nothing loads until you press Fetch — picking a table or changing the row count never
          runs a query on its own.
          {activeTarget ? (
            editable ? (
              <> This database ({activeTarget.label}) is ours — new/edit/delete are available below.</>
            ) : (
              <> {activeTarget.label} is the substrate's own live data — read-only here, by design.</>
            )
          ) : null}
        </p>

        <div style={{ display: "flex", gap: "var(--sf-space-2)", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label className="sf-label" htmlFor="sf-explorer-table">
              Table
            </label>
            {tableNames.length > 0 ? (
              <select
                id="sf-explorer-table"
                className="sf-input"
                value={table}
                onChange={(e) => setTable(e.target.value)}
              >
                <option value="">— pick a table —</option>
                {tableNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="sf-explorer-table"
                className="sf-input"
                placeholder="table name"
                value={table}
                onChange={(e) => setTable(e.target.value)}
              />
            )}
          </div>
          <div>
            <label className="sf-label" htmlFor="sf-explorer-limit">
              Rows (k)
            </label>
            <input
              id="sf-explorer-limit"
              className="sf-input"
              style={{ width: "6rem" }}
              type="number"
              min={1}
              max={MAX_LIMIT}
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="sf-button sf-button-primary"
            disabled={rows.isPending || table.trim().length === 0}
            onClick={fetchRows}
          >
            {rows.isPending ? "Fetching…" : "Fetch"}
          </button>
        </div>

        {tableNames.length === 0 ? (
          <p className="sf-note sf-muted">
            No table list yet — visit <Link to="/tables">Tables</Link> and scan once, or type a
            table name directly above.
          </p>
        ) : null}

        {rows.isError ? <p className="sf-error">Not fetched: {(rows.error as Error).message}.</p> : null}

        {rows.data ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "var(--sf-space-2)" }}>
              <p className="sf-note sf-mono">
                {rows.data.table} · {rows.data.rows.length} row{rows.data.rows.length === 1 ? "" : "s"} (limit{" "}
                {rows.data.limit}) · fetched {new Date(rows.data.fetchedAt).toLocaleTimeString()}
              </p>
              {editable ? (
                <button type="button" className="sf-button" onClick={() => setCreating((v) => !v)}>
                  {creating ? "cancel new row" : "+ new row"}
                </button>
              ) : null}
            </div>

            {creating ? (
              <RowEditor
                initial={{}}
                saving={createRow.isPending}
                onCancel={() => setCreating(false)}
                onSave={(fields) => {
                  createRow.mutate(
                    { table: rows.data.table, targetKey: rows.data.target.key, fields },
                    { onSuccess: () => { setCreating(false); refetch(); } },
                  );
                }}
              />
            ) : null}
            {createRow.isError ? <p className="sf-error">Not created: {(createRow.error as Error).message}.</p> : null}

            {rows.data.rows.length === 0 ? (
              <p className="sf-empty">This table has no rows, or none within the limit requested.</p>
            ) : (
              <div className="sf-scroll-x">
                <table className="sf-table">
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                      {editable ? <th>—</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.data.rows.map((r, i) => {
                      const recordId = typeof r["id"] === "string" ? r["id"] : null;
                      const isEditing = editable && recordId !== null && editingId === recordId;
                      return (
                        <Fragment key={i}>
                          <tr>
                            {columns.map((c) => (
                              <td key={c} className="sf-mono sf-explorer-cell" title={formatCell(r[c])}>
                                {formatCell(r[c]).slice(0, 200)}
                              </td>
                            ))}
                            {editable ? (
                              <td>
                                {recordId ? (
                                  <div style={{ display: "flex", gap: "var(--sf-space-1)" }}>
                                    <button type="button" className="sf-button sf-button-quiet" onClick={() => setEditingId(isEditing ? null : recordId)}>
                                      {isEditing ? "close" : "edit"}
                                    </button>
                                    <button
                                      type="button"
                                      className="sf-button sf-button-quiet"
                                      disabled={deleteRow.isPending}
                                      onClick={() => {
                                        if (!window.confirm(`Delete this row (${recordId})? This cannot be undone.`)) return;
                                        deleteRow.mutate(
                                          { table: rows.data.table, targetKey: rows.data.target.key, recordId },
                                          { onSuccess: refetch },
                                        );
                                      }}
                                    >
                                      delete
                                    </button>
                                  </div>
                                ) : null}
                              </td>
                            ) : null}
                          </tr>
                          {isEditing && recordId ? (
                            <tr>
                              <td colSpan={columns.length + 1}>
                                <RowEditor
                                  initial={editableFieldsOf(r)}
                                  saving={updateRow.isPending}
                                  onCancel={() => setEditingId(null)}
                                  onSave={(fields) => {
                                    updateRow.mutate(
                                      { table: rows.data.table, targetKey: rows.data.target.key, recordId, fields },
                                      { onSuccess: () => { setEditingId(null); refetch(); } },
                                    );
                                  }}
                                />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {updateRow.isError ? <p className="sf-error">Not saved: {(updateRow.error as Error).message}.</p> : null}
            {deleteRow.isError ? <p className="sf-error">Not deleted: {(deleteRow.error as Error).message}.</p> : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
