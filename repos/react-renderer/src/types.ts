// Core types for react-renderer vessel

// ============================================================================
// Primitives - Composable UI building blocks
// ============================================================================

export type PrimitiveType =
  | 'container'
  | 'text'
  | 'data-table'
  | 'data-table-v2'
  | 'chart'
  | 'graph'
  | 'input'
  | 'button'
  | 'badge'
  | 'progress'
  | 'code'
  | 'image'
  | 'custom'
  | 'design_token'
  | 'form'
  | 'shape-slot'

export interface BasePrimitive {
  type: PrimitiveType
  id?: string
}

export interface ContainerPrimitive extends BasePrimitive {
  type: 'container'
  layout: 'vertical' | 'horizontal' | 'grid' | 'absolute'
  gap?: number
  padding?: number | string
  className?: string
  children: Primitive[]
  // Sizing
  width?: number | string
  height?: number | string
  maxWidth?: number | string
  minHeight?: number | string
  // Grid control
  columns?: number
  // Flex alignment
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'stretch'
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  wrap?: boolean
  // Overflow
  overflow?: 'hidden' | 'scroll' | 'auto' | 'visible'
  // Style
  background?: string
  border?: string
  borderRadius?: number | string
  naked?: boolean  // render without Card wrapper
}

export interface TextPrimitive extends BasePrimitive {
  type: 'text'
  content: string
  variant?: 'heading' | 'subheading' | 'body' | 'caption' | 'code'
  format?: 'plain' | 'markdown' | 'code'
  className?: string
}

export interface DataTablePrimitive extends BasePrimitive {
  type: 'data-table'
  columns: Array<{
    key: string
    header: string
    width?: string
    sortable?: boolean
  }>
  data: Record<string, unknown>[]
  pagination?: { pageSize: number; page: number }
  onRowClick?: string // Action ID
}

export interface ChartPrimitive extends BasePrimitive {
  type: 'chart'
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'gauge' | 'sparkline'
  data: Array<Record<string, unknown>>
  xKey?: string
  yKey?: string
  title?: string
  height?: number
}

export interface GraphPrimitive extends BasePrimitive {
  type: 'graph'
  nodes: Array<{
    id: string
    label: string
    color?: string
    size?: number
  }>
  edges: Array<{
    source: string
    target: string
    label?: string
    weight?: number
  }>
  layout?: 'force' | 'hierarchical' | 'circular' | 'grid'
  height?: number
}

export interface InputPrimitive extends BasePrimitive {
  type: 'input'
  inputType: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'radio'
  label?: string
  placeholder?: string
  value?: unknown
  options?: Array<{ value: string; label: string }>
  onChange?: string // Action ID
}

export interface ButtonPrimitive extends BasePrimitive {
  type: 'button'
  label: string
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost'
  onClick: string // Action ID
  disabled?: boolean
  loading?: boolean
  confirm?: { title: string; message: string }
}

export interface BadgePrimitive extends BasePrimitive {
  type: 'badge'
  text: string
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'
}

export interface ProgressPrimitive extends BasePrimitive {
  type: 'progress'
  progressType: 'bar' | 'circle' | 'gauge'
  value: number
  max?: number
  label?: string
  showValue?: boolean
}

export interface CodePrimitive extends BasePrimitive {
  type: 'code'
  code: string
  language?: string
  showLineNumbers?: boolean
  highlightLines?: number[]
}

export interface ImagePrimitive extends BasePrimitive {
  type: 'image'
  src: string
  alt?: string
  width?: number | string
  height?: number | string
}

export interface CustomPrimitive extends BasePrimitive {
  type: 'custom'
  component: string
  props: Record<string, unknown>
}

export interface DataTableTanstackCorePrimitive extends BasePrimitive {
  type: 'data-table-v2'
  columns: Array<{
    key: string
    header: string
    type?: 'text' | 'number' | 'date' | 'status'
    sortable?: boolean
    width?: string
  }>
  data: Record<string, unknown>[]
  pageSize?: number
  onRowClick?: string
  virtual?: boolean
}

export interface DesignTokenPrimitive extends BasePrimitive {
  type: 'design_token'
  content: Record<string, string>
}

export interface FormField {
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'radio' | 'textarea'
  required?: boolean
  errorMessage?: string
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  defaultValue?: unknown
}

export interface FormPrimitive extends BasePrimitive {
  type: 'form'
  fields: FormField[]
  submitLabel?: string
  action?: string
  steps?: Array<{ title: string; fields: string[] }>
}

// A placeholder inside a layout that fills itself when a matching shape resolves.
// The subscriber walks the primitive tree looking for shape-slot nodes and
// replaces their content once the shape is available.
export interface ShapeSlotPrimitive extends BasePrimitive {
  type: 'shape-slot'
  shape: string           // impulse shape that fills this slot, e.g. 'conceptGraph'
  label?: string          // display name while pending
  vessel?: string         // vessel that owns the shape — shown in the pointer badge
  height?: number         // reserved height while pending (px)
  filled?: Primitive      // set by subscriber when shape resolves
}

