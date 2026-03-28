/**
 * WebSocket Handler for Internal Dashboard
 *
 * Manages WebSocket connections, message routing, and state broadcasting.
 * Integrates with MiniBob for query processing and UI control.
 */

import type { ServerWebSocket } from 'bun'

// ============================================================================
// Message Types (Task 3.2)
// ============================================================================

/** Base message structure */
export interface BaseMessage {
  type: string
  id?: string
  timestamp?: number
}

/** Query message from client */
export interface QueryMessage extends BaseMessage {
  type: 'query'
  text: string
  context?: {
    previousQueryId?: string
    componentRefs?: string[]
  }
}

/** Viewport information from client */
export interface ViewportMessage extends BaseMessage {
  type: 'viewport' | 'viewport_resize'
  width: number
  height: number
}

/** Action message from client (button click, row select, etc.) */
export interface ActionMessage extends BaseMessage {
  type: 'action'
  action: string
  componentId: string
  payload?: unknown
}

/** Ping/pong for connection health */
export interface PingMessage extends BaseMessage {
  type: 'ping'
}

export interface PongMessage extends BaseMessage {
  type: 'pong'
}

/** Connection established acknowledgment */
export interface ConnectedMessage extends BaseMessage {
  type: 'connected'
  sessionId: string
  capabilities: string[]
}

/** Thinking indicator during MiniBob processing */
export interface ThinkingMessage extends BaseMessage {
  type: 'thinking'
  queryId: string
  content: string
}

/** Tool call progress */
export interface ToolCallMessage extends BaseMessage {
  type: 'tool_call'
  queryId: string
  tool: string
  status: 'started' | 'completed' | 'failed'
  result?: unknown
  error?: string
}

/** Impulse lifecycle events */
export interface ImpulseCreateMessage extends BaseMessage {
  type: 'impulse_create'
  impulse: UIComponentImpulse
}

export interface ImpulseUpdateMessage extends BaseMessage {
  type: 'impulse_update'
  impulseId: string
  patch: Partial<UIComponentImpulse>
}

export interface ImpulseDeleteMessage extends BaseMessage {
  type: 'impulse_delete'
  impulseId: string
}

/** Activity completion */
export interface ActivityCompleteMessage extends BaseMessage {
  type: 'activity_complete'
  queryId: string
  success: boolean
  duration: number
  error?: string
}

/** Full state sync (sent on reconnection) */
export interface StateSyncMessage extends BaseMessage {
  type: 'state_sync'
  impulses: UIComponentImpulse[]
  viewport?: { width: number; height: number }
}

/** Error message */
export interface ErrorMessage extends BaseMessage {
  type: 'error'
  error: string
  code?: string
  queryId?: string
}

// ============================================================================
// UI Component Impulse Types (Task 4.1 preview)
// ============================================================================

/** Position modes for layout control */
export type PositionMode =
  | { type: 'flow' }
  | { type: 'below-input' }
  | { type: 'absolute'; x: number; y: number }
  | { type: 'anchor'; componentId: string; edge: 'top' | 'bottom' | 'left' | 'right'; offset?: number }
  | { type: 'region'; region: 'top' | 'bottom' | 'left' | 'right' | 'center' }

/** Sizing modes */
export type SizeMode =
  | { type: 'auto' }
  | { type: 'explicit'; width?: string; height?: string }
  | { type: 'fill' }

/** UI Component Impulse - the core data structure for UI control */
export interface UIComponentImpulse {
  id: string
  type: 'ui_component'

  /** The primitive composition tree */
  primitive: Primitive

  /** Layout positioning */
  position?: PositionMode

  /** Size control */
  size?: SizeMode

  /** Z-index layer (0 = default, higher = overlay) */
  layer?: number

  /** Animation on mount */
  animation?: 'none' | 'fade' | 'slide' | 'scale'

  /** Reference to data impulse for dynamic data */
  dataRef?: string

  /** Metadata for LLM context */
  metadata?: {
    summary?: string
    dataShape?: string
    createdAt?: number
    queryId?: string
  }

