/**
 * Activity API Client
 *
 * Client for fetching template recommendations from the backend.
 * Handles offline gracefully with fallback to local state.
 */

import type { ActivityTemplate } from "@metabob/minibob";
import type {
  GoalContext,
  TemplateRecommendation,
  TemplateStats,
  ExecutionOutcome,
} from "./types.ts";

// =============================================================================
// TYPES
// =============================================================================

/**
 * API response for recommendations
 */
interface RecommendResponse {
  recommendations: Array<{
    template: ActivityTemplate;
    score: number;
    confidence: number;
    reason: string;
  }>;
  stats: TemplateStats[];
}

/**
 * API client options
 */
export interface ActivityAPIClientOptions {
  /** Backend API URL */
  baseUrl: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Auth token */
  authToken?: string;
  /** Organization ID */
  orgId?: string;
}

/**
 * Client state
 */
export interface ClientState {
  /** Whether we're online */
  online: boolean;
  /** Last successful connection */
  lastConnected: number | null;
  /** Last error message */
  lastError: string | null;
}

// =============================================================================
// CLIENT
// =============================================================================

/**
 * ActivityAPIClient - communicates with activity-api backend
 */
export class ActivityAPIClient {
  private baseUrl: string;
  private timeout: number;
  private authToken?: string;
  private orgId?: string;
  private state: ClientState;

  constructor(options: ActivityAPIClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.timeout = options.timeout ?? 5000;
    this.authToken = options.authToken;
    this.orgId = options.orgId;
    this.state = {
      online: true,
      lastConnected: null,
      lastError: null,
    };
  }

  // ===========================================================================
  // STATE
  // ===========================================================================

  /**
   * Get current client state
   */
  getState(): ClientState {
    return { ...this.state };
  }

  /**
   * Check if we're online
   */
  isOnline(): boolean {
    return this.state.online;
  }

  /**
   * Update auth token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Update org ID
   */
  setOrgId(orgId: string): void {
    this.orgId = orgId;
  }

  // ===========================================================================
  // API METHODS
  // ===========================================================================

  /**
   * Get template recommendations for a goal
   */
  async recommend(
    context: GoalContext,
    limit = 5
  ): Promise<{
    recommendations: TemplateRecommendation[];
    stats: TemplateStats[];
  } | null> {
    try {
      const response = await this.request<RecommendResponse>(
        "/v2/activities/recommend",
        {
          method: "POST",
          body: JSON.stringify({
            goal: context.goal,
            workspace_type: context.workspaceType,
            language: context.language,
            framework: context.framework,
            tags: context.tags,
            recent_templates: context.recentTemplates,
            limit,
          }),
        }
      );

      return {
        recommendations: response.recommendations,
        stats: response.stats,
      };
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Get all templates
   */
  async listTemplates(
    options: { category?: string; level?: number } = {}
  ): Promise<ActivityTemplate[] | null> {
    try {
      const params = new URLSearchParams();
      if (options.category) params.set("category", options.category);
      if (options.level !== undefined) params.set("level", String(options.level));

      const response = await this.request<{ templates: ActivityTemplate[] }>(
        `/v2/activities/templates?${params}`,
        { method: "GET" }
      );

      return response.templates;
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Get a specific template
   */
  async getTemplate(templateId: string): Promise<ActivityTemplate | null> {
    try {
      const response = await this.request<{ template: ActivityTemplate }>(
        `/v2/activities/templates/${encodeURIComponent(templateId)}`,
        { method: "GET" }
      );

      return response.template;
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Record execution outcome
   */
  async recordOutcome(outcome: ExecutionOutcome): Promise<boolean> {
    try {
      await this.request("/v2/activities/execution-traces", {
        method: "POST",
        body: JSON.stringify({
          template_id: outcome.templateId,
          success: outcome.success,
          duration_ms: outcome.durationMs,
          cost: outcome.cost,
          error: outcome.error,
          timestamp: Date.now(),
        }),
      });

      return true;
    } catch (error) {
      this.handleError(error);
      return false;
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(template: ActivityTemplate): Promise<boolean> {
    try {
      await this.request("/v2/activities/templates", {
        method: "POST",
        body: JSON.stringify(template),
      });

      return true;
    } catch (error) {
      this.handleError(error);
      return false;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request<{ status: string }>("/health", { method: "GET" });
      this.state.online = true;
      this.state.lastConnected = Date.now();
      return true;
    } catch {
      this.state.online = false;
      return false;
    }
  }

  // ===========================================================================
  // PRIVATE
  // ===========================================================================

  /**
   * Make an HTTP request
   */
  private async request<T>(
    path: string,
    options: { method: string; body?: string }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (this.authToken) {
        headers["Authorization"] = `Bearer ${this.authToken}`;
      }

      if (this.orgId) {
        headers["X-Org-Id"] = this.orgId;
      }

      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "Unknown error");
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      this.state.online = true;
      this.state.lastConnected = Date.now();
      this.state.lastError = null;

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Handle errors and update state
   */
  private handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);

    // Check if it's a network error
    if (
      message.includes("fetch") ||
      message.includes("network") ||
      message.includes("ECONNREFUSED") ||
      message.includes("timeout") ||
      message.includes("aborted")
    ) {
      this.state.online = false;
    }

    this.state.lastError = message;
  }
}
