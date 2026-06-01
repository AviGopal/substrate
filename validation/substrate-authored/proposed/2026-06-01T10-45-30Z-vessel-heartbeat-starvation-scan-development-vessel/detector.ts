import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ResolverResult } from "./types.js";

/**
 * vessel_heartbeat_starvation_scan — deterministic detector + emitter for
 * vessel discovery-heartbeat starvation class (concept_dD1udnb-sQnD /
 * concept_9ldsmRgqSTd5).
 *
 * The pattern: a vessel's DiscoveryRegistrationLoop is alive and running,
 * /health returns 200, but discovery-vessel returns 404 on heartbeat POST.
 * The vessel has a stale or evicted registry entry. Other vessels cannot
 * route to it through discovery, causing silent structuredError emissions
 * without operator visibility. Observed 2026-06-01: llm-resolver-vessel
 * accumulated 480 consecutive heartbeat failures over 8 hours undetected.
 *
 * Detection signature:
 *   - >= 30 consecutive DiscoveryRegistrationLoop failure lines within 10min
 *   - OR >= 100 within 60min (acute starvation window)
 *
 * Why one resolver does the whole flow (immunity pattern):
 *   1. Single-task seed template + single server-side resolver prevents F25
 *      multi-task abort cascade.
 *   2. inputShapes: [] and variables: [] — no pool deps, engine pre-flight
 *      cannot reject it (concept_pFSLV6s5s3lQ, concept_Y2zGpFNBrcgb).
 *   3. No iteration resolver chain, no llm_completion_dispatch. journalctl
 *      spawn + parse + post happen inside this function.
 *
 * Runs inside substrate-live as part of development-vessel. journalctl is
 * directly accessible because the vessel runs in the container.
 *
 * State: cache at ${WORKSPACE_ROOT}/.heartbeat-starvation-detector/state.json
 * mapping vessel unit → {lastScannedAt, failureCount, alreadyEmittedAt}.
 * Prevents re-emission within 1h window of prior gap POST.
 *
 * Constitutional principle: substrate_self_detection_recursive — every
 * operator-side audit (journalctl grep for heartbeat failures) becomes a
 * detector template, not a one-off patch (concept_9ldsmRgqSTd5).
 */

export interface VesselHeartbeatStarvationScanPointer {
  type: "vessel_heartbeat_starvation_scan";
  vessels?: string[];
  devVesselImpulsesUrl?: string;
  statePath?: string;
  dry_run?: boolean;
  maxEmits?: number;
  failureThreshold10min?: number;
  failureThreshold60min?: number;
  reemitWindowMinutes?: number;
}

export const DEFAULT_VESSELS = [
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
] as const;

const DEFAULT_DEV_VESSEL_URL = "http://127.0.0.1:8090/v2/impulses/resolve";
const DEFAULT_STATE_PATH = "/workspace/.heartbeat-starvation-detector/state.json";
const DEFAULT_MAX_EMITS = 20;
const DEFAULT_FAILURE_THRESHOLD_10MIN = 30;
const DEFAULT_FAILURE_THRESHOLD_60MIN = 100;
const DEFAULT_REEMIT_WINDOW_MINUTES = 60;

interface VesselState {
  lastScannedAt: string;
  failureCount: number;
  alreadyEmittedAt: string | null;
}

interface JournalFailureContext {
  count: number;
  window: string;
  oldestLineTime: string | null;
  newestLineTime: string | null;
}

interface Finding {
  vessel: string;
  failureContext: JournalFailureContext;
  reasons: string[];
  gap_id: string;
  posted: boolean;
  post_status?: number | "error";
  post_error?: string;
}

interface ScanPorts {
  journalctlFailures: (unit: string) => Promise<JournalFailureContext | null>;
  readCache: (path: string) => Promise<Record<string, VesselState>>;
  writeCache: (path: string, data: Record<string, VesselState>) => Promise<void>;
  postGap: (
    url: string,
    body: unknown,
  ) => Promise<{ ok: boolean; status: number | "error"; error?: string }>;
}

