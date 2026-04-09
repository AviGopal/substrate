// Button primitive - clickable action

import React, { useState } from 'react'
import type { ButtonPrimitive } from '../types'

export interface ButtonProps {
  primitive: ButtonPrimitive
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none'
  },
  secondary: {
    backgroundColor: '#f4f4f5',
    color: '#18181b',
    border: '1px solid #d4d4d8'
  },
  destructive: {
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none'
  },
  ghost: {
    backgroundColor: 'transparent',
    color: '#18181b',
    border: 'none'
  }
}

export function Button({ primitive, onAction }: ButtonProps) {
  const { label, variant = 'primary', onClick, disabled, loading, confirm } = primitive
  const [confirming, setConfirming] = useState(false)

  const handleClick = () => {
    if (disabled || loading) return

    if (confirm && !confirming) {
      setConfirming(true)
      return
    }

    setConfirming(false)
    onAction?.(onClick)
  }

  const handleCancel = () => {
    setConfirming(false)
  }

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 16px',
    fontSize: '0.875rem',
    fontWeight: 500,
    borderRadius: '6px',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.15s ease',
    ...variantStyles[variant]
  }

  if (confirming && confirm) {
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.875rem', color: '#dc2626' }}>
          {confirm.message}
        </span>
        <button
          style={{ ...baseStyle, ...variantStyles.destructive, padding: '4px 12px' }}
          onClick={handleClick}
        >
          Confirm
        </button>
        <button
          style={{ ...baseStyle, ...variantStyles.ghost, padding: '4px 12px' }}
          onClick={handleCancel}
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button style={baseStyle} onClick={handleClick} disabled={disabled}>
      {loading ? (
        <span style={{ marginRight: '8px' }}>⏳</span>
      ) : null}
      {label}
    </button>
  )
}
