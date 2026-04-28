import React from 'react'
import { useImpulseStoreForRender } from '../hooks/useImpulseStore'
import { ErrorBoundary } from './ErrorBoundary'
import { PrimitiveRenderer } from '../../components/PrimitiveRenderer'
import { ProvenanceStrip } from '../../primitives/shape-slot'
import { sendAction } from '../lib/ws-action'
import type { Primitive, PositionMode, UIComponentImpulse } from '../../types'

function positionStyles(position?: PositionMode, layer?: number): React.CSSProperties {
  const zIndex = layer ?? 0
  if (!position) return { zIndex }

  switch (position.type) {
    case 'center':
      return {
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100 + zIndex,
        // semi-transparent backdrop
        background: 'rgba(0,0,0,0.15)',
      }
    case 'absolute':
      return {
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 50 + zIndex,
      }
    case 'below-input':
      return { zIndex }
    case 'flow':
    default:
      return { zIndex }
  }
}

export function ImpulseViewport() {
  const { data: impulses } = useImpulseStoreForRender()

  // Flow impulses render in normal document flow; positioned ones are lifted out
  const flowImpulses = impulses.filter(
    (i) => !i.pointer?.position || i.pointer.position.type === 'flow' || i.pointer.position.type === 'below-input'
  )
  const positionedImpulses = impulses.filter(
    (i) => i.pointer?.position && i.pointer.position.type !== 'flow' && i.pointer.position.type !== 'below-input'
  )

  const renderImpulse = (impulse: UIComponentImpulse) => {
    const primitive = impulse.content ?? impulse.pointer?.primitive
    const styles = positionStyles(impulse.pointer?.position, impulse.pointer?.layer)
    // Impulses created by the subscriber (not explicit render_ui) carry dataRef = shape name
    const sourceShape = impulse.dataRef ?? impulse.metadata?.sourceShape

    return (
      <div key={impulse.id} style={styles}>
        <ErrorBoundary
          impulseId={impulse.id}
          primitiveType={primitive?.type ?? 'unknown'}
          depth={0}
          updatedAt={impulse.updatedAt}
        >
          {primitive ? (
            <div style={sourceShape ? { borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border, #e4e4e7)' } : undefined}>
              <PrimitiveRenderer
                primitive={primitive as Primitive}
                onAction={(actionId, payload) => sendAction(actionId, impulse.id, payload)}
                depth={0}
              />
              {sourceShape && (
                <ProvenanceStrip
                  shape={sourceShape}
                  vessel={impulse.metadata?.componentType === 'data-binding' ? undefined : undefined}
                  updatedAt={impulse.updatedAt}
                />
              )}
            </div>
          ) : (
            <div className="impulse-card-placeholder border rounded p-2 mb-2">
              <pre className="text-xs">{JSON.stringify(impulse.pointer?.primitive, null, 2)}</pre>
            </div>
          )}
        </ErrorBoundary>
      </div>
    )
  }

  return (
    <div className="impulse-viewport relative min-h-screen p-4">
      {/* Flow-positioned impulses render in normal document flow */}
      {flowImpulses.map(renderImpulse)}
      {/* Center/absolute impulses are positioned relative to viewport */}
      {positionedImpulses.map(renderImpulse)}
    </div>
  )
}
