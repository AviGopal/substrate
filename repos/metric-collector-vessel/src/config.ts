export const VESSEL_ID = process.env["VESSEL_ID"] ?? "metric-collector-vessel";
export const PORT = parseInt(process.env["PORT"] ?? "8280", 10);
export const HOST = process.env["HOST"] ?? "0.0.0.0";
export const DISCOVERY_ENDPOINT = process.env["DISCOVERY_ENDPOINT"] ?? "http://127.0.0.1:8100";
export const DISCOVERY_SHAPES: readonly string[] = ["metricSample", "metricSample_write"];
export const config = {
  vesselId: VESSEL_ID, port: PORT, host: HOST,
  discoveryEndpoint: DISCOVERY_ENDPOINT,
  discovery: {
    shapes: DISCOVERY_SHAPES,
    resolveEndpoint: "/v2/impulses/resolve",
    resolveRequestFormat: "pointer" as const,
    authScheme: "ApiKey" as const,
    resolveTimeoutMs: 10000,
  },
} as const;
