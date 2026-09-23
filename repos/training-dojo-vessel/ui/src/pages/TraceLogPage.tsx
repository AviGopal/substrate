/**
 * ONE LESSON, its own page. Route `/trace/$dispatchId`.
 *
 * This is the "how does the agent think" view: `DetailPanel` already renders,
 * in order, what was asked, the honest `reached` verdict, every impulse the
 * walk produced, and the walk log. What this page adds beyond that content is
 * `DbChangePanel` — the piece specific to teaching database work: a way to
 * check what actually landed in SurrealDB and, in one click, turn what you
 * saw into the next lesson (`Link ... search={{redo: goal}}`, read back by
 * `LessonsPage`). Addressable, shareable, survives a reload; the back link is
 * the only way out, same reasoning `Surface` gives for its hidden `h1`: one
 * purposeful control, not navigation furniture.
 */
import { Link, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DbChangePanel } from "../components/DbChangePanel";
import { DetailPanel } from "../components/DetailPanel";
import { useWalk } from "../api/queries";
import { useLiveControls } from "../state/liveControls";

export function TraceLogPage(): ReactNode {
  const { dispatchId } = useParams({ from: "/trace/$dispatchId" });
  const { paused, intervalMs } = useLiveControls();
  // Shares DetailPanel's own query (same key) — this does not add a second
  // poll cadence, it only reads the goal text for the correction link once
  // DetailPanel's own fetch has populated the cache.
  const walk = useWalk(dispatchId, { enabled: !paused, intervalMs });

  return (
    <>
      <Link to="/" className="sf-back-link">
        ← back to lessons
      </Link>
      <DetailPanel dispatchId={dispatchId} />
      {walk.data && walk.data.status !== "running" ? (
        <section className="sf-region" aria-label="Database changes">
          <div className="sf-region-body">
            <DbChangePanel goal={walk.data.goal ?? null} />
          </div>
        </section>
      ) : null}
    </>
  );
}
