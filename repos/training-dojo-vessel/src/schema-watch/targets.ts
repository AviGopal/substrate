/**
 * The fixed set of databases this vessel knows how to point Tables /
 * Diff-history / Table Explorer at. A short curated list rather than
 * "type any ns/db" freely everywhere: `editable` is a real safety gate (see
 * `routes/proxy.ts`'s write routes), not a UI label, and it must be decided
 * here — in one place both the read and write routes import — rather than
 * trusted from whatever a request claims.
 *
 * `activity-system/learning_loop` is the SUBSTRATE's own live learning-loop
 * database. CLAUDE.md is explicit: never hand-edit it outside a migration.
 * `training-dojo/lessonbook` is this vessel's OWN curriculum data (see
 * `../lessonbook/store.ts`) — ours to edit, which is exactly what the
 * Lessonbook UI already does through its own dedicated routes; exposing it
 * through Table Explorer too is the same data, a second door onto it, not a
 * new privilege.
 */

export interface DbTarget {
  readonly key: string;
  readonly ns: string;
  readonly db: string;
  readonly label: string;
  /** Whether Table Explorer's create/edit/delete routes will act on this target at all. */
  readonly editable: boolean;
}

function targetKey(ns: string, db: string): string {
  return `${ns}/${db}`;
}

export const DB_TARGETS: readonly DbTarget[] = [
  {
    key: targetKey("activity-system", "learning_loop"),
    ns: "activity-system",
    db: "learning_loop",
    label: "Substrate (activity-system / learning_loop)",
    editable: false,
  },
  {
    key: targetKey("training-dojo", "lessonbook"),
    ns: "training-dojo",
    db: "lessonbook",
    label: "Lessonbook (training-dojo / lessonbook)",
    editable: true,
  },
];

export const DEFAULT_TARGET: DbTarget = DB_TARGETS[0]!;

export function findTarget(key: string | undefined | null): DbTarget {
  return DB_TARGETS.find((t) => t.key === key) ?? DEFAULT_TARGET;
}