const realPorts: ScanPorts = {
  journalctlFailures: async (unit) => {
    try {
      const proc = Bun.spawn(
        [
          "journalctl",
          "-u",
          unit.endsWith(".service") ? unit : `${unit}.service`,
          "-n",
          "500",
          "--no-pager",
          "-o",
          "short-iso",
        ],
        { stdout: "pipe", stderr: "pipe" },
      );
      const stdout = await new Response(proc.stdout).text();
      const code = await proc.exited;
      if (code !== 0) return null;

      const lines = stdout.split("\n");
      let count10min = 0;
      let count60min = 0;
      let oldestLineTime: string | null = null;
      let newestLineTime: string | null = null;
      const now = Date.now();
      const tenMinMs = 10 * 60 * 1000;
      const sixtyMinMs = 60 * 60 * 1000;

      for (const line of lines) {
        if (
          !line.includes("DiscoveryRegistrationLoop") ||
          !line.match(/fail|error|404|timeout|unreachable/i)
        ) {
          continue;
        }

        const isoMatch = line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        if (!isoMatch) continue;

        const timestamp = new Date(isoMatch[0]).getTime();
        if (isNaN(timestamp)) continue;

        const delta = now - timestamp;
        if (delta <= tenMinMs) count10min++;
        if (delta <= sixtyMinMs) count60min++;

        if (!newestLineTime) newestLineTime = isoMatch[0];
        oldestLineTime = isoMatch[0];
      }

      if (count10min === 0 && count60min === 0) return null;

      let window = "";
      if (count10min >= 30) {
        window = "10min";
      } else if (count60min >= 100) {
        window = "60min";
      } else {
        return null;
      }

      return {
        count: window === "10min" ? count10min : count60min,
        window,
        oldestLineTime,
        newestLineTime,
      };
    } catch {
      return null;
    }
  },
  readCache: async (path) => {
    try {
      const raw = await readFile(path, "utf8");
      const parsed = JSON.parse(raw) as Record<string, VesselState>;
      if (parsed && typeof parsed === "object") return parsed;
      return {};
    } catch {
      return {};
    }
  },
  writeCache: async (path, data) => {
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    const { rename } = await import("node:fs/promises");
    await rename(tmp, path);
  },
  postGap: async (url, body) => {
    const apiKey = process.env["METABOB_API_KEY"];
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `ApiKey ${apiKey}`;
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
    } catch (err) {
      return { ok: false, status: "error", error: (err as Error).message };
    }
  },
};

export async function resolveVesselHeartbeatStarvationScan(
  pointer: VesselHeartbeatStarvationScanPointer,
  ports: ScanPorts = realPorts,
): Promise<ResolverResult> {
  const vessels =
    pointer.vessels && pointer.vessels.length > 0
      ? pointer.vessels
      : [...DEFAULT_VESSELS];
  const emitUrl = pointer.devVesselImpulsesUrl ?? DEFAULT_DEV_VESSEL_URL;
  const statePath = pointer.statePath ?? DEFAULT_STATE_PATH;
  const dryRun = pointer.dry_run === true;
  const maxEmits = pointer.maxEmits ?? DEFAULT_MAX_EMITS;
  const failureThreshold10min =
    pointer.failureThreshold10min ?? DEFAULT_FAILURE_THRESHOLD_10MIN;
  const failureThreshold60min =
    pointer.failureThreshold60min ?? DEFAULT_FAILURE_THRESHOLD_60MIN;
  const reemitWindowMinutes =
    pointer.reemitWindowMinutes ?? DEFAULT_REEMIT_WINDOW_MINUTES;

  const cache = await ports.readCache(statePath);
  const nextCache: Record<string, VesselState> = { ...cache };
  const findings: Finding[] = [];
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
    const reasons: string[] = [];

    let shouldEmit = false;
    if (context.window === "10min" && context.count >= failureThreshold10min) {
      reasons.push(
        `${context.count} consecutive failures in 10min (threshold: ${failureThreshold10min})`,
      );
      shouldEmit = true;
    } else if (
      context.window === "60min" &&
      context.count >= failureThreshold60min
    ) {
      reasons.push(
        `${context.count} consecutive failures in 60min (threshold: ${failureThreshold60min})`,
      );
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

    if (!shouldEmit || reasons.length === 0) continue;

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
              summary:
                `Vessel ${entry.vessel} DiscoveryRegistrationLoop has failed ` +
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
      if (!resp.ok && resp.error) entry.post_error = resp.error;

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
  } catch {
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
