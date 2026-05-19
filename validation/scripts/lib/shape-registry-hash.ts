/**
 * shape-registry-hash.ts — G1.1.4
 *
 * Computes a deterministic SHA-256 hash over the sorted list of
 * (shape, owningVesselId) tuples from the discovery-vessel registry.
 *
 * Two runs with the same connected vessels → same hash.
 * A new vessel registering a new shape → different hash.
 */

import { createHash } from "node:crypto";

interface VesselEntry {
  vesselId: string;
  shapes?: string[];
}

interface VesselRegistryResult {
  vessels?: VesselEntry[];
  totalCount?: number;
}

interface ResolveResponse {
  content?: unknown;
  // Activity-API style: { success, content }
  success?: boolean;
}

/**
 * Fetches the vessel registry from the discovery-vessel and computes a
 * SHA-256 hex digest over the sorted (shape, vesselId) tuple list.
 *
 * @param endpoint  Base URL of the discovery-vessel, e.g. https://discovery.metabob.com
 * @param authHeaders  Authorization headers (ApiKey or Bearer)
 */
export async function computeShapeRegistryHash(
  endpoint: string,
  authHeaders: Record<string, string>
): Promise<string> {
  // Use POST /resolve with vesselRegistry pointer to get all vessels + their shapes
  const resp = await fetch(`${endpoint}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ pointer: { type: "vesselRegistry" } }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    throw new Error(
      `discovery-vessel /resolve (vesselRegistry) returned ${resp.status}: ${await resp.text().then(t => t.slice(0, 200))}`
    );
  }

  const body = (await resp.json()) as ResolveResponse;

  // Discovery-vessel returns { content: { vessels: [...] } }
  // Activity-API-proxied calls return { success, content: string }
  let registryResult: VesselRegistryResult;
  if (typeof body.content === "string") {
    registryResult = JSON.parse(body.content) as VesselRegistryResult;
  } else if (body.content && typeof body.content === "object") {
    registryResult = body.content as VesselRegistryResult;
  } else {
    // Fallback: try the body itself as the registry result
    registryResult = body as unknown as VesselRegistryResult;
  }

  const vessels = registryResult.vessels ?? [];

  // Expand into (shape, vesselId) tuples
  const tuples: Array<[string, string]> = [];
  for (const vessel of vessels) {
    for (const shape of vessel.shapes ?? []) {
      tuples.push([shape, vessel.vesselId]);
    }
  }

  // Sort lexicographically: primary by shape, secondary by vesselId
  tuples.sort((a, b) => {
    const cmp = a[0].localeCompare(b[0]);
    return cmp !== 0 ? cmp : a[1].localeCompare(b[1]);
  });

  // Serialize and hash
  const serialized = tuples.map(([s, v]) => `${s}\x00${v}`).join("\n");
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}
