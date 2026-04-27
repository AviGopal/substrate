// Button primitive - clickable action

import React, { useState } from 'react'
import type { ButtonPrimitive } from '../types'
import { Button as ShadcnButton } from '../client/components/ui/button'

export interface ButtonProps {
  primitive: ButtonPrimitive
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void
}

type ShadcnButtonVariant = 'default' | 'secondary' | 'destructive' | 'ghost'

const variantMap: Record<string, ShadcnButtonVariant> = {
  primary: 'default',
  secondary: 'secondary',
  destructive: 'destructive',
  ghost: 'ghost',
}

export function Button({ primitive, onAction }: ButtonProps) {
  const { label, variant = 'primary', onClick, disabled, loading, confirm } = primitive
  const [confirming, setConfirming] = useState(false)

  const shadcnVariant = variantMap[variant] ?? 'default'

  const handleClick = () => {
    if (disabled || loading) return

    if (confirm && !confirming) {
      setConfirming(true)
      return
    }

    setConfirming(false)
    onAction?.(onClick, { action: onClick })
  }

  const handleCancel = () => {
    setConfirming(false)
  }

  if (confirming && confirm) {
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.875rem', color: '#dc2626' }}>
          {confirm.message}
        </span>
        <ShadcnButton variant="destructive" size="sm" onClick={handleClick}>
          Confirm
        </ShadcnButton>
        <ShadcnButton variant="ghost" size="sm" onClick={handleCancel}>
          Cancel
        </ShadcnButton>
      </div>
    )
  }

  return (
    <ShadcnButton
      variant={shadcnVariant}
      onClick={handleClick}
      disabled={disabled || loading}
    >
      {loading ? <span style={{ marginRight: '8px' }}>⏳</span> : null}
      {label}
    </ShadcnButton>
  )
}
