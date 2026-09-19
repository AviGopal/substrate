/**
 * "Known wrong with this interface", in full. Route `/gaps`.
 *
 * The badge on every other page (`GapBadge`) is the summary; this is the
 * actual list plus the complaint form, moved here so it stops being one of
 * the largest fixed blocks on the board and the run page while staying one
 * click away from both.
 */
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { GapStrip } from "../components/GapStrip";

export function GapsPage(): ReactNode {
  return (
    <>
      <Link to="/" className="sf-back-link">
        ← back to the board
      </Link>
      <GapStrip />
    </>
  );
}
