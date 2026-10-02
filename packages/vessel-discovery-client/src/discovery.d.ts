/**
 * Discovery client for querying vessel capabilities
 */
import type { DiscoveryOptions, DiscoveryResult, Logger } from "./types.js";
/**
 * Discover vessels that can resolve a specific shape
 */
export declare function discoverByShape(options: DiscoveryOptions): Promise<DiscoveryResult>;
/**
 * Discover all registered vessels
 */
export declare function discoverVessels(options: {
    discoveryEndpoint: string;
    authToken?: string;
    authType?: "Bearer" | "ApiKey";
    logger?: Logger;
}): Promise<{
    vessels: Array<{
        vesselId: string;
        vesselName: string;
        shapes: string[];
        endpoint: string;
        protocol?: string;
        status: string;
        lastSeen: string;
        metadata?: Record<string, unknown>;
    }>;
    totalCount: number;
}>;
/**
 * Clear discovery cache (useful for testing)
 */
export declare function clearDiscoveryCache(): void;
//# sourceMappingURL=discovery.d.ts.map