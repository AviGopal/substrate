import type { ResolverResult } from "../resolvers/types.js";
/**
 * resolveHttpResponse fetches the content of a given URL and returns it as an httpResponse.
 */
export declare function resolveHttpResponse(pointer: {
    type: "httpResponse";
    url: string;
}): Promise<ResolverResult>;
//# sourceMappingURL=httpResponse.d.ts.map