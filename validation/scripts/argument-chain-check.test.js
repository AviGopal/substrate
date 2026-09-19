"use strict";
/**
 * DOES THE CHAIN ACTUALLY MOVE THE ARGUMENTS? — the end-to-end check, in one process.
 *
 * The argument-recording chain was declared closed twice and was inert both times. Every
 * component test passed on both occasions, because every component was correct; what was
 * broken was the JOIN between components, and a per-repo test cannot see a join that spans
 * two repos.
 *
 * So this harness runs the REAL code of both sides against one another:
 *
 *   engine record  ──▶  TranslatingTraceSink (real, ias-executor-ts)
 *                          │  captured at an injected fetch — the actual wire bytes
 *                          ▼
 *                  normalizePersistedTask (real, activity-api)   ── the write boundary
 *                          ▼
 *                  extractTasks           (real, activity-api)   ── the read projection
 *                          ▼
 *                  the config a ribosome extraction would copy
 *
 * Nothing here is a stub of the thing under test and no constant is copied between the
 * sides: the payload the store parses is the payload the sink serialized, byte for byte.
 *
 * WHAT THIS DOES AND DOES NOT PROVE. It proves the four in-process seams agree — which is
 * exactly what was broken, twice, and is the claim that had gone unverified. It does NOT
 * prove production behaviour: the deployed hub runs its own build, and a live trace has never
 * carried this field. That check is one goal dispatch plus one query, and it needs an
 * operator.
 *
 * Run: bun test validation/scripts/argument-chain-check.test.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
process.env.SURREALDB_NAMESPACE = "activity-system";
process.env.SURREALDB_DATABASE = "learning_loop";
const bun_test_1 = require("bun:test");
const activity_api_trace_sink_1 = require("../../repos/ias-executor-ts/src/adapters/activity-api-trace-sink");
const execution_traces_1 = require("../../repos/activity-api/src/routes/execution-traces");
const execution_trace_with_signatures_1 = require("../../repos/activity-api/src/routes/execution-trace-with-signatures");
/** The three argument shapes whose absence produced the measured replay failures. */
const CASES = [
    { resolver: "fs_read", config: { paths: ["/vessels/goal-host-vessel/src"] }, brokeWith: 'The "paths[0]" property must be of type string, got undefined' },
    { resolver: "http_fetch", config: { url: "https://ssd.jpl.nasa.gov/api/horizons.api?COMMAND=%27499%27" }, brokeWith: "invalid URL: undefined" },
    { resolver: "json_path_extract", config: { path: "result.data[0].vectors" }, brokeWith: "undefined is not an object (evaluating 'path.split')" },
];
/** Drives the real sink and returns the per-task objects it actually put on the wire. */
async function tasksOnTheWire(taskRecords) {
    let captured = null;
    const sink = new activity_api_trace_sink_1.TranslatingTraceSink("http://trace-sink.test", "test-key", {
        fetch: {
            request: async (_input, init) => {
                if (typeof init?.body === "string" && captured === null)
                    captured = init.body;
                return new Response(JSON.stringify({ ok: true }), { status: 200 });
            },
        },
    });
    await sink.record({
        id: "exec_chain_check",
        activityId: "chain-check",
        status: "completed",
        startedAt: new Date(0).toISOString(),
        completedAt: new Date(1000).toISOString(),
        tasks: taskRecords,
    });
    (0, bun_test_1.expect)(captured).not.toBeNull();
    const body = JSON.parse(captured);
    const tasks = (body.tasks ?? body.execution_trace?.tasks);
    (0, bun_test_1.expect)(Array.isArray(tasks)).toBe(true);
    return tasks;
}
(0, bun_test_1.describe)("argument chain — engine record to extractable config, across both repos", () => {
    (0, bun_test_1.test)("the harness drives the real sink and captures real wire bytes", async () => {
        const wire = await tasksOnTheWire([
            { taskId: "t1", resolverId: "fs_read", success: true, resolvedConfig: { paths: ["/a"] } },
        ]);
        // Guards the harness: if the sink stopped emitting tasks, every assertion below would
        // pass vacuously — the failure mode that hid the defect through four review rounds.
        (0, bun_test_1.expect)(wire.length).toBe(1);
        (0, bun_test_1.expect)(wire[0].task_id).toBe("t1");
    });
    (0, bun_test_1.test)("THE CLAIM: arguments survive sink -> write -> read, byte-exact", async () => {
        const wire = await tasksOnTheWire(CASES.map((c, i) => ({
            taskId: `t${i}`,
            resolverId: c.resolver,
            success: true,
            resolvedConfig: c.config,
        })));
        // Write boundary, then read projection — the real functions, fed the real payload.
        const persisted = wire.map(execution_traces_1.normalizePersistedTask);
        const projected = execution_trace_with_signatures_1._internals.extractTasks({ tasks: persisted });
        (0, bun_test_1.expect)(projected.length).toBe(CASES.length);
        for (const [i, c] of CASES.entries()) {
            const config = projected[i].config ?? {};
            for (const [k, v] of Object.entries(c.config)) {
                // Byte-exact: an argument that arrives altered replays as a subtly wrong call,
                // which is worse than one that is honestly absent.
                (0, bun_test_1.expect)(config[k]).toEqual(v);
            }
        }
    });
    (0, bun_test_1.test)("no task arrives as the argument-less {type} shell that broke replay", async () => {
        const wire = await tasksOnTheWire(CASES.map((c, i) => ({ taskId: `t${i}`, resolverId: c.resolver, success: true, resolvedConfig: c.config })));
        const projected = execution_trace_with_signatures_1._internals.extractTasks({ tasks: wire.map(execution_traces_1.normalizePersistedTask) });
        for (const t of projected) {
            // The measured symptom stated as an invariant: config == {"type": X} on 98 of 98 tasks.
            (0, bun_test_1.expect)(Object.keys(t.config ?? {})).not.toEqual(["type"]);
        }
    });
    (0, bun_test_1.test)("a task that genuinely ran without arguments is not given invented ones", async () => {
        const wire = await tasksOnTheWire([{ taskId: "t0", resolverId: "noop", success: true }]);
        const projected = execution_trace_with_signatures_1._internals.extractTasks({ tasks: wire.map(execution_traces_1.normalizePersistedTask) });
        const config = projected[0]?.config ?? {};
        // Fabricating arguments would be a false reach at the replay layer — the failure mode
        // this repository treats as worse than an honest miss.
        (0, bun_test_1.expect)(Object.keys(config).every((k) => k === "type")).toBe(true);
    });
    (0, bun_test_1.test)("a secret in a resolver's config never reaches the wire", async () => {
        const wire = await tasksOnTheWire([
            {
                taskId: "t0",
                resolverId: "http_fetch",
                success: true,
                resolvedConfig: { url: "https://x", authorization: "Bearer sk-live-SHOULD-NOT-APPEAR" },
            },
        ]);
        // The redactor runs in the engine, so this asserts the boundary the harness can see:
        // whatever reaches the wire must not carry the literal secret.
        (0, bun_test_1.expect)(JSON.stringify(wire)).not.toContain("sk-live-SHOULD-NOT-APPEAR");
    });
});
//# sourceMappingURL=argument-chain-check.test.js.map