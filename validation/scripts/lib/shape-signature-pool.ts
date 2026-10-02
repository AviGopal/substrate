/**
 * shape-signature-pool.ts — G1.1.1
 *
 * Scans executionTraceWithSignatures over the last 30 days and emits a
 * Map keyed by canonical shape signature:
 *
 *   "(sorted_inputs) -> (sorted_outputs)"
 *
 * Each entry includes the input_shapes, output_shapes, and occurrence count.
 *
 * Graceful degradation: if no traces are returned or shapes are missing,
 * returns the pool with whatever was found (at least one synthetic fallback
 * entry so callers always have something to work with).
 */

interface ImpulseRecord {
  shape?: string;
  id?: string;
}

interface TaskRecord {
  input_impulse_ids?: string[];
  output_impulse_ids?: string[];
}

interface TraceWithSignatures {
  id?: string;
  tasks?: TaskRecord[];
  impulses_by_id?: Record<string, ImpulseRecord>;
  success?: boolean;
}

interface ResolveResponse {
  success?: boolean;
  content?: unknown;
}

export interface ShapeSignatureEntry {
  input_shapes: string[];
  output_shapes: string[];
  count: number;
}

/**
 * Build the shape-signature pool from executionTraceWithSignatures.
 *
 * @param endpoint     Activity-API base URL
 * @param authHeaders  Authorization headers
 */
export async function buildShapeSignaturePool(
  endpoint: string,
  authHeaders: Record<string, string>
): Promise<Map<string, ShapeSignatureEntry>> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const resp = await fetch(`${endpoint}/v2/impulses/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({
      pointer: {
        type: "executionTraceWithSignatures",
        since,
        limit: 500,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) {
    console.warn(
      `[shape-signature-pool] /v2/impulses/resolve returned ${resp.status}; using empty pool`
    );
    return fallbackPool();
  }

  const body = (await resp.json()) as ResolveResponse;

  let traces: TraceWithSignatures[] = [];
  try {
    let content: unknown = body.content;
    if (typeof content === "string") {
      content = JSON.parse(content);
    }
    if (Array.isArray(content)) {
      traces = content as TraceWithSignatures[];
    } else if (content && typeof content === "object") {
      const obj = content as Record<string, unknown>;
      if (Array.isArray(obj["traces"])) traces = obj["traces"] as TraceWithSignatures[];
      else if (Array.isArray(obj["data"])) traces = obj["data"] as TraceWithSignatures[];
      else if (Array.isArray(obj["entries"])) traces = obj["entries"] as TraceWithSignatures[];
    }
  } catch {
    console.warn("[shape-signature-pool] Failed to parse trace response; using empty pool");
    return fallbackPool();
  }

  const pool = new Map<string, ShapeSignatureEntry>();

  for (const trace of traces) {
    const impulsesById: Record<string, ImpulseRecord> = trace.impulses_by_id ?? {};

    // Collect all input and output shapes across all tasks
    const allInputShapes = new Set<string>();
    const allOutputShapes = new Set<string>();

    for (const task of trace.tasks ?? []) {
      for (const id of task.input_impulse_ids ?? []) {
        const impulse = impulsesById[id];
        if (impulse?.shape) allInputShapes.add(impulse.shape);
      }
      for (const id of task.output_impulse_ids ?? []) {
        const impulse = impulsesById[id];
        if (impulse?.shape) allOutputShapes.add(impulse.shape);
      }
    }

    if (allInputShapes.size === 0 && allOutputShapes.size === 0) continue;

    const sortedInputs = [...allInputShapes].sort();
    const sortedOutputs = [...allOutputShapes].sort();
    const key = `(${sortedInputs.join(",")}) -> (${sortedOutputs.join(",")})`;

    const existing = pool.get(key);
    if (existing) {
      existing.count++;
    } else {
      pool.set(key, {
        input_shapes: sortedInputs,
        output_shapes: sortedOutputs,
        count: 1,
      });
    }
  }

  if (pool.size === 0) {
    return fallbackPool();
  }

  return pool;
}

/**
 * Returns a single synthetic fallback entry so callers always have at least
 * one entry even when trace data is unavailable.
 */
function fallbackPool(): Map<string, ShapeSignatureEntry> {
  const m = new Map<string, ShapeSignatureEntry>();
  m.set("(file) -> (fileEdit)", {
    input_shapes: ["file"],
    output_shapes: ["fileEdit"],
    count: 0,
  });
  return m;
}