  /** Protection flag */
  deletable?: boolean
}

/** Base primitive type */
export interface BasePrimitive {
  type: string
  style?: Record<string, string | number>
}

/** Container primitive */
export interface ContainerPrimitive extends BasePrimitive {
  type: 'container'
  layout?: 'vertical' | 'horizontal' | 'grid' | 'absolute'
  gap?: string
  padding?: string
  columns?: number
  children?: Primitive[]
}

/** Text primitive */
export interface TextPrimitive extends BasePrimitive {
  type: 'text'
  content: string
  format?: 'plain' | 'markdown' | 'code'
  variant?: 'heading' | 'subheading' | 'body' | 'caption' | 'label'
}

/** Data table primitive */
export interface DataTablePrimitive extends BasePrimitive {
  type: 'data-table'
  columns: Array<{
    key: string
    label: string
    render?: 'text' | 'number' | 'date' | 'badge' | 'progress' | 'custom'
  }>
  rows: Array<Record<string, unknown>>
  pagination?: { page: number; pageSize: number; total: number }
  sortable?: boolean
  rowAction?: { tool: string; params?: Record<string, string> }
}

/** Chart primitive */
export interface ChartPrimitive extends BasePrimitive {
  type: 'chart'
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'gauge' | 'sparkline'
  data: Array<Record<string, unknown>>
  xAxis?: string
  yAxis?: string | string[]
  colors?: string[]
}

/** Graph primitive */
export interface GraphPrimitive extends BasePrimitive {
  type: 'graph'
  nodes: Array<{ id: string; label: string; data?: unknown }>
  edges: Array<{ source: string; target: string; label?: string; weight?: number }>
  layout?: 'force-directed' | 'hierarchical' | 'circular' | 'grid'
  nodeAction?: { tool: string; params?: Record<string, string> }
}

/** Input primitive */
export interface InputPrimitive extends BasePrimitive {
  type: 'input'
  inputType: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'radio'
  label?: string
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  onSubmit?: { tool: string; params?: Record<string, string> }
}

/** Button primitive */
export interface ButtonPrimitive extends BasePrimitive {
  type: 'button'
  label: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  onClick: { tool: string; params?: Record<string, string> }
  confirm?: { title: string; message: string }
}

/** Badge primitive */
export interface BadgePrimitive extends BasePrimitive {
  type: 'badge'
  text: string
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
}

/** Progress primitive */
export interface ProgressPrimitive extends BasePrimitive {
  type: 'progress'
  progressType?: 'bar' | 'circle' | 'gauge'
  value: number
  max?: number
  label?: string
}

/** Code primitive */
export interface CodePrimitive extends BasePrimitive {
  type: 'code'
  code: string
  language?: string
  lineNumbers?: boolean
}

/** Image primitive */
export interface ImagePrimitive extends BasePrimitive {
  type: 'image'
  src: string
  alt?: string
}

/** Union of all primitive types */
export type Primitive =
  | ContainerPrimitive
  | TextPrimitive
  | DataTablePrimitive
  | ChartPrimitive
  | GraphPrimitive
  | InputPrimitive
  | ButtonPrimitive
  | BadgePrimitive
  | ProgressPrimitive
  | CodePrimitive
  | ImagePrimitive

/** Union of all client-to-server messages */
export type ClientMessage =
  | QueryMessage
  | ViewportMessage
  | ActionMessage
  | PingMessage

/** Union of all server-to-client messages */
export type ServerMessage =
  | ConnectedMessage
  | PongMessage
  | ThinkingMessage
  | ToolCallMessage
  | ImpulseCreateMessage
  | ImpulseUpdateMessage
  | ImpulseDeleteMessage
  | ActivityCompleteMessage
  | StateSyncMessage
  | ErrorMessage

// ============================================================================
// Connection State
// ============================================================================

interface ConnectionState {
  sessionId: string
  connectedAt: number
  viewport?: { width: number; height: number }
  lastPing?: number
}

