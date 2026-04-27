// Badge primitive - status indicator

import React from 'react'
import type { BadgePrimitive } from '../types'
import { Badge as ShadcnBadge } from '../client/components/ui/badge'

export interface BadgeProps {
  primitive: BadgePrimitive
  className?: string
}

type ShadcnVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const variantMap: Record<string, ShadcnVariant> = {
  success: 'default',
  warning: 'secondary',
  error: 'destructive',
  info: 'outline',
  neutral: 'secondary',
}

export function Badge({ primitive, className }: BadgeProps) {
  const { text, variant } = primitive
  const shadcnVariant = variantMap[variant] ?? 'secondary'

  return (
    <ShadcnBadge variant={shadcnVariant} className={className}>
      {text}
    </ShadcnBadge>
  )
}
