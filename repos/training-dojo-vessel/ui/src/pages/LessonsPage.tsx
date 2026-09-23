/**
 * THE DOJO FLOOR — give the agent a lesson, and watch it land. Route `/`.
 *
 * A lesson IS a `run_goal_async` dispatch (`AskRegion`'s guts are unchanged
 * from human-surface-vessel's board — only its copy is relabeled); what
 * differs from that surface's board is what happens next. There, dispatching
 * something stays on the same page so a reader watches it arrive in a list.
 * Here the whole point is watching the agent WORK, so a successful dispatch
 * navigates straight to `/trace/$dispatchId` instead — the list of past
 * lessons is still one click away below, for the run that already finished
 * before you looked back.
 */
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AskRegion } from "../components/AskRegion";
import { RunsRegion } from "../components/RunsRegion";

export function LessonsPage(): ReactNode {
  const navigate = useNavigate();
  const { redo } = useSearch({ from: "/" });
  const open = (dispatchId: string): void => {
    void navigate({ to: "/trace/$dispatchId", params: { dispatchId } });
  };

  return (
    <>
      <AskRegion onDispatched={open} initialGoal={redo} />
      <RunsRegion selectedDispatchId={null} onSelect={open} />
    </>
  );
}
