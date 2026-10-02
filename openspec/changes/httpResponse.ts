import type { ResolverResult } from "../resolvers/types.js";

/**
 * resolveHttpResponse fetches the content of a given URL and returns it as an httpResponse.
 */
export async function resolveHttpResponse(
  pointer: { type: "httpResponse"; url: string },
): Promise<ResolverResult> {
  const url = pointer.url;

  if (!url) {
    return {
      shape: "structuredError",
      body: {
        error: "URL is required for httpResponse",
      },
    };
  }

  try {
    const res = await fetch(url);
    const body = await res.text();
    return {
      shape: "httpResponse",
      body: {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body: body,
      },
    };
  } catch (error) {
    return {
      shape: "structuredError",
      body: {
        error: `Failed to fetch URL: ${url}`,
        detail: String(error),
      },
    };
  }
}