// ============================================================================
// WebSocket Handler
// ============================================================================

export class WebSocketHandler {
  private connections: Map<ServerWebSocket<ConnectionState>, ConnectionState> = new Map()
  private impulseState: Map<string, UIComponentImpulse> = new Map()
  private queryHandler?: (query: QueryMessage, sessionId: string) => Promise<void>
  private actionHandler?: (action: ActionMessage, sessionId: string) => Promise<void>

  constructor() {
    // No protected impulses needed - QueryInput component handles query input
    // The impulse state starts empty and gets populated via createImpulse()
  }

  /** Set handler for query messages */
  onQuery(handler: (query: QueryMessage, sessionId: string) => Promise<void>) {
    this.queryHandler = handler
  }

  /** Set handler for action messages */
  onAction(handler: (action: ActionMessage, sessionId: string) => Promise<void>) {
    this.actionHandler = handler
  }

  /** Handle new WebSocket connection */
  handleOpen(ws: ServerWebSocket<ConnectionState>) {
    const sessionId = crypto.randomUUID()
    const state: ConnectionState = {
      sessionId,
      connectedAt: Date.now()
    }

    this.connections.set(ws, state)

    // Send connected acknowledgment
    this.send(ws, {
      type: 'connected',
      sessionId,
      capabilities: [
        'query',
        'action',
        'impulse_create',
        'impulse_update',
        'impulse_delete',
        'state_sync'
      ],
      timestamp: Date.now()
    })

    // Send full state sync
    this.sendStateSync(ws)

    console.log(`[WebSocket] Client connected: ${sessionId}`)
  }

  /** Handle incoming WebSocket message */
  async handleMessage(ws: ServerWebSocket<ConnectionState>, message: string | Buffer) {
    const state = this.connections.get(ws)
    if (!state) return

    try {
      const data = JSON.parse(message.toString()) as ClientMessage

      switch (data.type) {
        case 'ping':
          state.lastPing = Date.now()
          this.send(ws, { type: 'pong', timestamp: Date.now() })
          break

        case 'viewport':
        case 'viewport_resize':
          state.viewport = { width: data.width, height: data.height }
          break

        case 'query':
          if (this.queryHandler) {
            await this.queryHandler(data, state.sessionId)
          } else {
            this.send(ws, {
              type: 'error',
              error: 'Query handler not configured',
              code: 'NO_HANDLER',
              queryId: data.id
            })
          }
          break

        case 'action':
          if (this.actionHandler) {
            await this.actionHandler(data, state.sessionId)
          } else {
            this.send(ws, {
              type: 'error',
              error: 'Action handler not configured',
              code: 'NO_HANDLER'
            })
          }
          break

        default:
          console.warn(`[WebSocket] Unknown message type: ${(data as BaseMessage).type}`)
      }
    } catch (error) {
      console.error('[WebSocket] Error handling message:', error)
      this.send(ws, {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'PARSE_ERROR'
      })
    }
  }

  /** Handle WebSocket close */
  handleClose(ws: ServerWebSocket<ConnectionState>) {
    const state = this.connections.get(ws)
    if (state) {
      console.log(`[WebSocket] Client disconnected: ${state.sessionId}`)
      this.connections.delete(ws)
    }
  }

  // ============================================================================
  // Impulse Management
  // ============================================================================

  /** Create a new UI component impulse */
  createImpulse(impulse: UIComponentImpulse) {
    // Validate primitive (warn on unknown, don't fail)
    this.validatePrimitive(impulse.primitive)

    this.impulseState.set(impulse.id, impulse)
    this.broadcast({
      type: 'impulse_create',
      impulse,
      timestamp: Date.now()
    })
  }

  /** Update an existing impulse */
  updateImpulse(impulseId: string, patch: Partial<UIComponentImpulse>) {
    const existing = this.impulseState.get(impulseId)
    if (!existing) {
      console.warn(`[WebSocket] Impulse not found for update: ${impulseId}`)
      return
    }

    const updated = { ...existing, ...patch }
    this.impulseState.set(impulseId, updated)
    this.broadcast({
      type: 'impulse_update',
      impulseId,
      patch,
      timestamp: Date.now()
    })
  }

