export declare const VESSEL_ID: string;
export declare const PORT: number;
export declare const HOST: string;
export declare const DISCOVERY_ENDPOINT: string;
export declare const DISCOVERY_SHAPES: readonly string[], advertisedShapes: any;
export declare const config: {
    readonly vesselId: string;
    readonly port: number;
    readonly host: string;
    readonly discoveryEndpoint: string;
    readonly discovery: {
        readonly shapes: readonly string[];
        readonly resolveEndpoint: "/v2/impulses/resolve";
        readonly resolveRequestFormat: "pointer";
        readonly authScheme: "ApiKey";
        readonly resolveTimeoutMs: 10000;
    };
};
//# sourceMappingURL=config.d.ts.map