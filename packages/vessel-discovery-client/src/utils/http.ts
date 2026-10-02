/**
 * HTTP client utilities
 */

import type { Logger } from "../types.js"

export interface HttpClientConfig {
  authToken?: string
  authType?: "Bearer" | "ApiKey"
  logger?: Logger
}

/**
 * Simple HTTP client wrapper with auth support
 */
export class HttpClient {
  constructor(private config: HttpClientConfig = {}) {}

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (this.config.authToken) {
      const authType = this.config.authType || "Bearer"
      headers["Authorization"] = `${authType} ${this.config.authToken}`
    }

    return headers
  }

  async get<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
      this.config.logger?.error(`GET ${url} failed:`, error.message)
      throw error
    }

    return response.json() as Promise<T>
  }

  async post<T>(url: string, body?: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
      this.config.logger?.error(`POST ${url} failed:`, error.message)
      throw error
    }

    return response.json() as Promise<T>
  }

  async delete<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: "DELETE",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
      this.config.logger?.error(`DELETE ${url} failed:`, error.message)
      throw error
    }

    return response.json() as Promise<T>
  }
}
