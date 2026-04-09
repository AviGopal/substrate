// Badge primitive - status indicator

import React from 'react'
import type { BadgePrimitive } from '../types'

export interface BadgeProps {
  primitive: BadgePrimitive
}

const variantColors: Record<string, { bg: string; text: string; border: string }> = {
  success: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  warning: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  error: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  info: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  neutral: { bg: '#f4f4f5', text: '#3f3f46', border: '#d4d4d8' }
}

export function Badge({ primitive }: BadgeProps) {
  const { text, variant } = primitive
  const colors = variantColors[variant] || variantColors.neutral

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    fontSize: '0.75rem',
    fontWeight: 500,
    borderRadius: '9999px',
    backgroundColor: colors.bg,
    color: colors.text,
    border: `1px solid ${colors.border}`
  }

  return <span style={style}>{text}</span>
}
