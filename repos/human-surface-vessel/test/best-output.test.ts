/**
 * The best output of a run that did not reach, chosen deterministically from
 * what the surface can read: the judged walk-log excerpts per attempt, this
 * browser's copy of an attempt's pool, and the current pool.
 *
 * Fixtures are the walk logs of two live news-goal dispatches (10-01): one
 * produced a sourced, correctly dated report that was rejected, the other an
 * unfilled template and then invented headlines.
 */
import { describe, expect, test } from "bun:test";
import type { GoalWalkState, PoolEvent } from "../ui/src/api/types";
import { segmentAttempts } from "../ui/src/lib/attempts";
import { pickBestOutput, readableText } from "../ui/src/lib/bestOutput";
import fixtures from "./fixtures/best-output-walklogs.json";

const GOAL = "What is happening today?";
const T = 1_790_840_000_000;

function burst(at: number): PoolEvent[] {
  return [
    { shape: "goal", source: GOAL, at },
    { shape: "goal", source: "seed var goal", at },
    { shape: "dispatch_id", source: "seed var dispatch_id", at },
  ];
}

function walk(over: Partial<GoalWalkState>): GoalWalkState {
  return {
    dispatchId: "d-best",
    status: "failed",
    reached: false,
    goalReachReason: null,
    poolShapes: [],
    poolProvenance: [],
    pendingTargets: [],
    poolEvents: [...burst(T), ...burst(T + 100_000), ...burst(T + 200_000)],
    walkLog: [],
    currentStep: null,
    steps: [],
    executionPath: null,
    walkTier: null,
    attemptCount: null,
    grounded: null,
    learning: null,
    answerBody: null,
    operator: null,
    completionShapes: null,
    humanGraded: false,
    humanReachNotes: null,
    trigger: null,
    requeueOf: null,
    ...over,
  };
}

function fromFixture(key: "cea3f4a4" | "5bef2e86", id: string): GoalWalkState {
  const f = fixtures[key];
  return walk({ dispatchId: id, goalReachReason: f.goalReachReason, walkLog: f.walkLog });
}

