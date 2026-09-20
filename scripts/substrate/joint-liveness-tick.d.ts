/**
 * joint-liveness-tick.ts — a detector for the write→read-severed CLASS.
 *
 * The dominant defect class in this substrate is a writer with no live reader:
 * `activity_execution_traces` frozen 42 days while the self-observation layer kept
 * querying it; `decision_outcome` sitting empty; the composition graph a batch
 * artifact. Each instance got patched by hand; nothing detected the class.
 *
 * This is the class detector (law 6). For every (table, time column, max lag)
 * binding that SHOULD co-advance with live fleet activity, it asserts the table's
 * newest write is within `maxLagSec` of the newest `execution` row. A bound table
 * frozen while `execution` is live is the exact frozen-table signature. Each
 * severed joint emits a `substrateGap`.
 *
 * META-GUARD (law: a detector must be proven to COMPLETE, not just exist): if the
 * fleet is active (execution is fresh) but ZERO bindings were successfully checked,
 * the detector emits a gap about ITSELF — otherwise a detector that silently checks
 * nothing is the newest check-that-cannot-fail, the very thing it exists to catch.
 *
 * Strictly read-only except substrateGap emission. Add a binding here whenever a
 * new reader→table dependency is wired; the binding list IS the shaped dependency
 * graph the walk cannot yet see.
 */
export {};
//# sourceMappingURL=joint-liveness-tick.d.ts.map