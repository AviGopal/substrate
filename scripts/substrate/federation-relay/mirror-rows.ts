// Which of this substrate's registry rows the hub mirror carries, as `<vesselId>@<substrate>` rows in the hub's namespace.
//
// Skipped, as before: this transport itself and its own mirror row, any libp2p-protocol row (another substrate's mirror:
// re-exporting it would ping-pong namespaces), an already-qualified `x@substrate` id, a row whose only endpoint is
// cross-host-dead, and a row serving nothing.
//
// Skipped now as well: a row whose every shape discovery answers itself. Discovery's /resolve answers those before any
// routing, on every node, so a remote copy of such a row is never a producer anyone is routed to; mirrored, it only made a
// hub caller routed by shape land on a spoke's discovery and read that spoke's fleet. Today that is discovery's own row,
// which it now keeps registered. A row serving one of those shapes beside any other is still mirrored: its other shapes
// route. The set is read from discovery's public /shapes; when it cannot be read, every row is mirrored, as before.

export type RegistryRow = { vesselId?: unknown; protocol?: unknown; endpoint?: unknown; shapes?: unknown }

export function mirrorRows(
  vessels: RegistryRow[], own: string, unreachable: RegExp, discoveryLocal: ReadonlySet<string> | null,
): Array<{ vesselId: string; shapes: string[] }> {
  const rows: Array<{ vesselId: string; shapes: string[] }> = []
  for (const v of vessels) {
    const id = String(v?.vesselId ?? '')
    if (!id || id.startsWith(own) || v?.protocol === 'libp2p' || id.includes('@')) continue
    if (unreachable.test(String(v?.endpoint ?? ''))) continue
    const shapes = (Array.isArray(v?.shapes) ? v.shapes : []).filter((s: unknown): s is string => typeof s === 'string' && s !== '')
    if (shapes.length === 0) continue
    if (discoveryLocal !== null && shapes.every((s) => discoveryLocal.has(s))) continue
    rows.push({ vesselId: id, shapes })
  }
  return rows
}

// The shapes discovery answers itself (its public GET /shapes), or null when they cannot be read.
export async function discoveryLocalShapes(discovery: string, fetchFn: typeof fetch = fetch): Promise<Set<string> | null> {
  try {
    const r = await fetchFn(discovery + '/shapes', { signal: AbortSignal.timeout(5000) })
    if (!r.ok) return null
    const j = (await r.json()) as { shapes?: unknown }
    return Array.isArray(j?.shapes) ? new Set(j.shapes.filter((s): s is string => typeof s === 'string' && s !== '')) : null
  } catch {
    return null
  }
}
