// shape-slot.tsx — placeholder that fills itself when a matching shape resolves.
// Pending: shows shape name, vessel badge, pulsing skeleton.
// Filled: renders the resolved primitive inline, with a provenance strip.

import React from 'react'
import type { ShapeSlotPrimitive, Primitive } from '../types'

export interface ShapeSlotProps {
  primitive: ShapeSlotPrimitive
  renderFilled: (p: Primitive) => React.ReactNode
}

export function ShapeSlot({ primitive, renderFilled }: ShapeSlotProps) {
  const { shape, label, vessel, height = 160, filled } = primitive

  if (filled) {
    return (
      <div style={{ position: 'relative' }}>
        {renderFilled(filled)}
        <ProvenanceStrip shape={shape} vessel={vessel} />
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: height,
        borderRadius: 8,
        border: '1.5px dashed var(--border, #e4e4e7)',
        background: 'var(--muted, #f9fafb)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Pulse sweep animation */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
        animation: 'slot-sweep 1.8s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <style>{`
        @keyframes slot-sweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, zIndex: 1 }}>
        {vessel && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: 'var(--muted-foreground, #71717a)',
            background: 'var(--border, #e4e4e7)',
            borderRadius: 4,
            padding: '2px 6px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {vessel}
          </span>
        )}
        <span style={{
          fontSize: '0.8rem',
          fontWeight: 500,
          color: 'var(--foreground, #18181b)',
        }}>
          {label ?? shape}
        </span>
      </div>

      <span style={{
        fontSize: '0.72rem',
        color: 'var(--muted-foreground, #71717a)',
        zIndex: 1,
      }}>
        Waiting for shape to resolve…
      </span>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// ProvenanceStrip — small bar shown under data-bound content
// ──────────────────────────────────────────────────────────────────────────────

export function ProvenanceStrip({
  shape,
  vessel,
  updatedAt,
}: {
  shape: string
  vessel?: string
  updatedAt?: number
}) {
  const time = updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 8px',
      borderTop: '1px solid var(--border, #e4e4e7)',
      background: 'var(--muted, #f9fafb)',
      borderRadius: '0 0 6px 6px',
      fontSize: '0.68rem',
      color: 'var(--muted-foreground, #71717a)',
    }}>
      <span style={{ opacity: 0.5 }}>◈</span>
      {vessel && <span style={{ fontWeight: 600 }}>{vessel}</span>}
      {vessel && <span style={{ opacity: 0.4 }}>·</span>}
      <span>{shape}</span>
      {time && (
        <>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{time}</span>
        </>
      )}
    </div>
  )
}
