import type { ResolverResult } from "../resolvers/types.js";
import { resolveWebResource } from "../resolvers/web-resource.js";

/**
 * `httpResponse` (2026-08-16) — fetches a given URL and returns the HTTP response body.
 * This resolver produces ONLY the shape "httpResponse".
 */
export async function resolveHttpResponseCamel(
  pointer: { type: "httpResponse"; url: string; max_bytes?: number; allow_domains?: string[] },
): Promise<ResolverResult> {
  if (pointer.type !== "httpResponse") {
    return { shape: "structuredError", body: { ok: false, error: "Invalid pointer type" } };
  }

  const url = pointer.url.trim();
  if (!url) {
    return {
      shape: "structuredError",
      body: {
        ok: false,
        error: "url is required",
        detail: "No url was provided for httpResponse. A URL is required to fetch a web resource.",
        resolved: false,
      },
    };
  }

  const webResourceResult = await resolveWebResource({
    type: "web_resource",
    url,
    ...(typeof pointer.max_bytes === "number" ? { max_bytes: pointer.max_bytes } : {}),
    ...(Array.isArray(pointer.allow_domains) ? { allow_domains: pointer.allow_domains } : {}),
  });

  if (webResourceResult.shape === "web_resource" && webResourceResult.body && typeof webResourceResult.body === "object" && "ok" in webResourceResult.body && webResourceResult.body.ok) {
    return {
      shape: "httpResponse",
      body: {
        status: 200, // Assuming 200 for successful web_resource fetch; real status is in webResourceResult.body.status if not ok
        body: (webResourceResult.body as { content?: string }).content || "",
      },
    };
  } else {
    // If resolveWebResource failed or returned an error, return a structuredError or a specific httpResponse error
    return {
      shape: "httpResponse",
      body: {
        status: (webResourceResult.body as {status?: number}).status || 500,
        body: (webResourceResult.body as {error?: string}).error || "Failed to fetch web resource",
      },
    };
  }
}
