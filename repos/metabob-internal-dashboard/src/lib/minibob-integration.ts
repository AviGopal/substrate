/**
 * MiniBob Integration for Internal Dashboard
 *
 * Connects the dashboard to MiniBob's activity/impulse system.
 * UI components are impulses - MiniBob controls the UI through its existing tools.
 */

import {
  GoalProcessor,
  ActivityExecutor,
  initializeMCP,
  isMCPEnabled,
  createImpulse,
  type ToolDefinition,
  type ToolHandler,
  type UIComponentPrimitive,
  type UIPosition,
  type UIComponentImpulse,
} from '@metabob/minibob'

import { wsHandler } from './websocket-handler'
import type { QueryMessage, ActionMessage } from './websocket-handler'

// =============================================================================
// TYPES
// =============================================================================

export interface MiniBobIntegrationConfig {
  /** MiniBob Activity API endpoint */
  activityApiUrl: string
  /** Working directory for file operations */
  workingDirectory: string
  /** Anthropic API key (optional - falls back to env var) */
  anthropicApiKey?: string
}

export interface ConversationContext {
  /** Message history for multi-turn conversations */
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

// =============================================================================
// UI TOOLS (injected as custom tools into MiniBob)
// =============================================================================

/**
 * Create UI-specific tools that create impulses for dashboard rendering.
 * These tools integrate with MiniBob's impulse system.
 */
function createUITools(): Record<string, { definition: ToolDefinition; handler: ToolHandler }> {
  return {
    create_ui_component: {
      definition: {
        name: 'create_ui_component',
        description: `Create a UI component to display data on the dashboard.

Use primitive compositions to build any visualization:
- container: Layout with layout="vertical"|"horizontal"|"grid", gap, padding, children
- text: Text with content and variant="heading"|"body"|"caption"
- data-table: Table with columns=[{key,label,render?}] and data=[{...}]
- chart: Visualization with chartType="bar"|"line"|"pie", data, xKey, yKey
- badge: Status indicator with text and variant="success"|"warning"|"error"|"info"
- progress: Progress bar with value (0-100) and variant="bar"|"circle"
- button: Interactive button with text, variant, action
- code: Code block with content and language

Example to show system health:
{
  "primitive": {
    "type": "container",
    "layout": "vertical",
    "gap": "1rem",
    "children": [
      { "type": "text", "content": "System Health", "variant": "heading" },
      { "type": "badge", "text": "All Systems Operational", "variant": "success" }
    ]
  },
  "position": { "type": "below-input" }
}`,
        parameters: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Component ID (optional, auto-generated if not provided)',
            },
            primitive: {
              type: 'object',
              description: 'The primitive composition to render',
            },
            position: {
              type: 'object',
              description: 'Position: { type: "below-input"|"flow"|"absolute", x?, y? }',
            },
            animation: {
              type: 'string',
              description: 'Animation: "none"|"fade"|"slide"|"scale"',
            },
          },
          required: ['primitive'],
        },
      },
      handler: async (params) => {
        const id = (params.id as string) || `ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const primitive = params.primitive as UIComponentPrimitive
        const position = (params.position as UIPosition) || { type: 'below-input' }
        const animation = (params.animation as string) || 'slide'

        // Create impulse with ui_component pointer type
        const impulse = createImpulse({
          id,
          pointer: {
            type: 'ui_component',
            primitive,
            position,
            animation,
          },
          budget: 0, // UI components don't consume token budget
          priority: 'high',
        })

        // Broadcast to connected dashboards via WebSocket
        const uiImpulse: UIComponentImpulse = {
          id,
          type: 'ui_component',
          primitive,
          position,
          animation: animation as any,
          metadata: { createdAt: Date.now() },
        }
        wsHandler.createImpulse(uiImpulse as any)

        return {
          success: true,
          output: `Created UI component: ${id}`,
        }
      },
    },

    update_ui_component: {
      definition: {
        name: 'update_ui_component',
        description: 'Update an existing UI component with new data or properties',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Component ID to update' },
            patch: { type: 'object', description: 'Partial update to apply' },
          },
          required: ['id', 'patch'],
        },
      },
      handler: async (params) => {
        const id = params.id as string
        const patch = params.patch as Record<string, unknown>

        // Update in WebSocket handler (broadcasts to clients)
        wsHandler.updateImpulse(id, patch)

        return {
          success: true,
          output: `Updated UI component: ${id}`,
        }
      },
    },

    delete_ui_component: {
      definition: {
        name: 'delete_ui_component',
        description: 'Remove a UI component from the dashboard',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Component ID to delete' },
          },
          required: ['id'],
        },
      },
      handler: async (params) => {
        const id = params.id as string
        wsHandler.deleteImpulse(id)

        return {
          success: true,
          output: `Deleted UI component: ${id}`,
        }
      },
    },

    clear_ui_components: {
      definition: {
        name: 'clear_ui_components',
        description: 'Clear all UI components from the dashboard. Optionally pass "except" with component IDs to keep.',
        parameters: {
          type: 'object',
          properties: {
            except: {
              type: 'string',
              description: 'Comma-separated component IDs to keep (e.g., "ui-123,ui-456")',
            },
          },
          required: [],
        },
      },
      handler: async (params) => {
        const exceptStr = params.except as string | undefined
        const except = exceptStr ? exceptStr.split(',').map(s => s.trim()) : undefined
        wsHandler.clearImpulses(except)

        return {
          success: true,
          output: 'Cleared UI components',
        }
      },
    },

    query_activity_api: {
      definition: {
        name: 'query_activity_api',
        description: 'Query the Activity API for system data (templates, executions, metrics, health)',
        parameters: {
          type: 'object',
          properties: {
            endpoint: {
              type: 'string',
              description: 'API endpoint path (e.g., "/health", "/v2/activities/templates")',
            },
            method: {
              type: 'string',
              enum: ['GET', 'POST'],
              description: 'HTTP method (default: GET)',
            },
            body: {
              type: 'object',
              description: 'Request body for POST requests',
            },
          },
          required: ['endpoint'],
        },
      },
      handler: async (params) => {
        const endpoint = params.endpoint as string
        const method = (params.method as string) || 'GET'
        const body = params.body as unknown

        try {
          // Get Activity API URL from environment or config
          const apiUrl = process.env.MINIBOB_API_URL || 'http://localhost:8080'
          const url = `${apiUrl}${endpoint}`

          const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
          })

          if (!response.ok) {
            return {
              success: false,
              error: `API error: ${response.status} ${response.statusText}`,
            }
          }

          const data = await response.json()
          return {
            success: true,
            output: JSON.stringify(data, null, 2),
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'API request failed',
          }
        }
      },
    },
  }
}

// =============================================================================
// MINIBOB INTEGRATION
// =============================================================================

export class MiniBobIntegration {
  private config: MiniBobIntegrationConfig
  private goalProcessor: GoalProcessor | null = null
  private executor: ActivityExecutor | null = null
  private conversationContexts = new Map<string, ConversationContext>()
  private initialized = false

  constructor(config: MiniBobIntegrationConfig) {
    this.config = config
  }

  /**
   * Initialize MiniBob with MCP connection and UI tools
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    console.log('[MiniBobIntegration] Initializing...')
    console.log(`[MiniBobIntegration] Activity API: ${this.config.activityApiUrl}`)

    // Initialize MCP connection to activity API
    try {
      await initializeMCP({
        endpoint: this.config.activityApiUrl,
      })
    } catch (error) {
      console.warn('[MiniBobIntegration] MCP initialization failed:', error)
    }

    // Create UI tools
    const uiTools = createUITools()

    // Create activity executor with UI tools
    this.executor = new ActivityExecutor({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.LLM_MODEL || 'claude-sonnet-4-20250514',
      workingDirectory: this.config.workingDirectory,
      customTools: uiTools,
    })

    // Create goal processor
    this.goalProcessor = new GoalProcessor({
      workingDirectory: this.config.workingDirectory,
      executor: this.executor,
    })

    this.initialized = true
    console.log('[MiniBobIntegration] Initialized with UI tools')
  }

  /**
   * Handle a query from the dashboard
   */
  async handleQuery(query: QueryMessage, sessionId: string): Promise<void> {
    console.log(`[MiniBobIntegration] Query from ${sessionId}: ${query.text}`)

    // Get or create conversation context
    let context = this.conversationContexts.get(sessionId)
    if (!context) {
      context = { messages: [] }
      this.conversationContexts.set(sessionId, context)
    }

    // Send thinking indicator
    wsHandler.sendThinking(query.id!, 'Processing your query...')

    const startTime = Date.now()

    try {
      if (!this.goalProcessor || !isMCPEnabled()) {
        // Demo mode - no MCP connection
        await this.handleDemoQuery(query, sessionId)
        return
      }

      // Execute goal with MiniBob
      wsHandler.sendThinking(query.id!, 'Analyzing request...')

      const result = await this.goalProcessor.executeGoal(query.text, {
        sessionId,
        previousMessages: context.messages,
      })

      // Update conversation context
      context.messages.push({ role: 'user', content: query.text })
      context.messages.push({
        role: 'assistant',
        content: result.completed
          ? result.completionReason
          : `Incomplete: ${result.completionReason}`,
      })

      const duration = Date.now() - startTime
      wsHandler.sendActivityComplete(query.id!, result.completed, duration)

    } catch (error) {
      console.error('[MiniBobIntegration] Query error:', error)

      // Create error response UI
      wsHandler.createImpulse({
        id: `error-${Date.now()}`,
        type: 'ui_component',
        primitive: {
          type: 'container',
          layout: 'vertical',
          gap: '0.5rem',
          style: {
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.5rem',
            padding: '1rem',
          },
          children: [
            { type: 'text', content: 'Error', variant: 'heading' },
            {
              type: 'text',
              content: error instanceof Error ? error.message : 'An error occurred',
              variant: 'body',
            },
          ],
        },
        position: { type: 'below-input' },
        animation: 'fade',
        metadata: { createdAt: Date.now() },
      } as any)

      wsHandler.sendActivityComplete(
        query.id!,
        false,
        Date.now() - startTime,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  /**
   * Handle query in demo mode (no MCP connection)
   */
  private async handleDemoQuery(query: QueryMessage, sessionId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500))

    wsHandler.createImpulse({
      id: `response-${Date.now()}`,
      type: 'ui_component',
      primitive: {
        type: 'container',
        layout: 'vertical',
        gap: '1rem',
        children: [
          {
            type: 'text',
            content: `Query: "${query.text}"`,
            variant: 'heading',
          },
          {
            type: 'text',
            content: 'MiniBob integration requires MCP connection to metabob-activity-api. Configure MINIBOB_API_URL to enable AI-powered responses.',
            variant: 'body',
          },
          {
            type: 'badge',
            text: 'Demo Mode',
            variant: 'warning',
          },
        ],
      },
      position: { type: 'below-input' },
      animation: 'slide',
      metadata: {
        queryId: query.id,
        createdAt: Date.now(),
      },
    } as any)

    wsHandler.sendActivityComplete(query.id!, true, 500)
  }

  /**
   * Handle an action from the dashboard
   */
  async handleAction(action: ActionMessage, sessionId: string): Promise<void> {
    console.log(`[MiniBobIntegration] Action from ${sessionId}: ${action.action}`)

    if (action.action === 'clear_ui_components') {
      wsHandler.clearImpulses()
      return
    }

    // Convert action to query for goal processor
    await this.handleQuery(
      {
        type: 'query',
        id: action.id,
        text: `Execute action: ${action.action} on component ${action.componentId}`,
        timestamp: action.timestamp,
      },
      sessionId
    )
  }

  /**
   * Clean up session context
   */
  cleanupSession(sessionId: string): void {
    this.conversationContexts.delete(sessionId)
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let integration: MiniBobIntegration | null = null

export function getMiniBobIntegration(): MiniBobIntegration | null {
  return integration
}

export async function initializeMiniBobIntegration(
  config: MiniBobIntegrationConfig
): Promise<MiniBobIntegration> {
  if (integration) return integration

  integration = new MiniBobIntegration(config)
  await integration.initialize()

  return integration
}
