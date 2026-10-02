#!/usr/bin/env bun
"use strict";
/**
 * substrate-explicit-vessels-check.ts
 *
 * Gate harness for IAL §27.3.g (explicit-vessel coverage).
 * Checks that all substrate vessels are active and responds to health probes.
 *
 * Usage:
 *   bun run validation/scripts/substrate-explicit-vessels-check.ts
 *   bun run validation/scripts/substrate-explicit-vessels-check.ts --gate 27.3.g.2
 *
 * Exit codes:
 *   0 — all checked gates pass
 *   1 — one or more gates failed (details logged to stdout)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const CONTAINER = process.env.SUBSTRATE_CONTAINER ?? 'substrate-live';
const BASE_URL = process.env.SUBSTRATE_BASE_URL ?? 'http://localhost:18080';
const GATE_FILTER = process.argv.find((a) => a.startsWith('--gate'))?.split('=')[1]
    ?? process.argv[process.argv.indexOf('--gate') + 1];
// ---- helpers ----------------------------------------------------------------
function exec(cmd) {
    try {
        const out = (0, child_process_1.execSync)(cmd, { encoding: 'utf8', timeout: 15_000 }).trim();
        return { ok: true, out };
    }
    catch (e) {
        return { ok: false, out: String(e?.stdout ?? e?.message ?? '') };
    }
}
async function healthCheck(url) {
    try {
        const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const body = await r.text();
        return { ok: r.ok, body };
    }
    catch (e) {
        return { ok: false, body: String(e?.message ?? e) };
    }
}
function dockerExec(cmd) {
    return exec(`docker exec ${CONTAINER} ${cmd}`);
}
// ---- gate checks ------------------------------------------------------------
function check_g1() {
    // Gate 27.3.g.1: no in-process execution path remains.
    // Verify goal-host-bridge.ts is deleted from minibob.
    const bridgePath = 'repos/minibob/src/goal-host-bridge.ts';
    if ((0, fs_1.existsSync)(bridgePath)) {
        return { gate: '27.3.g.1', pass: false, detail: `${bridgePath} still exists — bridge not deleted` };
    }
    // Verify processor.ts has no GOAL_RUNTIME env branch.
    const processorPath = 'repos/minibob/src/cli/processor.ts';
    if ((0, fs_1.existsSync)(processorPath)) {
        const src = (0, fs_1.readFileSync)(processorPath, 'utf8');
        if (src.includes('GOAL_RUNTIME')) {
            return { gate: '27.3.g.1', pass: false, detail: 'GOAL_RUNTIME gate still present in processor.ts' };
        }
    }
    return { gate: '27.3.g.1', pass: true, detail: 'goal-host-bridge.ts deleted; GOAL_RUNTIME gate removed' };
}
async function check_g2() {
    // Gate 27.3.g.2: thompson_posterior resolves correctly via impulse path.
    const config = JSON.parse((0, fs_1.readFileSync)('~/.metabob/config.json', 'utf8').replace(/~/, process.env.HOME ?? ''));
    const apiKey = config?.metabob?.apiKey ?? process.env.METABOB_API_KEY;
    if (!apiKey) {
        return { gate: '27.3.g.2', pass: false, detail: 'No API key found in ~/.metabob/config.json or METABOB_API_KEY' };
    }
    // Activity variant that definitely has executions (use a known system template)
    const endpoint = `${BASE_URL}/v2/impulses/resolve`;
    try {
        const r = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `ApiKey ${apiKey}` },
            body: JSON.stringify({ impulse: { pointer: { type: 'thompson_posterior', activity_variant_id: 'topology-discovery' } } }),
            signal: AbortSignal.timeout(10_000),
        });
        const body = await r.json();
        if (!r.ok) {
            return { gate: '27.3.g.2', pass: false, detail: `HTTP ${r.status}: ${JSON.stringify(body).slice(0, 200)}` };
        }
        if (!body.success) {
            return { gate: '27.3.g.2', pass: false, detail: `impulse resolve failed: ${body.error}` };
        }
        return { gate: '27.3.g.2', pass: true, detail: `thomson_posterior resolves: ${body.content?.slice(0, 100)}` };
    }
    catch (e) {
        return { gate: '27.3.g.2', pass: false, detail: `fetch error: ${e?.message}` };
    }
}
async function check_g3() {
    // Gate 27.3.g.3: all explicit vessels active inside the container.
    const vessels = [
        { name: 'goal-host-vessel', port: 8210 },
        { name: 'llm-resolver-vessel', port: 8220 },
        { name: 'local-tools-vessel', port: 8230 },
        { name: 'ribosome-vessel', port: 8240 },
        { name: 'concept-db', port: 8260 },
        { name: 'boredom-vessel.timer', port: null },
        { name: 'bootstrap-seeder', port: null },
    ];
    const failures = [];
    for (const v of vessels) {
        const { ok, out } = dockerExec(`systemctl is-active ${v.name}`);
        const active = out.trim() === 'active';
        if (!active) {
            failures.push(`${v.name}: ${out.trim() || (ok ? 'inactive' : 'error')}`);
        }
    }
    // Health endpoints for vessels with HTTP ports
    for (const v of vessels.filter((v) => v.port != null)) {
        const h = await healthCheck(`http://localhost:${v.port}/health`);
        if (!h.ok)
            failures.push(`${v.name} health: ${h.body.slice(0, 100)}`);
    }
    if (failures.length > 0) {
        return { gate: '27.3.g.3', pass: false, detail: failures.join('; ') };
    }
    return { gate: '27.3.g.3', pass: true, detail: 'all vessels active and health-ok' };
}
async function check_g5() {
    // Gate 27.3.g.5: boredom-vessel traces carry intent:topology_discovery tag.
    const config = JSON.parse((0, fs_1.readFileSync)((process.env.HOME ?? '') + '/.metabob/config.json', 'utf8'));
    const apiKey = config?.metabob?.apiKey ?? process.env.METABOB_API_KEY;
    if (!apiKey) {
        return { gate: '27.3.g.5', pass: false, detail: 'No API key — cannot query traces' };
    }
    const r = await fetch(`${BASE_URL}/v2/activities/execution-traces?limit=50`, {
        headers: { Authorization: `ApiKey ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
    }).catch((e) => ({ ok: false, json: async () => ({ error: e?.message }) }));
    const body = await r.json?.() ?? {};
    const traces = body?.traces ?? body?.data ?? [];
    const tagged = traces.filter((t) => Array.isArray(t.tags) && t.tags.includes('intent:topology_discovery'));
    if (tagged.length === 0) {
        return { gate: '27.3.g.5', pass: false, detail: `No traces with intent:topology_discovery in last 50 (got ${traces.length} traces)` };
    }
    return { gate: '27.3.g.5', pass: true, detail: `${tagged.length} traces carry intent:topology_discovery tag` };
}
// ---- main -------------------------------------------------------------------
const GATES = {
    '27.3.g.1': check_g1,
    '27.3.g.2': check_g2,
    '27.3.g.3': check_g3,
    '27.3.g.5': check_g5,
};
async function main() {
    const toRun = GATE_FILTER
        ? { [GATE_FILTER]: GATES[GATE_FILTER] }
        : GATES;
    if (GATE_FILTER && !GATES[GATE_FILTER]) {
        console.error(`Unknown gate: ${GATE_FILTER}. Available: ${Object.keys(GATES).join(', ')}`);
        process.exit(1);
    }
    const results = [];
    for (const [gate, fn] of Object.entries(toRun)) {
        console.log(`Checking ${gate}...`);
        const result = await fn();
        results.push(result);
        console.log(`  ${result.pass ? '✅' : '❌'} ${gate}: ${result.detail}`);
    }
    const failed = results.filter((r) => !r.pass);
    if (failed.length > 0) {
        console.log(`\n${failed.length}/${results.length} gate(s) failed.`);
        process.exit(1);
    }
    console.log(`\n${results.length}/${results.length} gate(s) passed.`);
    process.exit(0);
}
main();
//# sourceMappingURL=substrate-explicit-vessels-check.js.map