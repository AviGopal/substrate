/**
 * HTTP client utilities
 */
/**
 * Simple HTTP client wrapper with auth support
 */
export class HttpClient {
    config;
    constructor(config = {}) {
        this.config = config;
    }
    getHeaders() {
        const headers = {
            "Content-Type": "application/json",
        };
        if (this.config.authToken) {
            const authType = this.config.authType || "Bearer";
            headers["Authorization"] = `${authType} ${this.config.authToken}`;
        }
        return headers;
    }
    async get(url) {
        const response = await fetch(url, {
            method: "GET",
            headers: this.getHeaders(),
        });
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            this.config.logger?.error(`GET ${url} failed:`, error.message);
            throw error;
        }
        return response.json();
    }
    async post(url, body) {
        const response = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            this.config.logger?.error(`POST ${url} failed:`, error.message);
            throw error;
        }
        return response.json();
    }
    async delete(url) {
        const response = await fetch(url, {
            method: "DELETE",
            headers: this.getHeaders(),
        });
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            this.config.logger?.error(`DELETE ${url} failed:`, error.message);
            throw error;
        }
        return response.json();
    }
}
//# sourceMappingURL=http.js.map