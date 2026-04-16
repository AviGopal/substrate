// ImpulseRenderer - Renders all active UI component impulses

import React from 'react'
import type { UIComponentImpulse, PositionMode } from '../types'
import { PrimitiveRenderer } from './PrimitiveRenderer'

export interface ImpulseRendererProps {
  impulses: UIComponentImpulse[]
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void
}

/**
 * ImpulseRenderer
 *
 * Renders a collection of UI component impulses with proper positioning
 * and layering. Impulses are sorted by layer and rendered according
 * to their position mode.
 */
export function ImpulseRenderer({ impulses, onAction }: ImpulseRendererProps) {
  // Group impulses by position type
  const flowImpulses = impulses.filter(
    (imp) => !imp.pointer.position || imp.pointer.position.type === 'flow' || imp.pointer.position.type === 'below-input'
  )

  const absoluteImpulses = impulses.filter(
    (imp) => imp.pointer.position?.type === 'absolute'
  )

  const centerImpulses = impulses.filter(
    (imp) => imp.pointer.position?.type === 'center'
  )

  // Sort by layer (higher layers on top)
  const sortByLayer = (a: UIComponentImpulse, b: UIComponentImpulse) =>
    (a.pointer.layer ?? 0) - (b.pointer.layer ?? 0)

  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      {/* Flow-positioned impulses */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {flowImpulses.sort(sortByLayer).map((impulse) => (
          <ImpulseCard
            key={impulse.id}
            impulse={impulse}
            onAction={onAction}
          />
        ))}
      </div>

      {/* Absolute-positioned impulses */}
      {absoluteImpulses.sort(sortByLayer).map((impulse) => {
        const pos = impulse.pointer.position as { type: 'absolute'; x: number; y: number }
        return (
          <div
            key={impulse.id}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              zIndex: impulse.pointer.layer ?? 0
            }}
          >
            <ImpulseCard impulse={impulse} onAction={onAction} />
          </div>
        )
      })}

      {/* Center-positioned impulses (modals) */}
      {centerImpulses.length > 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000
          }}
        >
          {centerImpulses.sort(sortByLayer).map((impulse) => (
            <ImpulseCard
              key={impulse.id}
              impulse={impulse}
              onAction={onAction}
              isModal
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// ImpulseCard - Individual impulse wrapper
// ============================================================================

interface ImpulseCardProps {
  impulse: UIComponentImpulse
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void
  isModal?: boolean
}

function ImpulseCard({ impulse, onAction, isModal }: ImpulseCardProps) {
  const animation = impulse.pointer.animation ?? 'fade'
  const size = impulse.pointer.size

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: isModal
      ? '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      : '0 1px 3px rgba(0, 0, 0, 0.1)',
    ...(size && size !== 'auto' ? {
      width: size.width,
      height: size.height
    } : {}),
    animation: getAnimationCss(animation)
  }

  const primitive = impulse.content ?? impulse.pointer.primitive

  if (!primitive) {
    return null
  }

  return (
    <div style={cardStyle} data-impulse-id={impulse.id}>
      <PrimitiveRenderer
        primitive={primitive}
        onAction={(actionId, payload) => {
          onAction?.(actionId, { ...payload, impulseId: impulse.id })
        }}
      />
    </div>
  )
}

// ============================================================================
// Animation helpers
// ============================================================================

function getAnimationCss(animation: string): string {
  switch (animation) {
    case 'fade':
      return 'fadeIn 0.3s ease-out'
    case 'slide':
      return 'slideIn 0.3s ease-out'
    case 'scale':
      return 'scaleIn 0.3s ease-out'
    default:
      return 'none'
  }
}

// CSS keyframes would be injected via a style tag or CSS file
// For now, using inline styles without actual keyframes

export default ImpulseRenderer
