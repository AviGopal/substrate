import React from 'react'
import { useImpulseStoreForRender } from '../hooks/useImpulseStore'
import { ErrorBoundary } from './ErrorBoundary'
import { PrimitiveRenderer } from '../../components/PrimitiveRenderer'
import type { Primitive, PositionMode } from '../../types'

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

  const renderImpulse = (impulse: (typeof impulses)[number]) => {
    const primitive = impulse.content ?? impulse.pointer?.primitive
    const styles = positionStyles(impulse.pointer?.position, impulse.pointer?.layer)

    return (
      <div key={impulse.id} style={styles}>
        <ErrorBoundary
          impulseId={impulse.id}
          primitiveType={primitive?.type ?? 'unknown'}
          depth={0}
          updatedAt={impulse.updatedAt}
        >
          {primitive ? (
            <PrimitiveRenderer
              primitive={primitive as Primitive}
              onAction={(actionId, payload) => {
                console.log('[ImpulseViewport] action', actionId, payload)
              }}
              depth={0}
            />
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
