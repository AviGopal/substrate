import { config } from "./config.js";
const HEARTBEAT_INTERVAL_MS = 60_000;
export async function registerWithDiscovery(): Promise<void> {
  const body = {
    vesselId: config.vesselId,
    endpoint: `http://127.0.0.1:${config.port}`,
    shapes: config.discovery.shapes,
    resolverContract: {
      resolve_endpoint: config.discovery.resolveEndpoint,
      resolve_request_format: config.discovery.resolveRequestFormat,
      auth_scheme: config.discovery.authScheme,
      resolve_timeout_ms: config.discovery.resolveTimeoutMs,
    },
  };
  const apiKey = process.env["METABOB_API_KEY"];
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `ApiKey ${apiKey}` } : {}),
  };
  try {
    await fetch(`${config.discoveryEndpoint}/register`, {
      method: "POST", headers, body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
  } catch { /* non-fatal */ }
  setInterval(async () => {
    try {
      await fetch(`${config.discoveryEndpoint}/heartbeat`, {
        method: "POST", headers,
        body: JSON.stringify({ vesselId: config.vesselId }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch { /* non-fatal */ }
  }, HEARTBEAT_INTERVAL_MS).unref();
}
