import type { VesselConfig } from "@avigopal/ias-executor-ts";

export const DISCOVERY_SHAPES: string[] = ["currentTimeReport"];

export const VESSEL_CONFIG: VesselConfig = {
  discovery: {
    shapes: DISCOVERY_SHAPES,
    resolverContract: {
      resolve_endpoint: "/v2/impulses/resolve",
      resolve_request_format: "pointer",
      auth_scheme: "ApiKey",
      resolve_timeout_ms: 10000,
    },
  },
};
