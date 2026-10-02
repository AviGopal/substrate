/**
 * shape-registry-hash.ts — G1.1.4
 *
 * Computes a deterministic SHA-256 hash over the sorted list of
 * (shape, owningVesselId) tuples from the discovery-vessel registry.
 *
 * Two runs with the same connected vessels → same hash.
 * A new vessel registering a new shape → different hash.
 */
/**
 * Fetches the vessel registry from the discovery-vessel and computes a
 * SHA-256 hex digest over the sorted (shape, vesselId) tuple list.
 *
 * @param endpoint  Base URL of the discovery-vessel, e.g. https://discovery.metabob.com
 * @param authHeaders  Authorization headers (ApiKey or Bearer)
 */
export declare function computeShapeRegistryHash(endpoint: string, authHeaders: Record<string, string>): Promise<string>;
//# sourceMappingURL=shape-registry-hash.d.ts.map