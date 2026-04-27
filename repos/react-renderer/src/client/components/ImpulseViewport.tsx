import React from 'react'
import { useImpulseStoreForRender } from '../hooks/useImpulseStore'
import { ErrorBoundary } from './ErrorBoundary'
import { PrimitiveRenderer } from '../../components/PrimitiveRenderer'
import type { Primitive } from '../../types'

export function ImpulseViewport() {
  const { data: impulses } = useImpulseStoreForRender()

  return (
    <div className="impulse-viewport relative min-h-screen p-4">
      {impulses.map((impulse) => {
        const primitive = impulse.content ?? impulse.pointer?.primitive
        return (
          <div key={impulse.id} style={{ zIndex: impulse.pointer?.layer ?? 0 }}>
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
                    // Actions can be wired to WebSocket or global state later
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
      })}
    </div>
  )
}
