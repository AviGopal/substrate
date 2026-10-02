import type { ResolverResult } from "../resolvers/types.js";
/**
 * `httpResponse` (2026-08-16) — fetches a given URL and returns the HTTP response body.
 * This resolver produces ONLY the shape "httpResponse".
 */
export declare function resolveHttpResponseCamel(pointer: {
    type: "httpResponse";
    url: string;
    max_bytes?: number;
    allow_domains?: string[];
}): Promise<ResolverResult>;
//# sourceMappingURL=http-response-camel.d.ts.map