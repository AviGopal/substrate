// activity-api-subscriber.ts
// Subscribes to the activity-api WebSocket broadcaster.
// When impulse.resolved events arrive for shapes in shape-mapping.json,
// the subscriber builds the appropriate primitive deterministically and
// creates (or replaces) a local impulse in the renderer's impulse store.
// No activity coordination required — the renderer reacts to the
// impulse state space directly.

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { impulseStore } from '../state/impulse-store'
import type { Primitive } from '../types'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ──────────────────────────────────────────────────────────────────────────────
// Shape mapping
// ──────────────────────────────────────────────────────────────────────────────

interface ShapeMappingEntry {
  type: string
  defaults?: Record<string, unknown>
  children?: Array<{ type: string; defaults?: Record<string, unknown> }>
}

type ShapeMapping = Record<string, ShapeMappingEntry>

function loadShapeMapping(): ShapeMapping {
  try {
    const p = join(__dirname, '../../config/shape-mapping.json')
    return JSON.parse(readFileSync(p, 'utf8')) as ShapeMapping
  } catch {
    return {}
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Primitive builder — deterministic, no LLM
// ──────────────────────────────────────────────────────────────────────────────

function firstArrayValue(obj: Record<string, unknown>): unknown[] | null {
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) return v
  }
  return null
}

