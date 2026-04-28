// Graph primitive - force-directed network visualization

import React, { useRef, useEffect, useCallback } from 'react'
import type { GraphPrimitive } from '../types'

export interface GraphProps {
  primitive: GraphPrimitive
}

// Node type expected by react-force-graph-2d
interface FGNode {
  id: string
  label: string
  color?: string
  size?: number
  x?: number
  y?: number
}

interface FGLink {
  source: string | FGNode
  target: string | FGNode
  label?: string
  weight?: number
}

// Lazy-import react-force-graph-2d to avoid SSR issues with canvas
let ForceGraph2D: any = null

export function Graph({ primitive }: GraphProps) {
  const { nodes = [], edges = [], height = 420 } = primitive
  const containerRef = useRef<HTMLDivElement>(null)
  const [fgLoaded, setFgLoaded] = React.useState(false)
  const [width, setWidth] = React.useState(600)

  // Dynamically import react-force-graph-2d once (canvas requires browser)
  useEffect(() => {
    if (!ForceGraph2D) {
      import('react-force-graph-2d').then((mod) => {
        ForceGraph2D = mod.default
        setFgLoaded(true)
      }).catch(() => {
        // Fall back to static rendering if import fails
        setFgLoaded(false)
      })
    } else {
      setFgLoaded(true)
    }
  }, [])

  // Observe container width for responsive canvas
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setWidth(Math.floor(w))
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const graphData = React.useMemo(() => ({
    nodes: nodes.map(n => ({ ...n, val: n.size ?? 4 })),
    links: edges.map(e => ({ ...e }))
  }), [nodes, edges])

  const nodeCanvasObject = useCallback((node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.label || node.id
    const fontSize = Math.max(10, 13 / globalScale)
    const r = (node.size ?? 4) * Math.sqrt(globalScale) * 1.5
    const x = node.x ?? 0
    const y = node.y ?? 0

    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fillStyle = node.color || '#2563eb'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 1.5 / globalScale
    ctx.stroke()

    if (globalScale > 0.6) {
      ctx.font = `${fontSize}px Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label.length > 18 ? label.slice(0, 16) + '…' : label, x, y)
    }
  }, [])

  if (!fgLoaded || !ForceGraph2D) {
    return <StaticGraphFallback nodes={nodes} edges={edges} />
  }

  const FG = ForceGraph2D

  return (
    <div
      ref={containerRef}
      style={{
        border: '1px solid var(--border, #e4e4e7)',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'var(--muted, #f9fafb)'
      }}
    >
      <FG
        graphData={graphData}
        width={width}
        height={height}
        backgroundColor="transparent"
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => 'replace'}
        linkColor={() => 'rgba(100,100,120,0.4)'}
        linkWidth={(link: FGLink) => ((link.weight ?? 1) * 1.5)}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        cooldownTicks={120}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.4}
      />
    </div>
  )
}

// Fallback when canvas isn't available or library failed to load
function StaticGraphFallback({ nodes, edges }: { nodes: FGNode[]; edges: FGLink[] }) {
  return (
    <div style={{
      padding: '16px',
      background: 'var(--muted, #f9fafb)',
      border: '1px solid var(--border, #e4e4e7)',
      borderRadius: '8px'
    }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground, #71717a)', marginBottom: '10px' }}>
        {nodes.length} nodes · {edges.length} edges
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {nodes.map((node) => (
          <span
            key={node.id}
            style={{
              padding: '4px 10px',
              backgroundColor: node.color || '#2563eb',
              color: '#fff',
              borderRadius: '14px',
              fontSize: '0.8rem',
              fontWeight: 500
            }}
          >
            {node.label}
          </span>
        ))}
      </div>
    </div>
  )
}
