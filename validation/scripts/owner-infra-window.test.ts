// owner-infra-window.test.ts: the one-shot owner script writes one infra_window row only for a well-formed span of what
// already happened, that no live window covers, with statuses and a reason; anything else is refused and nothing written.
import { expect, test } from "bun:test";
import { parseArgs, plan } from "../../scripts/substrate/owner-infra-window";

const ok = { windowId: "outage-1", from: 53168, to: 53835, statuses: [404], reason: "USER-approved: provider credit outage, written by deployment" };
const why = (r: ReturnType<typeof plan>) => (r.ok ? "" : r.why);

test("[MUST-FAIL] a well-formed span of the past is planned as one owner row with every field", () => {
  const r = plan(ok, 60000, []);
  expect(r).toEqual({ ok: true, row: { shape: "infra_window", window_id: "outage-1", from_seq: 53168, to_seq: 53835, statuses: [404], reason: ok.reason, input_refs: [] } });
});

test("[MUST-FAIL] a span past the head, an inverted span, a malformed status list and an empty reason are refused", () => {
  expect(why(plan(ok, 53000, []))).toContain("past the store's head");
  expect(why(plan({ ...ok, from: 9, to: 3 }, 60000, []))).toContain("is after");
  for (const statuses of [[], [4040], [404.5], [Number.NaN]]) expect(why(plan({ ...ok, statuses }, 60000, []))).toContain("statuses must be");
  expect(why(plan({ ...ok, reason: "  " }, 60000, []))).toContain("reason is required");
});

test("[MUST-FAIL] an overlap with a live window, or a live window_id, is refused; a retracted one is not in the way", () => {
  const live = { shape: "infra_window", window_id: "w-old", from_seq: 53000, to_seq: 53200, statuses: [404] };
  expect(why(plan(ok, 60000, [live]))).toContain("overlaps live window w-old");
  expect(why(plan(ok, 60000, [{ ...live, window_id: "outage-1", from_seq: 1, to_seq: 2 }]))).toContain("already live with other fields");
  // the retraction keeps the live span, so only the retracted filter can let the new window through (qa)
  expect(plan(ok, 60000, [live, { ...live, retracted: true }]).ok).toBe(true);
});

test("[MUST-FAIL] a live row with an empty span (from after to) is in no window's way", () => {
  const empty = { shape: "infra_window", window_id: "restart-53500-53499", from_seq: 53500, to_seq: 53499, statuses: [0] };
  expect(plan(ok, 60000, [empty]).ok).toBe(true);
  expect(why(plan(ok, 60000, [empty, { ...empty, window_id: "restart-53500-53501", to_seq: 53501 }]))).toContain("overlaps live window restart-53500-53501");
});

test("arguments parse into the plan's fields; --write is explicit", () => {
  const a = parseArgs(["--window-id", "w", "--from", "1", "--to", "2", "--statuses", "404, 402", "--reason", "r"]);
  expect(a).toEqual({ windowId: "w", from: 1, to: 2, statuses: [404, 402], reason: "r", write: false });
  expect(parseArgs(["--write"]).write).toBe(true);
});

test("[MUST-FAIL] a rerun of the same window finds it present and plans no second row (qa: idempotent)", () => {
  const written = { shape: "infra_window", id: "row-9", window_id: "outage-1", from_seq: 53168, to_seq: 53835, statuses: [404], reason: ok.reason };
  const r = plan(ok, 60000, [written]);
  expect(r.ok && r.present).toBe("row-9");
});