export type Primitive =
  | ContainerPrimitive
  | TextPrimitive
  | DataTablePrimitive
  | DataTableTanstackCorePrimitive
  | ChartPrimitive
  | GraphPrimitive
  | InputPrimitive
  | ButtonPrimitive
  | BadgePrimitive
  | ProgressPrimitive
  | CodePrimitive
  | ImagePrimitive
  | CustomPrimitive
  | DesignTokenPrimitive
  | FormPrimitive
  | ShapeSlotPrimitive

// ============================================================================
// Position Modes
// ============================================================================

export type PositionMode =
  | { type: 'flow' }
  | { type: 'below-input' }
  | { type: 'center' }
  | { type: 'absolute'; x: number; y: number }

// ============================================================================
// Impulse Types
// ============================================================================

export interface UIComponentPointer {
  type: 'ui_component'
  primitive: Primitive
  position?: PositionMode
  size?: { width: string; height: string } | 'auto'
  layer?: number
  animation?: 'none' | 'fade' | 'slide' | 'scale'
}

export interface UIStatePointer {
  type: 'ui_state'
  path: string
  query?: Record<string, unknown>
  limit?: number
}

export interface UIEventPointer {
  type: 'ui_event'
  event: string
  payload: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface ViewportStatePointer {
  type: 'viewport_state'
  includeImpulses?: boolean
}

export type ImpulsePointer =
  | UIComponentPointer
  | UIStatePointer
  | UIEventPointer
  | ViewportStatePointer

export interface UIComponentImpulse {
  id: string
  pointer: UIComponentPointer
  budget: number
  priority: 'critical' | 'high' | 'medium' | 'low'
  loaded: boolean
  content: Primitive | null
  metadata?: {
    componentType?: string
    queryId?: string
    streaming?: boolean
    interactive?: boolean
    sourceShape?: string  // shape that produced this impulse via the activity-api subscriber
  }
  dataRef?: string
  deletable?: boolean
  createdAt: number
  updatedAt: number
}

// ============================================================================
// WebSocket Protocol
// ============================================================================

export interface QueryMessage {
  type: 'query'
  id: string
  text: string
  timestamp: number
  context?: {
    previousQueryId?: string
    componentRefs?: string[]
  }
}

export interface ActionMessage {
  type: 'action'
  id: string
  componentId: string
  action: string
  payload?: Record<string, unknown>
  timestamp: number
}

export interface ViewportMessage {
  type: 'viewport'
  width: number
  height: number
}

export interface PingMessage {
  type: 'ping'
}

export type ClientMessage =
  | QueryMessage
  | ActionMessage
  | ViewportMessage
  | PingMessage

export interface ConnectedMessage {
  type: 'connected'
  sessionId: string
  capabilities: string[]
}

export interface ThinkingMessage {
  type: 'thinking'
  queryId: string
  message: string
}

export interface ImpulseCreateMessage {
  type: 'impulse_create'
  impulse: UIComponentImpulse
  timestamp: number
}

export interface ImpulseUpdateMessage {
  type: 'impulse_update'
  id: string
  patch: Partial<UIComponentImpulse>
  timestamp: number
}

export interface ImpulseDeleteMessage {
  type: 'impulse_delete'
  id: string
  timestamp: number
}

export interface StateSyncMessage {
  type: 'state_sync'
  impulses: UIComponentImpulse[]
  timestamp: number
}

export interface ActivityCompleteMessage {
  type: 'activity_complete'
  queryId: string
  success: boolean
  error?: string
  timestamp: number
}

export interface ErrorMessage {
  type: 'error'
  message: string
  code?: string
}

export type ServerMessage =
  | ConnectedMessage
  | ThinkingMessage
  | ImpulseCreateMessage
  | ImpulseUpdateMessage
  | ImpulseDeleteMessage
  | StateSyncMessage
  | ActivityCompleteMessage
  | ErrorMessage

// ============================================================================
// Resolver Types
// ============================================================================

export type ResolverFunction<T extends ImpulsePointer = ImpulsePointer> = (
  pointer: T
) => Promise<unknown>

export interface Resolver {
  type: string
  resolve: ResolverFunction
}

// ============================================================================
// Viewport State
// ============================================================================

export interface ViewportState {
  width: number
  height: number
  visibleImpulses: string[]
  budgetAllocation: Map<string, number>
  displayPriority: Map<string, number>
  filters: {
    shape?: string
    minPriority?: 'critical' | 'high' | 'medium' | 'low'
    timeRange?: [Date, Date]
  }
}

// ============================================================================
// Learning Metrics
// ============================================================================

export interface UIInteractionMetric {
  executionId: string
  templateId: string
  variant: string
  outcome: 'success' | 'failure'
  timeToAction: number
  impulseUtilization: number
  navigationClicks: number
  createdAt: Date
}
