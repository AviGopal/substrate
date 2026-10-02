import type { ResolverResult, HttpResponsePointer, HttpResponse } from '../repos/development-vessel/src/config/types.js';
/**
 * `httpResponse` — delegates to the real, trust-gated fetcher.
 *
 * This resolver provides the `httpResponse` shape as required by the gap.
 */
export declare function resolveHttpResponse(pointer: HttpResponsePointer): Promise<ResolverResult<HttpResponse>>;
//# sourceMappingURL=new-http-response-resolver.d.ts.map