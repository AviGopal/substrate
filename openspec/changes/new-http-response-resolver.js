"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveHttpResponse = resolveHttpResponse;
const web_resource_js_1 = require("../repos/development-vessel/src/resolvers/web-resource.js");
/**
 * `httpResponse` — delegates to the real, trust-gated fetcher.
 *
 * This resolver provides the `httpResponse` shape as required by the gap.
 */
async function resolveHttpResponse(pointer) {
    if (pointer.type !== 'httpResponse') {
        return { shape: 'httpResponse', body: { ok: false, error: 'Invalid pointer type' } };
    }
    const url = typeof pointer.url === 'string' ? pointer.url.trim() : '';
    if (!url) {
        return {
            shape: 'httpResponse',
            body: {
                ok: false,
                error: 'url is required — refusing to fetch an assumed address',
                detail: 'No url was bound on this pointer. Bind url (https only; the origin must be on the web_resource trust allowlist).',
                resolved: false,
            },
        };
    }
    const res = await (0, web_resource_js_1.resolveWebResource)({
        type: 'web_resource',
        url,
        ...(typeof pointer.max_bytes === 'number' ? { max_bytes: pointer.max_bytes } : {}),
        ...(Array.isArray(pointer.allow_domains) ? { allow_domains: pointer.allow_domains } : {}),
    });
    return { shape: 'httpResponse', body: res.body };
}
//# sourceMappingURL=new-http-response-resolver.js.map