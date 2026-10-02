/**
 * HTTP client utilities
 */
import type { Logger } from "../types.js";
export interface HttpClientConfig {
    authToken?: string;
    authType?: "Bearer" | "ApiKey";
    logger?: Logger;
}
/**
 * Simple HTTP client wrapper with auth support
 */
export declare class HttpClient {
    private config;
    constructor(config?: HttpClientConfig);
    private getHeaders;
    get<T>(url: string): Promise<T>;
    post<T>(url: string, body?: unknown): Promise<T>;
    delete<T>(url: string): Promise<T>;
}
//# sourceMappingURL=http.d.ts.map