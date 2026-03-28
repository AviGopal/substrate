/**
 * Impulse Types for Internal Dashboard
 *
 * Following the impulse-pointer-mvp metadata pattern.
 * UI components as proper impulse pointer types with metadata and dataRef.
 */

import type {
  Primitive,
  PositionMode,
  SizeMode
} from './websocket-handler'

// ============================================================================
// Base Impulse Types (from impulse-pointer-mvp)
// ============================================================================

/** Priority levels for impulse loading */
export type ImpulsePriority = 'critical' | 'high' | 'medium' | 'low'

/** Base impulse pointer */
export interface ImpulsePointer {
  type: string
  [key: string]: unknown
}

/** Base impulse metadata */
export interface ImpulseMetadata {
  /** Human-readable summary of the impulse content */
  summary?: string
  /** Data shape description for LLM context */
  dataShape?: string
  /** Creation timestamp */
  createdAt?: number
  /** Last update timestamp */
  updatedAt?: number
  /** Custom metadata */
  [key: string]: unknown
}

/** Base impulse structure */
export interface Impulse<P extends ImpulsePointer = ImpulsePointer, M extends ImpulseMetadata = ImpulseMetadata> {
  id: string
  pointer: P
  budget: number
  priority: ImpulsePriority
  loaded: boolean
  content: unknown | null
  metadata?: M
  /** Reference to another impulse for data */
  dataRef?: string
  /** Protection from deletion */
  deletable?: boolean
}

// ============================================================================
// UI Component Pointer Types
// ============================================================================

/** UI component pointer - renders a primitive composition */
export interface UIComponentPointer extends ImpulsePointer {
  type: 'ui_component'
  /** The primitive composition tree */
  primitive: Primitive
  /** Layout positioning */
  position?: PositionMode
  /** Size control */
  size?: SizeMode
  /** Z-index layer */
  layer?: number
  /** Animation on mount */
  animation?: 'none' | 'fade' | 'slide' | 'scale'
}

/** UI component metadata */
export interface UIComponentMetadata extends ImpulseMetadata {
  /** Component type for quick identification */
  componentType?: string
  /** Query that created this component */
  queryId?: string
  /** Whether the component supports streaming updates */
  streaming?: boolean
  /** Interaction capabilities */
  interactive?: boolean
}

/** UI Component Impulse - the full impulse for UI rendering */
export type UIComponentImpulse = Impulse<UIComponentPointer, UIComponentMetadata>

// ============================================================================
// Data Impulse Types (for dataRef pattern)
// ============================================================================

/** Query result data pointer */
export interface QueryResultPointer extends ImpulsePointer {
  type: 'query_result'
  /** Query that produced this result */
  query: string
  /** Result data */
  data: unknown
  /** Pagination info if applicable */
  pagination?: {
    page: number
    pageSize: number
    total: number
  }
}

/** Query result metadata */
export interface QueryResultMetadata extends ImpulseMetadata {
  /** Number of rows/items */
  rowCount?: number
  /** Column names for tabular data */
  columns?: string[]
  /** Execution time */
  executionTime?: number
}

/** Query Result Impulse */
export type QueryResultImpulse = Impulse<QueryResultPointer, QueryResultMetadata>

/** Metrics data pointer */
export interface MetricsPointer extends ImpulsePointer {
  type: 'metrics'
  /** Metric name */
  name: string
  /** Time series data */
  timeSeries?: Array<{ timestamp: number; value: number }>
  /** Current value */
  current?: number
  /** Aggregations */
  aggregations?: {
    min?: number
    max?: number
    avg?: number
    sum?: number
    count?: number
  }
}

/** Metrics metadata */
export interface MetricsMetadata extends ImpulseMetadata {
  /** Unit of measurement */
  unit?: string
  /** Time range */
  timeRange?: {
    start: number
    end: number
  }
}

/** Metrics Impulse */
export type MetricsImpulse = Impulse<MetricsPointer, MetricsMetadata>

// ============================================================================
// Layout State Impulse (for get_layout_state tool)
// ============================================================================

/** Layout state pointer */
export interface LayoutStatePointer extends ImpulsePointer {
  type: 'layout_state'
  /** Viewport dimensions */
  viewport: {
    width: number
    height: number
  }
  /** Component bounds */
  components: Array<{
    id: string
    bounds: {
      x: number
      y: number
      width: number
      height: number
    }
    layer: number
  }>
  /** Available regions */
  availableRegions: {
    top: { x: number; y: number; width: number; height: number }
    bottom: { x: number; y: number; width: number; height: number }
    left: { x: number; y: number; width: number; height: number }
    right: { x: number; y: number; width: number; height: number }
    center: { x: number; y: number; width: number; height: number }
  }
}

/** Layout State Impulse */
export type LayoutStateImpulse = Impulse<LayoutStatePointer, ImpulseMetadata>

// ============================================================================
// Union Types
// ============================================================================

/** All dashboard impulse pointer types */
export type DashboardPointer =
  | UIComponentPointer
  | QueryResultPointer
  | MetricsPointer
  | LayoutStatePointer

/** All dashboard impulse types */
export type DashboardImpulse =
  | UIComponentImpulse
  | QueryResultImpulse
  | MetricsImpulse
  | LayoutStateImpulse

// ============================================================================
// Helper Functions
// ============================================================================

/** Create a UI component impulse */
export function createUIComponentImpulse(
  id: string,
  primitive: Primitive,
  options: {
    position?: PositionMode
    size?: SizeMode
    layer?: number
    animation?: 'none' | 'fade' | 'slide' | 'scale'
    dataRef?: string
    metadata?: Partial<UIComponentMetadata>
    deletable?: boolean
  } = {}
): UIComponentImpulse {
  return {
    id,
    pointer: {
      type: 'ui_component',
      primitive,
      position: options.position,
      size: options.size,
      layer: options.layer,
      animation: options.animation
    },
    budget: 0, // UI components don't consume token budget
    priority: 'high',
    loaded: true,
    content: null,
    dataRef: options.dataRef,
    deletable: options.deletable ?? true,
    metadata: {
      componentType: primitive.type,
      createdAt: Date.now(),
      ...options.metadata
    }
  }
}

/** Create a query result impulse */
export function createQueryResultImpulse(
  id: string,
  query: string,
  data: unknown,
  options: {
    pagination?: QueryResultPointer['pagination']
    metadata?: Partial<QueryResultMetadata>
  } = {}
): QueryResultImpulse {
  return {
    id,
    pointer: {
      type: 'query_result',
      query,
      data,
      pagination: options.pagination
    },
    budget: 1000, // Estimate token budget for data
    priority: 'medium',
    loaded: true,
    content: data,
    metadata: {
      createdAt: Date.now(),
      ...options.metadata
    }
  }
}

/** Check if impulse is a UI component */
export function isUIComponentImpulse(impulse: DashboardImpulse): impulse is UIComponentImpulse {
  return impulse.pointer.type === 'ui_component'
}

/** Check if impulse is a query result */
export function isQueryResultImpulse(impulse: DashboardImpulse): impulse is QueryResultImpulse {
  return impulse.pointer.type === 'query_result'
}
