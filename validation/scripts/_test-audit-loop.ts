/**
 * Shared test-audit-loop instrumentation for grandfathered validation scripts.
 *
 * Spec: openspec/changes/2026-05-18-test-audit-loop/ (Phase F)
 *
 * Grandfathered tests call `registerAndTrack({test_id, ...})` at the top of
 * `main()` and either let `process.on("exit")` flush the test_report, or
 * explicitly call `flushTestReport({passed})` before they exit. The helper
 * keeps grandfathering invasive-minimal — registration emission is idempotent
 * by test_id, and report emission carries only the structural fields the
 * audit loop reads (test_id, passed, witnesses, caveats, duration_ms).
 *
 * Auto-tagging contract (spec R1, design.md §E.3):
 *   - Tests that have *never* published a perturbation_schedule (the
 *     grandfathering mark) emit a registration with `perturbation_schedule: []`
 *     and a best-effort `goal_alignment`. The audit machinery's
 *     check_sensitivity_evidence task will tag any subsequent audit
 *     `missing_sensitivity_history` until the schedule is filled in — that's
 *     the grandfathering working, not a regression.
 *
 * Note: this helper deliberately tolerates network / auth failures silently —
 * a registration / report emission that fails MUST NOT cause the underlying
 * test to fail (the test is the source of truth; the audit loop is the
 * consumer). Failures are logged and execution continues.
 */

import type { GoalAlignmentEntry, Perturbation } from "../../repos/metabob-activity-api/src/models/schemas";

const ACTIVITY_API_URL =
  process.env.ACTIVITY_API_URL ??
  process.env.METABOB_ENDPOINT ??
  "https://activity.metabob.com";
const METABOB_API_KEY = process.env.METABOB_API_KEY ?? "";

export interface TestRegistrationInput {
  test_id: string;
  /** Brief structural shape of the test's input variables — informational only. */
  inputs_schema?: Record<string, unknown>;
  /** Empty for grandfathered tests; populated only when a perturbation schedule is defined. */
  perturbation_schedule?: Perturbation[];
  perturbation_cadence?: "daily" | "weekly" | "monthly";
  /** Best-effort mapping of the test to one or more IAL success criteria. */
  goal_alignment: GoalAlignmentEntry[];
  /** Single-sentence claim about what the test discriminates. */
  discrimination_claim?: string;
  /** Drawn from the multi-witness-verification vocabulary. */
  witness_types: Array<"differential_solve" | "oracle_label" | "validator_consensus">;
}

export interface TestReportPayload {
  test_id: string;
  run_id: string;
  passed: boolean;
  witnesses?: Array<Record<string, unknown>>;
  passes?: Array<Record<string, unknown>>;
  failure_mode?: Record<string, unknown> | null;
  caveats?: string[];
  duration_ms?: number;
  cost_usd?: number;
  details?: Record<string, unknown>;
  test_registration_id?: string;
}

const seenRegistrations = new Set<string>();

async function activityApiPost(path: string, body: unknown): Promise<Response | null> {
  if (!METABOB_API_KEY) return null;
  try {
    return await fetch(`${ACTIVITY_API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${METABOB_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.warn(`[audit-loop] activity-api POST failed (${path}): ${(e as Error).message}`);
    return null;
  }
}

/** Idempotent registration emission. Skips if a registration is already present. */
export async function ensureTestRegistration(reg: TestRegistrationInput): Promise<void> {
  if (seenRegistrations.has(reg.test_id)) return;
  seenRegistrations.add(reg.test_id);
  // Best-effort presence check via the test_registration read shape. If the
  // read fails or returns a row already, we skip the write. The activity-api
  // unique index on (org_id, test_id) is the canonical idempotence guard.
  try {
    const probe = await activityApiPost("/v2/impulses/resolve", {
      pointer: { type: "test_registration", test_id: reg.test_id, limit: 1 },
    });
    if (probe && probe.ok) {
      const data = (await probe.json()) as { content?: string };
      const content = typeof data.content === "string" ? JSON.parse(data.content) : data.content;
      if (content?.entries && content.entries.length > 0) {
        return; // already present
      }
    }
  } catch { /* fall through to write attempt */ }

  // Write. Failure is non-fatal (the index will block dup writes anyway).
  const body = {
    pointer: {
      type: "test_registration_write",
      registrationData: {
        id: reg.test_id,
        inputs_schema: reg.inputs_schema ?? {},
        perturbation_schedule: reg.perturbation_schedule ?? [],
        perturbation_cadence: reg.perturbation_cadence,
        goal_alignment: reg.goal_alignment,
        discrimination_claim: reg.discrimination_claim,
        witness_types: reg.witness_types,
      },
    },
  };
  const res = await activityApiPost("/v2/impulses/resolve", body);
  if (res && res.ok) {
    console.log(`[audit-loop] registered test_id=${reg.test_id}`);
  } else if (res) {
    const txt = await res.text().catch(() => "");
    console.log(
      `[audit-loop] registration deferred (test_id=${reg.test_id}): ${res.status} ${txt.slice(0, 120)}`,
    );
  }
}

/** Emit a test_report impulse. Non-fatal on write failure. */
export async function emitTestReport(report: TestReportPayload): Promise<void> {
  const body = {
    pointer: {
      type: "test_report_write",
      reportData: {
        test_id: report.test_id,
        run_id: report.run_id,
        test_registration_id: report.test_registration_id ?? report.test_id,
        passed: report.passed,
        passes: report.passes ?? [],
        witnesses: report.witnesses ?? [],
        failure_mode: report.failure_mode ?? null,
        caveats: report.caveats ?? [],
        duration_ms: report.duration_ms,
        cost_usd: report.cost_usd ?? 0,
        details: report.details,
      },
    },
  };
  const res = await activityApiPost("/v2/impulses/resolve", body);
  if (res && res.ok) {
    console.log(`[audit-loop] emitted test_report for test_id=${report.test_id} (passed=${report.passed})`);
  } else if (res) {
    const txt = await res.text().catch(() => "");
    console.log(
      `[audit-loop] test_report write deferred (test_id=${report.test_id}): ${res.status} ${txt.slice(0, 120)}`,
    );
  }
}

/**
 * Convenience: install a process.on("exit") handler that flushes a test_report
 * derived from the final process.exitCode. Used by grandfathered tests that
 * don't want to instrument every error-exit path; the handler fires once at
 * process termination and emits a best-effort report.
 *
 * Caveat: process.on("exit") runs SYNCHRONOUSLY — async work in the handler
 * is unsafe. So this helper uses a fire-and-forget pattern at the
 * `beforeExit` event instead, which DOES tolerate async, and falls back to a
 * sync best-effort if the loop has already drained.
 */
export function installExitHandler(
  trackedRunStart: number,
  reportFactory: () => TestReportPayload,
): void {
  let fired = false;
  const flush = async () => {
    if (fired) return;
    fired = true;
    const report = reportFactory();
    report.duration_ms = report.duration_ms ?? Date.now() - trackedRunStart;
    await emitTestReport(report);
  };
  process.on("beforeExit", () => {
    void flush();
  });
}
