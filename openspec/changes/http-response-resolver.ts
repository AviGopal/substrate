import { ResolverResult, HttpResponse } from '../../repos/development-vessel/src/config.js';
import { resolveWebResource } from '../../repos/development-vessel/src/resolvers/web-resource.js';

/**
 * `httpResponse` — delegates to the real, trust-gated fetcher.
 *
 * WHAT THIS REPLACED (2026-08-16). This resolver advertised itself as an HTTP fetch and
 * **ignored the URL entirely**:\n *
 *     const url = 'https://httpbin.org/status/404';
 *     const response = await fetch(url);
 *     ... return the page <title>
 *
 * A hardcoded httpbin probe, presumably a scaffold, left advertised in `config.ts` and wired
 * into `impulses.ts` dispatch. So a walk needing an external fetch found `httpResponse` in the
 * registry, resolved it, and got httpbin\'s 404 title back **no matter what it asked for** — a
 * well-formed answer to a question nobody asked. That is the same defect class as the
 * vessel-health resolver that defaulted its subject: the shape works, so no gate fires, and only
 * the content is wrong.
 *
 * Its measured cost was not hypothetical. The substrate spent three separate sessions today
 * (16:10, 16:41, 17:18) drafting a *generic http response resolver* into
 * `openspec/changes/` — twelve orphaned files, none landed — because the capability it needed
 * appeared to exist and did not work. Law 3 says compose before minting; composing with this
 * returned garbage, so it kept re-minting.
 *
 * WHY DELEGATE RATHER THAN DELETE. The shape is advertised in `config.ts` and dispatched in
 * `impulses.ts`, and `bun run lint` enforces agreement between the two — removing the resolver
 * means removing the shape, which would break any pathway that already selected it. Delegating
 * keeps the vocabulary stable and makes the shape mean what its name says.
 *
 * WHY `web_resource` AND NOT A NEW FETCHER. It already exists and is the right architecture per
 * SUBSTRATE_AS_NETWORK: an allowlist trust gate (an unknown domain is refused, not fetched),
 * size and time caps, and content returned tagged `trust:\"external-evidence\"` so downstream
 * treats it as a low-trust impulse that must be verified before it shapes durable state. Writing
 * a second, ungated fetcher would hand the substrate an unrestricted egress path and quietly
 * discard that discipline — which is exactly what the drafted patches in `openspec/changes/`
 * would have done, since none of them carried a trust gate.
 */
export async function resolveHttpResponse(
  pointer: { type: string; url?: string; max_bytes?: number; allow_domains?: string[] },
): Promise<HttpResponse> { // Changed return type to HttpResponse
  if (pointer.type !== 'httpResponse') {
    return { shape: 'httpResponse', status: 400, body: 'Invalid pointer type' }; // Added status
  }

  // NO DEFAULT URL. The predecessor\'s hardcoded httpbin address is precisely what made this
  // resolver lie: an unbound argument must surface as an unresolved impulse so the walk can bind
  // it or fail honestly, never be silently filled in.
  const url = typeof pointer.url === 'string' ? pointer.url.trim() : '';
  if (!url) {
    return {
      shape: 'httpResponse',
      status: 400, // Added status
      body: 'url is required — refusing to fetch an assumed address', // Simplified body
    };
  }

  const res = await resolveWebResource({
    type: 'web_resource',
    url,
    ...(typeof pointer.max_bytes === 'number' ? { max_bytes: pointer.max_bytes } : {}),
    ...(Array.isArray(pointer.allow_domains) ? { allow_domains: pointer.allow_domains } : {}),
  });

  const responseBody = typeof res.body === 'object' && res.body !== null && 'content' in res.body
    ? String(res.body.content)
    : JSON.stringify(res.body);

  const status = typeof res.body === 'object' && res.body !== null && 'status' in res.body
    ? Number(res.body.status)
    : (res.body.ok === false ? 500 : 200);

  return { shape: 'httpResponse', status: status, body: responseBody };
}
