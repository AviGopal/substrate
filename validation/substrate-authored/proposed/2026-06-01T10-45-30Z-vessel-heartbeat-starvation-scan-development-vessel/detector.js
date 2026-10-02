"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_VESSELS = void 0;
exports.resolveVesselHeartbeatStarvationScan = resolveVesselHeartbeatStarvationScan;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
exports.DEFAULT_VESSELS = [
    "goal-host-vessel",
    "development-vessel",
    "activity-api",
    "concept-db",
    "analysis-vessel",
    "llm-resolver-vessel",
    "discovery-vessel",
    "ribosome-vessel",
    "boredom-vessel",
    "identity-vessel",
];
const DEFAULT_DEV_VESSEL_URL = "http://127.0.0.1:8090/v2/impulses/resolve";
const DEFAULT_STATE_PATH = "/workspace/.heartbeat-starvation-detector/state.json";
const DEFAULT_MAX_EMITS = 20;
const DEFAULT_FAILURE_THRESHOLD_10MIN = 30;
const DEFAULT_FAILURE_THRESHOLD_60MIN = 100;
const DEFAULT_REEMIT_WINDOW_MINUTES = 60;
const realPorts = {
    journalctlFailures: async (unit) => {
        try {
            const proc = Bun.spawn([
                "journalctl",
                "-u",
                unit.endsWith(".service") ? unit : `${unit}.service`,
                "-n",
                "500",
                "--no-pager",
                "-o",
                "short-iso",
            ], { stdout: "pipe", stderr: "pipe" });
            const stdout = await new Response(proc.stdout).text();
            const code = await proc.exited;
            if (code !== 0)
                return null;
            const lines = stdout.split("\n");
            let count10min = 0;
            let count60min = 0;
            let oldestLineTime = null;
            let newestLineTime = null;
            const now = Date.now();
            const tenMinMs = 10 * 60 * 1000;
            const sixtyMinMs = 60 * 60 * 1000;
            for (const line of lines) {
                if (!line.includes("DiscoveryRegistrationLoop") ||
                    !line.match(/fail|error|404|timeout|unreachable/i)) {
                    continue;
                }
                const isoMatch = line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
                if (!isoMatch)
                    continue;
                const timestamp = new Date(isoMatch[0]).getTime();
                if (isNaN(timestamp))
                    continue;
                const delta = now - timestamp;
                if (delta <= tenMinMs)
                    count10min++;
                if (delta <= sixtyMinMs)
                    count60min++;
                if (!newestLineTime)
                    newestLineTime = isoMatch[0];
                oldestLineTime = isoMatch[0];
            }
            if (count10min === 0 && count60min === 0)
                return null;
            let window = "";
            if (count10min >= 30) {
                window = "10min";
            }
            else if (count60min >= 100) {
                window = "60min";
            }
            else {
                return null;
            }
            return {
                count: window === "10min" ? count10min : count60min,
                window,
                oldestLineTime,
                newestLineTime,
            };
        }
        catch {
            return null;
        }
    },
    readCache: async (path) => {
        try {
            const raw = await (0, promises_1.readFile)(path, "utf8");
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object")
                return parsed;
            return {};
        }
        catch {
            return {};
        }
    },
    writeCache: async (path, data) => {
        await (0, promises_1.mkdir)((0, node_path_1.dirname)(path), { recursive: true });
        const tmp = `${path}.tmp`;
        await (0, promises_1.writeFile)(tmp, JSON.stringify(data, null, 2), "utf8");
        const { rename } = await import("node:fs/promises");
        await rename(tmp, path);
    },
    postGap: async (url, body) => {
        const apiKey = process.env["METABOB_API_KEY"];
        const headers = { "Content-Type": "application/json" };
        if (apiKey)
            headers["Authorization"] = `ApiKey ${apiKey}`;
        try {
            const resp = await fetch(url, {
                method: "POST",
                headers,
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(10_000),
            });
            if (!resp.ok) {
                const text = await resp.text();
                return { ok: false, status: resp.status, error: text.slice(0, 200) };
            }
            return { ok: true, status: resp.status };
        }
        catch (err) {
            return { ok: false, status: "error", error: err.message };
        }
    },
};
async function resolveVesselHeartbeatStarvationScan(pointer, ports = realPorts) {
    const vessels = pointer.vessels && pointer.vessels.length > 0
        ? pointer.vessels
        : [...exports.DEFAULT_VESSELS];
    const emitUrl = pointer.devVesselImpulsesUrl ?? DEFAULT_DEV_VESSEL_URL;
    const statePath = pointer.statePath ?? DEFAULT_STATE_PATH;
    const dryRun = pointer.dry_run === true;
    const maxEmits = pointer.maxEmits ?? DEFAULT_MAX_EMITS;
    const failureThreshold10min = pointer.failureThreshold10min ?? DEFAULT_FAILURE_THRESHOLD_10MIN;
    const failureThreshold60min = pointer.failureThreshold60min ?? DEFAULT_FAILURE_THRESHOLD_60MIN;
    const reemitWindowMinutes = pointer.reemitWindowMinutes ?? DEFAULT_REEMIT_WINDOW_MINUTES;
    const cache = await ports.readCache(statePath);
    const nextCache = { ...cache };
    const findings = [];
    const today = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const reemitWindowMs = reemitWindowMinutes * 60 * 1000;
    let scanned = 0;
    let probeFailures = 0;
    for (const vessel of vessels) {
        const context = await ports.journalctlFailures(vessel);
        if (context == null) {
            probeFailures += 1;
            continue;
        }
        scanned += 1;
        const prior = cache[vessel];
        const reasons = [];
        let shouldEmit = false;
        if (context.window === "10min" && context.count >= failureThreshold10min) {
            reasons.push(`${context.count} consecutive failures in 10min (threshold: ${failureThreshold10min})`);
            shouldEmit = true;
        }
        else if (context.window === "60min" &&
            context.count >= failureThreshold60min) {
            reasons.push(`${context.count} consecutive failures in 60min (threshold: ${failureThreshold60min})`);
            shouldEmit = true;
        }
        if (prior && prior.alreadyEmittedAt) {
            const emittedMs = new Date(prior.alreadyEmittedAt).getTime();
            if (nowMs - emittedMs < reemitWindowMs) {
                shouldEmit = false;
            }
        }
        nextCache[vessel] = {
            lastScannedAt: nowIso,
            failureCount: context.count,
            alreadyEmittedAt: prior?.alreadyEmittedAt ?? null,
        };
        if (!shouldEmit || reasons.length === 0)
            continue;
        findings.push({
            vessel,
            failureContext: context,
            reasons,
            gap_id: `vessel-heartbeat-starvation-${vessel}-${today}`,
            posted: false,
        });
    }
    findings.sort((a, b) => b.failureContext.count - a.failureContext.count);
    const toEmit = findings.slice(0, maxEmits);
    if (!dryRun) {
        for (const entry of toEmit) {
            const body = {
                impulse: {
                    pointer: {
                        type: "substrateGap_write",
                        gap: {
                            id: entry.gap_id,
                            category: "missing_idiom",
                            source: "substrate_detected",
                            summary: `Vessel ${entry.vessel} DiscoveryRegistrationLoop has failed ` +
                                `${entry.failureContext.count} consecutive times within ${entry.failureContext.window}; ` +
                                `vessel is unreachable via discovery but may be alive on /health. ` +
                                `Root: registry eviction, stale vessel_id, or transient discovery connectivity loss ` +
                                `(concept_dD1udnb-sQnD, concept_9ldsmRgqSTd5).`,
                            detected_at: nowIso,
                            status: "open",
                            classification_metadata: {
                                gap_subtype: "vessel_heartbeat_starvation",
                                vessel_id: entry.vessel,
                                failure_count: entry.failureContext.count,
                                window_minutes: entry.failureContext.window === "10min" ? 10 : 60,
                                oldest_failure_timestamp: entry.failureContext.oldestLineTime,
                                newest_failure_timestamp: entry.failureContext.newestLineTime,
                                fix_priors: [
                                    "concept_dD1udnb-sQnD",
                                    "concept_9ldsmRgqSTd5",
                                    "concept_RYl73llSCGfc",
                                    "concept_U1GbuEbgtcM7",
                                ],
                            },
                        },
                    },
                },
            };
            const resp = await ports.postGap(emitUrl, body);
            entry.posted = resp.ok;
            entry.post_status = resp.status;
            if (!resp.ok && resp.error)
                entry.post_error = resp.error;
            if (resp.ok) {
                nextCache[entry.vessel] = {
                    ...nextCache[entry.vessel],
                    alreadyEmittedAt: nowIso,
                };
            }
        }
    }
    try {
        await ports.writeCache(statePath, nextCache);
    }
    catch {
        // swallow
    }
    return {
        shape: "vesselHeartbeatStarvationReport",
        body: {
            scanned,
            probe_failures: probeFailures,
            vessels_with_findings: findings.length,
            emitted: toEmit.filter((f) => f.posted).length,
            findings: toEmit,
            dry_run: dryRun,
            thresholds: {
                failures_10min: failureThreshold10min,
                failures_60min: failureThreshold60min,
                reemit_window_minutes: reemitWindowMinutes,
            },
            completed_at: nowIso,
        },
    };
}
//# sourceMappingURL=detector.js.map