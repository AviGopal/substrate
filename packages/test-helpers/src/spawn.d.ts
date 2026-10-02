export interface SpawnOptions {
    cmd: string[];
    cwd: string;
    port: number;
    env?: Record<string, string>;
    timeout?: number;
}
export interface VesselHandle {
    port: number;
    baseUrl: string;
    stop(): Promise<void>;
}
export declare function spawnVessel(opts: SpawnOptions): Promise<VesselHandle>;
//# sourceMappingURL=spawn.d.ts.map