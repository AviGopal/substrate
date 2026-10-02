import type {
  ResolverResult,
  HttpResponsePointer,
  ResolverOutcome,
  HttpResponse,
} from "../config/types"; // Path relative to development-vessel/src/resolvers/

export async function resolveHttpResponse(
  pointer: HttpResponsePointer,
): Promise<ResolverResult> {
  if (pointer.type !== "httpResponse") {
    return {
      _outcome: "error",
      error: `Invalid pointer type: ${pointer.type}. Expected "httpResponse"`,
      httpResponse: {
        status: 400,
        statusText: "Bad Request",
        headers: {},
        body: `Invalid pointer type: ${pointer.type}. Expected "httpResponse"`,
      },
    };
  }

  const url = typeof pointer.url === "string" ? pointer.url.trim() : "";
  if (!url) {
    return {
      _outcome: "error",
      error: "url is required — refusing to fetch an assumed address",
      httpResponse: {
        status: 400,
        statusText: "Bad Request",
        headers: {},
        body: "No url was bound on this pointer.",
      },
    };
  }

  // Domain allowlisting
  if (pointer.allow_domains && pointer.allow_domains.length > 0) {
    const parsedUrl = new URL(url);
    if (!pointer.allow_domains.includes(parsedUrl.hostname)) {
      return {
        _outcome: "error",
        error: `Domain ${parsedUrl.hostname} is not in the allow_domains list.`,
        httpResponse: {
          status: 403,
          statusText: "Forbidden",
          headers: {},
          body: `Access to ${parsedUrl.hostname} is forbidden.`,
        },
      };
    }
  }

  try {
    const response = await fetch(url);
    let body = await response.text();

    // Max bytes check
    if (pointer.max_bytes && body.length > pointer.max_bytes) {
      body = body.substring(0, pointer.max_bytes) + "... (truncated)";
    }

    const httpResponse: HttpResponse = {
      // url: pointer.url, // No url field in HttpResponse definition in config/types.ts
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: body,
    };

    return {
      _outcome: "success",
      httpResponse: httpResponse,
    };
  } catch (error: any) {
    return {
      _outcome: "error",
      error: `Failed to fetch URL: ${error.message}`,
      httpResponse: {
        status: 500,
        statusText: "Internal Server Error",
        headers: {},
        body: `Failed to fetch URL: ${error.message}`,
      },
    };
  }
}
