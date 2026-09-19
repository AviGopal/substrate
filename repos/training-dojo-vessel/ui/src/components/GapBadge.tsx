/**
 * The compact form of `GapStrip`, for every page that is not `/gaps` itself.
 *
 * Splitting the surface into pages (board / run / gaps) moved the full gap
 * list off the board and the run page — it was one of the largest single
 * blocks of vertical space on both, and it is about the INTERFACE, not about
 * whatever the reader came to that page to do. But "known wrong with this
 * interface" is exactly the kind of fact that must stay visible from
 * everywhere, not buried behind a page nobody thinks to visit — so this is a
 * standing link, not a removal. It shares `useInterfaceGaps`'s query cache
 * with the full page: arriving at `/gaps` from here renders instantly from
 * what this badge already fetched.
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useInterfaceGaps } from "../api/queries";
import { useLiveControls } from "../state/liveControls";

export function GapBadge(): ReactNode {
  // No region-freeze here on purpose: this is a standing link, not a panel a
  // reader lingers in and reads dense content from, so there is nothing for
  // hovering it to protect. It still respects the shared pause control.
  const { paused, intervalMs } = useLiveControls();
  const q = useInterfaceGaps({ enabled: !paused, intervalMs });
  const gaps = q.data ?? [];
  const openCount = gaps.filter((g) => g.status !== "closed").length;

  return (
    <Link to="/gaps" className="sf-gap-badge" data-attention={openCount > 0 ? "true" : "false"}>
      {q.isError ? (
        "known wrong: unreadable"
      ) : (
        <>
          {openCount} open · {gaps.length - openCount} closed
          <span className="sf-muted"> — known wrong with this interface</span>
        </>
      )}
    </Link>
  );
}
