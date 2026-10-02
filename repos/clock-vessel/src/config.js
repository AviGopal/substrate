export const DISCOVERY_SHAPES = ["currentTimeReport"];
export const VESSEL_CONFIG = {
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
//# sourceMappingURL=config.js.map