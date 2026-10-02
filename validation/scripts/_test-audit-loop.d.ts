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
/** Idempotent registration emission. Skips if a registration is already present. */
export declare function ensureTestRegistration(reg: TestRegistrationInput): Promise<void>;
/** Emit a test_report impulse. Non-fatal on write failure. */
export declare function emitTestReport(report: TestReportPayload): Promise<void>;
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
export declare function installExitHandler(trackedRunStart: number, reportFactory: () => TestReportPayload): void;
//# sourceMappingURL=_test-audit-loop.d.ts.map