describe("pickBestOutput", () => {
  test("a rejected, sourced report from the reported attempt is shown, unwrapped and labelled as an excerpt", () => {
    const w = fromFixture("cea3f4a4", "d-cea3");
    const segs = segmentAttempts(w);
    expect(segs.map((s) => s.reported)).toEqual([false, true, false]);
    const best = pickBestOutput(w, segs);
    expect(best).not.toBeNull();
    expect(best?.attempt).toBe(2);
    expect(best?.attempts).toBe(3);
    expect(best?.shape).toBe("llm_completion");
    expect(best?.text.startsWith("Today’s date: Thursday, 1 October 2026")).toBe(true);
    expect(best?.totalChars).toBe(4965);
    expect(best?.cut).toBe(true);
    expect(best?.source).toBe("walk_log_excerpt");
    expect(best?.verdict).toContain("overly generic");
  });

  test("an unfilled template is never chosen, and bookkeeping shapes are skipped", () => {
    const w = fromFixture("5bef2e86", "d-5bef");
    const segs = segmentAttempts(w);
    // Attempt 1's only output is "[Current Date] … Headline 1": no candidate there.
    expect(segs[0]?.judged.map((j) => j.shape)).toEqual(["llm_completion_result"]);
    const best = pickBestOutput(w, segs);
    expect(best?.attempt).toBe(2);
    expect(best?.shape).toBe("llm_completion_result");
    expect(best?.text.startsWith("Today is **Thursday, October 1, 2026**")).toBe(true);
    expect(best?.shape).not.toBe("activity_template");
  });

  test("when the reported attempt produced only a template, an earlier attempt's real output is shown", () => {
    const w = walk({
      dispatchId: "d-template",
      goalReachReason: "It only restates the request.",
      poolEvents: [...burst(T), ...burst(T + 100_000)],
      walkLog: [
        "[goal-host-vessel] walk(/run-goal): HOLLOW-CONTENT llm_completion (900 chars) = Thursday, 1 October 2026. Three headlines, each with a source.",
        "[goal-host-vessel] walk(/run-goal): HOLLOW — Too short.",
        "[goal-host-vessel] walk(/run-goal): HOLLOW-CONTENT llm_completion_result (719 chars) = text\n## Today's Report: [Current Date]\n\n1. **Headline 1**",
        "[goal-host-vessel] walk(/run-goal): HOLLOW — It only restates the request.",
      ],
    });
    const segs = segmentAttempts(w);
    expect(segs.map((s) => s.reported)).toEqual([false, true]);
    const best = pickBestOutput(w, segs);
    expect(best?.attempt).toBe(1);
    expect(best?.text.startsWith("Thursday, 1 October 2026")).toBe(true);
  });

  test("with no reported attempt, the latest attempt with output wins", () => {
    const w = fromFixture("cea3f4a4", "d-cea3-unreported");
    const best = pickBestOutput({ ...w, goalReachReason: "something else" }, segmentAttempts({ ...w, goalReachReason: "something else" }));
    expect(best?.attempt).toBe(3);
    expect(best?.shape).toBe("llm_completion");
  });

  test("this browser's longer copy of the same output beats the 400-character excerpt", () => {
    const longer = "Today’s date: Thursday, 1 October 2026\n" + "A full paragraph of the report. ".repeat(40);
    const w = walk({
      dispatchId: "d-browser",
      goalReachReason: "Rejected.",
      poolEvents: burst(T),
      walkLog: [
        `[goal-host-vessel] walk(/run-goal): HOLLOW-CONTENT llm_completion (4965 chars) = {"resolved":true,"shape":"llmCompletion","content":"Today’s date: Thursday`,
        "[goal-host-vessel] walk(/run-goal): HOLLOW — Rejected.; β-penalised last pick x",
      ],
      poolProvenance: [
        { shape: "llm_completion", contentPreview: JSON.stringify({ resolved: true, shape: "llmCompletion", content: longer }), chars: 4965, truncated: true },
      ],
    });
    const best = pickBestOutput(w, segmentAttempts(w));
    expect(best?.source).toBe("browser_copy");
    expect(best?.text).toBe(longer);
    expect(best?.totalChars).toBe(4965);
    expect(best?.cut).toBe(true);
  });

  test("bookkeeping, refusals and empty pools yield nothing to show", () => {
    const w = walk({
      dispatchId: "d-nothing",
      poolEvents: burst(T),
      walkLog: [
        '[goal-host-vessel] walk(/run-goal): HOLLOW-CONTENT activity_template (7247 chars) = {"success":true,"shape":"activity_template"',
        "[goal-host-vessel] walk(/run-goal): HOLLOW-CONTENT llm_completion (40 chars) = I'm sorry, I can't browse the web.",
        "[goal-host-vessel] walk(/run-goal): HOLLOW — Nothing useful.",
      ],
      poolProvenance: [{ shape: "dispatch_id", contentPreview: "d-nothing", chars: 9, truncated: false }],
    });
    expect(pickBestOutput(w, segmentAttempts(w))).toBeNull();
  });

  test("seeded variables are the request, not output, and are never shown as the best output", () => {
    const w = walk({
      dispatchId: "d-seeds",
      poolEvents: [
        { shape: "goal", source: GOAL, at: T },
        { shape: "operator", source: "seed var operator", at: T },
        { shape: "rhythm_id", source: "seed var rhythm_id", at: T },
      ],
      poolProvenance: [
        { shape: "operator", contentPreview: "learning-loop-selftest", chars: 22, truncated: false },
        { shape: "rhythm_id", contentPreview: "rhythm-federation-verification", chars: 30, truncated: false },
      ],
    });
    expect(pickBestOutput(w, segmentAttempts(w))).toBeNull();
  });

  test("with nothing judged, the current pool's answer-like preview is preferred over evidence", () => {
    const w = walk({
      dispatchId: "d-pool",
      status: "running",
      poolEvents: [
        ...burst(T),
        { shape: "web_search", source: "vessel-resolve satisfier (web_search)", at: T + 1 },
        { shape: "llm_completion", source: "vessel-resolve satisfier (llm_completion)", at: T + 2 },
      ],
      poolProvenance: [
        { shape: "web_search", contentPreview: '{"shape":"webSearchResult","results":[]}'.padEnd(900, " "), chars: 900, truncated: false },
        { shape: "llm_completion", contentPreview: "A short dated summary for 1 October 2026.", chars: 41, truncated: false },
      ],
    });
    const best = pickBestOutput(w, segmentAttempts(w));
    expect(best?.shape).toBe("llm_completion");
    expect(best?.source).toBe("pool_preview");
    expect(best?.cut).toBe(false);
  });
});

describe("readableText", () => {
  test("a whole envelope gives its content", () => {
    expect(readableText('{"resolved":true,"shape":"llmCompletion","content":"Hello\\nworld"}')).toEqual({ text: "Hello\nworld", cut: false });
  });
  test("a cut envelope gives the decoded prefix and says it is cut", () => {
    expect(readableText('{"resolved":true,"shape":"x","content":"caf\\u00e9 and more')).toEqual({ text: "café and more", cut: true });
  });
  test("a cut landing mid-escape drops the partial escape rather than inventing a character", () => {
    expect(readableText('{"shape":"x","content":"line one\\')).toEqual({ text: "line one", cut: true });
  });
  test("a cut object with no text member is shown as it is, marked cut", () => {
    const r = readableText('{"success":true,"shape":"memoryNote","body":{"notes":[{"id":"a"');
    expect(r.cut).toBe(true);
    expect(r.text.startsWith('{"success":true')).toBe(true);
  });
  test("plain text passes through, without goal-host's bare type prefix", () => {
    expect(readableText("text\n## Report")).toEqual({ text: "## Report", cut: false });
  });
});
