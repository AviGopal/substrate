/**
 * THE ROOT LAYOUT — everything every page shares, and nothing else.
 *
 * Five pages now (lessons / trace / tables / diffs / gaps; see `router.tsx`),
 * not one — but the things that were never any one page's to begin with
 * still belong here: the render-policy read that lets this surface change
 * itself live, and the heading a reader lands on.
 *
 * A fixed LEFT sidebar, not a top bar: this surface is meant to be lived in
 * across a whole teaching session (give a lesson, watch it, check the
 * database, correct it, repeat) rather than visited once for an answer — a
 * persistent rail keeps every page one click away through that whole loop
 * instead of scrolling a top bar out of view. `GapBadge` sits at the foot of
 * it, the same deliberate furniture it always was: "known wrong with this
 * interface" must stay visible from wherever a reader is.
 */

import { Link, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { GapBadge } from "./components/GapBadge";
import { useRenderPolicy } from "./api/queries";
import { useLiveControls } from "./state/liveControls";
import { useTokenOverrides } from "./lib/useTokenOverrides";

export function Surface(): ReactNode {
  // The live behaviour impulse, applied to :root at use time. An override
  // written while this page is open repaints it without a reload — which is how
  // a legibility fix becomes visible to the person the fix is for.
  const { paused, intervalMs } = useLiveControls();
  const policy = useRenderPolicy({ enabled: !paused, intervalMs }).data;
  useTokenOverrides(policy?.tokenOverrides);

  return (
    <>
      {/* Purely decorative — the bamboo motif's floating layer (see styles.css).
          `aria-hidden` and the CSS's own `pointer-events: none` keep sixteen
          empty spans out of the accessibility tree and out of the way of every
          real interaction on the page. */}
      <div className="sf-bamboo-leaves" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className="sf-bamboo-leaf" />
        ))}
      </div>
      <div className="sf-shell">
        <nav className="sf-sidebar" aria-label="Dojo pages">
          {/* The document had no visible heading at all before this — a screen
              reader's outline had no root, and there was nothing on screen
              naming the room a reader is in. A sidebar earns a real, visible
              brand mark where the old hidden `h1` only earned a root. */}
          <h1 className="sf-sidebar-brand">Training Dojo</h1>
          <div className="sf-sidebar-links">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              className="sf-dojo-nav-link"
              activeProps={{ className: "active" }}
            >
              Lessons
            </Link>
            <Link to="/tables" className="sf-dojo-nav-link" activeProps={{ className: "active" }}>
              Tables
            </Link>
            <Link to="/diffs" className="sf-dojo-nav-link" activeProps={{ className: "active" }}>
              Diff history
            </Link>
            <Link to="/lessonbook" className="sf-dojo-nav-link" activeProps={{ className: "active" }}>
              Lessonbook
            </Link>
            <Link to="/explorer" className="sf-dojo-nav-link" activeProps={{ className: "active" }}>
              Table Explorer
            </Link>
          </div>
          <div className="sf-sidebar-foot">
            <GapBadge />
          </div>
        </nav>
        <main className="sf-app">
          <Outlet />
        </main>
      </div>
    </>
  );
}
