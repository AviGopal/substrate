/**
 * coherence-recover keeps the MOST-EXERCISED member of a duplicate family (check-first).
 *
 * coherence-recover.ts collapses byte-identical activities and keeps the member with the most executions, ranked by
 * execN, a map of 30-day execution counts keyed by the view's bare activity_id ("dup-b"). It looked each member up with
 * the activity RECORD id ("activity:⟨dup-b⟩"), so every lookup missed, every count read 0, and the "canonical" kept was
 * whichever member the query returned first. Measured on node 1, 2026-10-07 (post-rebuild-probes.sh coherence): the
 * script found 0 counts where 802 exist, and its own log shows 813 live runs since 06-20 demoting 20,871 activities.
 *
 * The real script runs in a child bun in dry-run mode (RECOVER_DRY=1) with a preload that answers its two /sql reads
 * from fixtures and turns its metrics append into a no-op, so a test run can never write the live
 * /workspace/metrics/coherence-recover.jsonl.
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "../../scripts/substrate/coherence-recover.ts");
type Report = { dry_run: boolean; demoted: number; families_collapsed: number; families_with_counts?: number;
  top: Array<{ family_size: number; kept: string; demoted: number }> };

function run(activities: unknown[], counts: unknown[]): Report {
  const dir = mkdtempSync(join(tmpdir(), "coherence-recover-"));
  try {
    const pre = join(dir, "stub.ts");
    writeFileSync(pre, `
      const A = ${JSON.stringify(activities)}; const N = ${JSON.stringify(counts)};
      globalThis.fetch = (async (_u, init) => {
        const q = String(init?.body ?? "");
        const result = /FROM activity WHERE proposed/.test(q) ? A : /v_paradigm_execution_traces/.test(q) ? N : [];
        return new Response(JSON.stringify([{ status: "OK", result }]), { status: 200 });
      });
      Bun.write = (async () => 0);
    `);
    const r = Bun.spawnSync([process.execPath, "--preload", pre, SCRIPT], {
      env: { HOME: process.env.HOME ?? "", PATH: process.env.PATH ?? "", RECOVER_DRY: "1", SURREAL_PASS: "x" },
      stdout: "pipe", stderr: "pipe",
    });
    const out = r.stdout.toString();
    const start = out.indexOf("{");
    expect(start, `no report: ${r.stderr.toString().slice(0, 400)}`).toBeGreaterThanOrEqual(0);
    return JSON.parse(out.slice(start, out.lastIndexOf("}") + 1)) as Report;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const body = { input_shapes: ["gapReport"], output_shapes: ["gapClosure"], tasks: [{ resolver: "llm", config: { m: 1 }, prompt: { template: "close it" } }] };
// The query returns the LESS-exercised member first, so a lookup that misses keeps it.
const FAMILY = [{ id: "activity:⟨dup-a⟩", ...body }, { id: "activity:⟨dup-b⟩", ...body }];
const COUNTS = [{ activity_id: "dup-a", n: 1 }, { activity_id: "dup-b", n: 50 }];

describe("coherence-recover keeps the most-exercised member", () => {
  it("MUST-FAIL: of two byte-identical activities, the one with 50 executions is kept, not the first returned", () => {
    const r = run(FAMILY, COUNTS);
    expect(r.dry_run).toBe(true);
    expect(r.families_collapsed).toBe(1);
    expect(r.top[0]!.kept).toBe("activity:⟨dup-b⟩");
  });

  it("MUST-FAIL: the report says how many collapsed families found a count for the member they kept", () => {
    const r = run(FAMILY, COUNTS);
    expect(r.families_with_counts).toBe(1);
  });

  it("CONTROL: activities with different behaviour are not collapsed", () => {
    const r = run([{ id: "activity:⟨x⟩", ...body }, { id: "activity:⟨y⟩", ...body, output_shapes: ["other"] }], COUNTS);
    expect(r.families_collapsed).toBe(0);
    expect(r.demoted).toBe(0);
  });
});