  /** Delete an impulse */
  deleteImpulse(impulseId: string) {
    const existing = this.impulseState.get(impulseId)
    if (!existing) {
      console.warn(`[WebSocket] Impulse not found for delete: ${impulseId}`)
      return
    }

    if (existing.deletable === false) {
      console.warn(`[WebSocket] Cannot delete protected impulse: ${impulseId}`)
      return
    }

    this.impulseState.delete(impulseId)
    this.broadcast({
      type: 'impulse_delete',
      impulseId,
      timestamp: Date.now()
    })
  }

  /** Clear all impulses except protected ones */
  clearImpulses(except: string[] = []) {
    const protected_ = new Set(except)

    for (const [id, impulse] of this.impulseState) {
      if (!protected_.has(id) && impulse.deletable !== false) {
        this.impulseState.delete(id)
        this.broadcast({
          type: 'impulse_delete',
          impulseId: id,
          timestamp: Date.now()
        })
      }
    }
  }

  /** Get current impulse state */
  getImpulseState(): UIComponentImpulse[] {
    return Array.from(this.impulseState.values())
  }

  // ============================================================================
  // Broadcasting
  // ============================================================================

  /** Send message to specific client */
  private send(ws: ServerWebSocket<ConnectionState>, message: ServerMessage) {
    try {
      ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('[WebSocket] Error sending message:', error)
    }
  }

  /** Broadcast message to all connected clients */
  broadcast(message: ServerMessage) {
    const data = JSON.stringify(message)
    for (const ws of this.connections.keys()) {
      try {
        ws.send(data)
      } catch (error) {
        console.error('[WebSocket] Error broadcasting to client:', error)
      }
    }
  }

  /** Send thinking message for a query */
  sendThinking(queryId: string, content: string) {
    this.broadcast({
      type: 'thinking',
      queryId,
      content,
      timestamp: Date.now()
    })
  }

  /** Send tool call progress */
  sendToolCall(queryId: string, tool: string, status: 'started' | 'completed' | 'failed', result?: unknown, error?: string) {
    this.broadcast({
      type: 'tool_call',
      queryId,
      tool,
      status,
      result,
      error,
      timestamp: Date.now()
    })
  }

  /** Send activity completion */
  sendActivityComplete(queryId: string, success: boolean, duration: number, error?: string) {
    this.broadcast({
      type: 'activity_complete',
      queryId,
      success,
      duration,
      error,
      timestamp: Date.now()
    })
  }

  /** Send full state sync to specific client */
  private sendStateSync(ws: ServerWebSocket<ConnectionState>) {
    const state = this.connections.get(ws)
    this.send(ws, {
      type: 'state_sync',
      impulses: this.getImpulseState(),
      viewport: state?.viewport,
      timestamp: Date.now()
    })
  }

  // ============================================================================
  // Validation
  // ============================================================================

  private validatePrimitive(primitive: Primitive, path: string = 'root') {
    const knownTypes = [
      'container', 'text', 'data-table', 'chart', 'graph',
      'input', 'button', 'badge', 'progress', 'code', 'image'
    ]

    if (!knownTypes.includes(primitive.type)) {
      console.warn(`[WebSocket] Unknown primitive type at ${path}: ${primitive.type}`)
    }

    // Recursively validate children
    if (primitive.type === 'container' && (primitive as ContainerPrimitive).children) {
      for (const [i, child] of ((primitive as ContainerPrimitive).children || []).entries()) {
        this.validatePrimitive(child, `${path}.children[${i}]`)
      }
    }
  }

  // ============================================================================
  // Stats
  // ============================================================================

  getConnectionCount(): number {
    return this.connections.size
  }

  getImpulseCount(): number {
    return this.impulseState.size
  }
}

export const wsHandler = new WebSocketHandler()
