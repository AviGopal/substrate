// Container primitive - layout component

import React from 'react'
import type { ContainerPrimitive, Primitive } from '../types'

export interface ContainerProps {
  primitive: ContainerPrimitive
  renderChild: (child: Primitive, index: number) => React.ReactNode
}

export function Container({ primitive, renderChild }: ContainerProps) {
  const { layout, gap = 8, padding, className, children } = primitive

  const layoutStyles: React.CSSProperties = {
    display: 'flex',
    gap: `${gap}px`,
    padding: typeof padding === 'number' ? `${padding}px` : padding
  }

  switch (layout) {
    case 'vertical':
      layoutStyles.flexDirection = 'column'
      break
    case 'horizontal':
      layoutStyles.flexDirection = 'row'
      layoutStyles.alignItems = 'center'
      break
    case 'grid':
      layoutStyles.display = 'grid'
      layoutStyles.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))'
      break
    case 'absolute':
      layoutStyles.position = 'relative'
      break
  }

  return (
    <div style={layoutStyles} className={className}>
      {children.map((child, index) => renderChild(child, index))}
    </div>
  )
}
