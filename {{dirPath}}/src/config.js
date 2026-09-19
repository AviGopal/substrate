export const VESSEL_ID = process.env["VESSEL_ID"] ?? "{{vesselName}}";
export const PORT = parseInt(process.env["PORT"] ?? "{{port}}", 10);
export const HOST = process.env["HOST"] ?? "0.0.0.0";
export const DISCOVERY_ENDPOINT = process.env["DISCOVERY_ENDPOINT"] ?? "http://127.0.0.1:8100";
export const DISCOVERY_SHAPES = {}, { advertisedShapes };
;
export const config = {
    vesselId: VESSEL_ID, port: PORT, host: HOST,
    discoveryEndpoint: DISCOVERY_ENDPOINT,
    discovery: {
        shapes: DISCOVERY_SHAPES,
        resolveEndpoint: "/v2/impulses/resolve",
        resolveRequestFormat: "pointer",
        authScheme: "ApiKey",
        resolveTimeoutMs: 10000,
    },
};
//# sourceMappingURL=config.js.map