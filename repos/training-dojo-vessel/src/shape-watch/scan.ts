/**
 * shape-watch: one scan-and-diff cycle for the discovery shape vocabulary.
 *
 * Reuses this vessel's own /api/discovery/shapes route rather than
 * re-deriving its local+hub union logic here — that route already reads both
 * registries, unions their shapes, and degrades correctly (still answers with
 * whichever registry is reachable) if one leg is down.
 */

import { randomUUID } from "node:crypto";
import { PORT } from "../config.js";
import {
  clearShapesFirstSeen,
  latestShapeSnapshot,
  recordShapesFirstSeen,
  saveShapeDiff,
  saveShapeSnapshot,
  type ShapeSnapshot,
  type ShapeSnapshotDiff,
} from "./store.js";

export async function runShapeScan(): Promise<{ snapshot: ShapeSnapshot; diff: ShapeSnapshotDiff | null }> {
  const previous = latestShapeSnapshot();
  const previousSet = new Set(previous?.shapes ?? []);

  const res = await fetch(`http://127.0.0.1:${PORT}/api/discovery/shapes`);
  const body = (await res.json().catch(() => null)) as { shapes?: unknown } | null;
  const shapes = Array.isArray(body?.shapes)
    ? [...new Set(body.shapes.filter((s): s is string => typeof s === "string"))].sort()
    : [];

  const snapshot: ShapeSnapshot = { id: randomUUID(), takenAt: new Date().toISOString(), shapes };
  saveShapeSnapshot(snapshot);

  if (!previous) {
    // First-ever snapshot: nothing to diff against.
    return { snapshot, diff: null };
  }

  const nowSet = new Set(shapes);
  const shapesAdded = shapes.filter((s) => !previousSet.has(s));
  const shapesRemoved = [...previousSet].filter((s) => !nowSet.has(s));

  // Always record a diff once a previous snapshot exists — even a +0/-0 one —
  // matching schema-watch's own pattern. Skipping the empty case here made
  // every steady-state tick's log line indistinguishable from "first
  // snapshot, no diff" even though a real (unchanged) comparison had just
  // been made; that ambiguity is the bug, not the empty diff itself.
  const diff: ShapeSnapshotDiff = {
    id: randomUUID(),
    fromSnapshot: previous.id,
    toSnapshot: snapshot.id,
    at: snapshot.takenAt,
    shapesAdded,
    shapesRemoved,
  };
  saveShapeDiff(diff);
  if (shapesAdded.length > 0) recordShapesFirstSeen(shapesAdded, diff.at);
  if (shapesRemoved.length > 0) clearShapesFirstSeen(shapesRemoved);

  return { snapshot, diff };
}
