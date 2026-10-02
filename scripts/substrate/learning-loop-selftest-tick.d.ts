/**
 * learning-loop-selftest-tick.ts — does the execution→learning chain actually conduct?
 *
 * The expectation, from docs/validation/LEARNING_LOOP_SELFTEST.md: the full
 * execution→learning chain conducts, and that is verifiable on demand by a probe
 * whose outcome is known BY CONSTRUCTION — never by re-reading the system's own
 * reports, because a channel's reporting is not evidence about the channel.
 *
 * WHY THIS EXISTS. Every link below was observed broken at some point in the week
 * before this file was written: the verdict tag written before the grade-check so
 * tagged rows stranded; grading in-process at three sites leaving 95.5% ungraded;
 * a gap measured closed 29 minutes before its fix landed; a detector reporting
 * "healthy" from a sample selected by the health it measures. Each was found by an
 * operator following one execution by hand. This is that walk, automated.
 *
 * WHY BOOTSTRAP TIER AND NOT THE ROTATION. The design document places probe
 * templates on the autonomous rotation. The 2026-09-09 validator census refutes
 * that: 90 of 102 selection-scheduled validators had gone dormant, every survivor
 * being timer-driven. A selftest scheduled by the learning loop it validates is
 * the circularity CLAUDE.md already names when it exempts the liveness watchdogs —
 * a check cannot be scheduled by the mechanism it exists to recover. The RUNNER is
 * timer-tier; the PROBES it dispatches still travel the real lanes, which is the
 * whole point.
 *
 * IT ASSERTS, IT DOES NOT REPAIR. Red links are emitted as gaps carrying CLASS-2
 * behavioural predicates (`evidence_resolve` as an object with a `shape`). Class-1
 * literal predicates are not used here on purpose: one was satisfied on 2026-09-10
 * by the word appearing inside a COMMENT, closing a gap that had repaired nothing.
 *
 * NO LLM IN THE ASSERTION PATH. Every assertion below is a deterministic read of a
 * store. The probe itself may invoke models; judging whether the chain conducted
 * must not.
 *
 * PROVING IT CAN GO RED. `--controls` runs every assertion against synthetic
 * evidence — one clean case that must be all-green, and one deliberately severed
 * case per link that must turn EXACTLY its own link red. It touches no store. A
 * selftest never proven to go red is just another detector reporting health, which
 * is the exact class this file exists to catch. Severing a real link in the running
 * fleet stays a manual operator exercise and is deliberately not automated here.
 *
 * Read-only except substrateGap emission and the probe dispatch it makes.
 */
type Link = "trace_write" | "verdict_delivery" | "posterior_delta" | "goal_path" | "confinement";
type Assertion = {
    link: Link;
    ok: boolean;
    detail: string;
};
/**
 * Everything the assertions read, gathered once so the assertions themselves are
 * pure — which is what makes the offline controls possible.
 */
export type Evidence = {
    probeExecutions: Array<Record<string, unknown>>;
    gradedCount: number;
    probeArmDelta: {
        alphaBefore: number;
        alphaAfter: number;
        betaBefore: number;
        betaAfter: number;
    } | null;
    goalPathRows: number;
    nonProbeArmsMoved: number;
    nonProbeArmsSampled: number;
};
/**
 * THE ASSERTIONS. Each answers one link's question at the layer that CONSUMES the
 * artifact, and each is a pure function so `--controls` can drive it with synthetic
 * evidence. Order matches the design document's table.
 */
export declare function evaluate(e: Evidence): Assertion[];
export {};
//# sourceMappingURL=learning-loop-selftest-tick.d.ts.map