function buildPrimitive(shape: string, payload: unknown, mapping: ShapeMappingEntry): Primitive | null {
  const data = (typeof payload === 'object' && payload !== null)
    ? payload as Record<string, unknown>
    : {}

  switch (mapping.type) {
    case 'graph': {
      const nodes = (data.nodes ?? []) as unknown[]
      const edges = (data.edges ?? data.links ?? []) as unknown[]
      if (!nodes.length) return null
      return { type: 'graph', nodes, edges, ...mapping.defaults } as unknown as Primitive
    }

    case 'data-table-v2': {
      const rows = Array.isArray(data) ? data : firstArrayValue(data)
      if (!rows?.length) return null
      const columns = Object.keys(rows[0] as Record<string, unknown>).map((k) => ({
        key: k,
        header: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      }))
      return { type: 'data-table-v2', columns, data: rows, ...mapping.defaults } as unknown as Primitive
    }

    case 'chart': {
      const rows = Array.isArray(data) ? data : firstArrayValue(data)
      if (!rows?.length) return null
      return { type: 'chart', chartType: 'bar', data: rows, ...mapping.defaults } as unknown as Primitive
    }

    case 'text': {
      const content = typeof data.content === 'string' ? data.content
        : typeof data.body === 'string' ? data.body
        : typeof data.text === 'string' ? data.text
        : JSON.stringify(data, null, 2)
      return { type: 'text', content, ...mapping.defaults } as unknown as Primitive
    }

    case 'code':
      return {
        type: 'code',
        language: (mapping.defaults?.language as string) ?? 'json',
        code: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2),
        ...mapping.defaults,
      } as unknown as Primitive

    default:
      // Unknown mapping type — show raw JSON as code
      return {
        type: 'code',
        language: 'json',
        code: JSON.stringify(payload, null, 2),
      } as unknown as Primitive
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Shape slot filling
//
// Two strategies, tried in order:
//
// 1. Slot fill: walk all existing impulse primitive trees looking for
//    shape-slot nodes whose .shape matches. Fill them in-place — the layout
//    skeleton is already on screen; the slot just becomes real content.
//    This is the preferred path when an activity has declared the layout first.
//
// 2. Top-level insert: if no matching slot exists, create a new top-level
//    flow impulse (one per shape type — updates in-place on re-resolution).
//    This is the fallback when no layout was prescribed.
// ──────────────────────────────────────────────────────────────────────────────

type MutablePrimitive = Record<string, unknown>

// Walk a primitive tree; call visitor on every node. Returns true if any node was mutated.
function walkAndFill(node: MutablePrimitive, shape: string, filled: Primitive): boolean {
  if (node.type === 'shape-slot' && node.shape === shape) {
    node.filled = filled
    return true
  }
  let mutated = false
  // Container children
  if (Array.isArray(node.children)) {
    for (const child of node.children as MutablePrimitive[]) {
      if (walkAndFill(child, shape, filled)) mutated = true
    }
  }
  return mutated
}

function tryFillSlots(shape: string, filled: Primitive): boolean {
  let anyFilled = false
  for (const impulse of impulseStore.getAll()) {
    const root = (impulse.content ?? impulse.pointer?.primitive) as unknown as MutablePrimitive | undefined
    if (!root) continue
    // Deep-clone root so we can mutate safely, then check if anything changed
    const clone = JSON.parse(JSON.stringify(root)) as MutablePrimitive
    if (walkAndFill(clone, shape, filled)) {
      impulseStore.update(impulse.id, {
        content: clone as unknown as Primitive,
        pointer: { ...impulse.pointer, primitive: clone as unknown as Primitive },
      })
      anyFilled = true
    }
  }
  return anyFilled
}

const topLevelSlots = new Map<string, string>() // shape → impulse id (fallback path)

function upsertTopLevel(shape: string, primitive: Primitive): void {
  const existingId = topLevelSlots.get(shape)
  if (existingId && impulseStore.get(existingId)) {
    impulseStore.update(existingId, {
      content: primitive,
      pointer: {
        ...impulseStore.get(existingId)!.pointer,
        primitive,
      },
    })
  } else {
    const impulse = impulseStore.create(primitive, {
      dataRef: shape,
      metadata: { componentType: 'data-binding', sourceShape: shape },
    })
    topLevelSlots.set(shape, impulse.id)
  }
}

function upsertShapeSlot(shape: string, primitive: Primitive): void {
  const filledASlot = tryFillSlots(shape, primitive)
  if (!filledASlot) {
    // No layout declared a slot for this shape — add as a top-level card
    upsertTopLevel(shape, primitive)
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// WebSocket subscriber
// ──────────────────────────────────────────────────────────────────────────────

export class ActivityApiSubscriber {
  private ws: WebSocket | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private stopped = false
  private mapping: ShapeMapping

  constructor(private readonly wsUrl: string, private readonly apiKey?: string) {
    this.mapping = loadShapeMapping()
  }

  start(): void {
    this.stopped = false
    this.connect()
  }

  stop(): void {
    this.stopped = true
    this.timer && clearTimeout(this.timer)
    this.ws?.close()
  }

  private connect(): void {
    if (this.stopped) return

    console.log(`[ActivityApiSubscriber] Connecting to ${this.wsUrl}`)
    // Bun's WebSocket supports the standard browser API
    const ws = new WebSocket(this.wsUrl)
    this.ws = ws

    ws.onopen = () => {
      console.log('[ActivityApiSubscriber] Connected')
      if (this.apiKey) {
        ws.send(JSON.stringify({ type: 'authenticate', token: this.apiKey }))
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string)
        this.handle(msg)
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      if (!this.stopped) {
        const delay = 5000
        console.log(`[ActivityApiSubscriber] Disconnected — reconnecting in ${delay}ms`)
        this.timer = setTimeout(() => this.connect(), delay)
      }
    }

    ws.onerror = () => ws.close()
  }

  private handle(msg: Record<string, unknown>): void {
    // activity-api broadcasts: impulse.resolved, task.completed, task.started, tool.call
    if (msg.type !== 'impulse.resolved') return

    const shape = (msg.shape ?? (msg as any).data?.shape) as string | undefined
    const body = (msg.body ?? (msg as any).data?.body) as unknown

    if (!shape || body === undefined) return

    const entry = this.mapping[shape]
    if (!entry) return // shape not in our mapping — skip

    const primitive = buildPrimitive(shape, body, entry)
    if (!primitive) return

    console.log(`[ActivityApiSubscriber] Rendering resolved shape: ${shape}`)
    upsertShapeSlot(shape, primitive)
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Factory — reads config from environment
// ──────────────────────────────────────────────────────────────────────────────

export function createActivityApiSubscriber(): ActivityApiSubscriber | null {
  const wsUrl = process.env.ACTIVITY_API_WS_URL
  if (!wsUrl) return null // opt-in: only active when configured

  const apiKey = process.env.METABOB_API_KEY
  return new ActivityApiSubscriber(wsUrl, apiKey)
}
