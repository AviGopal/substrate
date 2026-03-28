/**
 * Impulse Renderer
 *
 * Renders UI component impulses with layout control.
 * Maps impulse position modes to CSS positioning.
 */

import { memo, type CSSProperties } from 'react'
import type { UIComponentImpulse, PositionMode, SizeMode } from '../lib/websocket-handler'
import { PrimitiveRenderer } from './PrimitiveRenderer'

interface ImpulseRendererProps {
  impulse: UIComponentImpulse
  onAction?: (action: string, componentId: string, payload?: unknown) => void
  viewport?: { width: number; height: number }
  componentBounds?: Map<string, DOMRect>
}

/** Convert position mode to CSS */
function getPositionStyles(
  position: PositionMode | undefined,
  componentBounds?: Map<string, DOMRect>
): CSSProperties {
  if (!position) {
    return {}
  }

  switch (position.type) {
    case 'flow':
      return {}

    case 'below-input':
      return {
        marginTop: '1rem'
      }

    case 'absolute':
      return {
        position: 'absolute',
        left: position.x,
        top: position.y
      }

    case 'anchor':
      const anchorBounds = componentBounds?.get(position.componentId)
      if (!anchorBounds) {
        console.warn(`[ImpulseRenderer] Anchor component not found: ${position.componentId}`)
        return {}
      }

      const offset = position.offset ?? 8
      switch (position.edge) {
        case 'top':
          return {
            position: 'absolute',
            left: anchorBounds.left,
            top: anchorBounds.top - offset,
            transform: 'translateY(-100%)'
          }
        case 'bottom':
          return {
            position: 'absolute',
            left: anchorBounds.left,
            top: anchorBounds.bottom + offset
          }
        case 'left':
          return {
            position: 'absolute',
            left: anchorBounds.left - offset,
            top: anchorBounds.top,
            transform: 'translateX(-100%)'
          }
        case 'right':
          return {
            position: 'absolute',
            left: anchorBounds.right + offset,
            top: anchorBounds.top
          }
      }
      break

    case 'region':
      switch (position.region) {
        case 'top':
          return {
            position: 'fixed',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)'
          }
        case 'bottom':
          return {
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)'
          }
        case 'left':
          return {
            position: 'fixed',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)'
          }
        case 'right':
          return {
            position: 'fixed',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)'
          }
        case 'center':
          return {
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }
      }
  }

  return {}
}

/** Convert size mode to CSS */
function getSizeStyles(size: SizeMode | undefined): CSSProperties {
  if (!size) {
    return {}
  }

  switch (size.type) {
    case 'auto':
      return {
        width: 'auto',
        height: 'auto'
      }

    case 'explicit':
      return {
        width: size.width,
        height: size.height
      }

    case 'fill':
      return {
        width: '100%',
        height: '100%'
      }
  }
}

/** Get animation class */
function getAnimationClass(animation: UIComponentImpulse['animation']): string {
  switch (animation) {
    case 'fade':
      return 'animate-fade-in'
    case 'slide':
      return 'animate-slide-up'
    case 'scale':
      return 'animate-scale-in'
    default:
      return ''
  }
}

export const ImpulseRenderer = memo(function ImpulseRenderer({
  impulse,
  onAction,
  viewport,
  componentBounds
}: ImpulseRendererProps) {
  // Combine all styles
  const containerStyle: CSSProperties = {
    ...getPositionStyles(impulse.position, componentBounds),
    ...getSizeStyles(impulse.size),
    zIndex: impulse.layer ?? 0
  }

  const animationClass = getAnimationClass(impulse.animation)

  return (
    <div
      id={`impulse-${impulse.id}`}
      className={`${animationClass}`}
      style={containerStyle}
      data-component-id={impulse.id}
      data-component-type={impulse.primitive.type}
      data-deletable={impulse.deletable !== false}
    >
      <PrimitiveRenderer
        primitive={impulse.primitive}
        onAction={(action, componentId, payload) => {
          onAction?.(action, impulse.id, payload)
        }}
      />
    </div>
  )
})

// ============================================================================
// Impulse Layout Container
// ============================================================================

interface ImpulseLayoutProps {
  impulses: Map<string, UIComponentImpulse>
  onAction?: (action: string, componentId: string, payload?: unknown) => void
  viewport?: { width: number; height: number }
}

/**
 * Renders all impulses with proper layering and positioning
 */
export const ImpulseLayout = memo(function ImpulseLayout({
  impulses,
  onAction,
  viewport
}: ImpulseLayoutProps) {
  // Sort impulses by layer for proper z-index stacking
  const sortedImpulses = Array.from(impulses.values()).sort((a, b) => {
    const layerA = a.layer ?? 0
    const layerB = b.layer ?? 0
    return layerA - layerB
  })

  // Group by position type for layout
  const flowImpulses: UIComponentImpulse[] = []
  const positionedImpulses: UIComponentImpulse[] = []

  for (const impulse of sortedImpulses) {
    const posType = impulse.position?.type ?? 'flow'
    if (posType === 'flow' || posType === 'below-input') {
      flowImpulses.push(impulse)
    } else {
      positionedImpulses.push(impulse)
    }
  }

  return (
    <div className="relative min-h-screen">
      {/* Flow-positioned impulses */}
      <div className="flex flex-col items-center gap-4 pt-8 pb-32 px-4 max-w-4xl mx-auto">
        {flowImpulses.map(impulse => (
          <div key={impulse.id} className="w-full">
            <ImpulseRenderer
              impulse={impulse}
              onAction={onAction}
              viewport={viewport}
            />
          </div>
        ))}
      </div>

      {/* Absolutely/fixed positioned impulses */}
      {positionedImpulses.map(impulse => (
        <ImpulseRenderer
          key={impulse.id}
          impulse={impulse}
          onAction={onAction}
          viewport={viewport}
        />
      ))}
    </div>
  )
})

export default ImpulseRenderer
