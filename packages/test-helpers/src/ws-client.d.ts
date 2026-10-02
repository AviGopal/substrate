export interface WSTestClient {
    send(msg: unknown): void;
    waitFor(type: string, timeout?: number): Promise<unknown>;
    messages: unknown[];
    close(): void;
}
export declare function connectWS(url: string): Promise<WSTestClient>;
//# sourceMappingURL=ws-client.d.ts.map