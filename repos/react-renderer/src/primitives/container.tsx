// Container primitive - layout component

import React from 'react'
import type { ContainerPrimitive, Primitive } from '../types'
import { Card, CardContent } from '../client/components/ui/card'

export interface ContainerProps {
  primitive: ContainerPrimitive
  renderChild: (child: Primitive, index: number) => React.ReactNode
}

function toPx(v: number | string | undefined): string | undefined {
  if (v === undefined) return undefined
  return typeof v === 'number' ? `${v}px` : v
}

const JUSTIFY_MAP: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  stretch: 'stretch',
}

const ALIGN_MAP: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline',
}

export function Container({ primitive, renderChild }: ContainerProps) {
  const {
    layout,
    gap = 8,
    padding,
    className,
    children,
    width,
    height,
    maxWidth,
    minHeight,
    columns,
    justify,
    align,
    wrap,
    overflow,
    background,
    border,
    borderRadius,
    naked = false,
  } = primitive

  const sizeStyle: React.CSSProperties = {
    width: toPx(width),
    height: toPx(height),
    maxWidth: toPx(maxWidth),
    minHeight: toPx(minHeight),
    overflow: overflow,
    background: background,
    border: border,
    borderRadius: toPx(borderRadius),
  }

  if (layout === 'absolute') {
    const absStyle: React.CSSProperties = {
      position: 'relative',
      gap: `${gap}px`,
      padding: toPx(padding as number | string),
      ...sizeStyle,
    }
    const inner = (
      <div style={absStyle} className={className}>
        {children.map((child, index) => renderChild(child, index))}
      </div>
    )
    return naked ? inner : <Card className={className}><CardContent className="p-0">{inner}</CardContent></Card>
  }

  const layoutStyle: React.CSSProperties = {
    display: layout === 'grid' ? 'grid' : 'flex',
    gap: `${gap}px`,
    padding: toPx(padding as number | string),
    justifyContent: justify ? JUSTIFY_MAP[justify] : undefined,
    alignItems: align ? ALIGN_MAP[align] : undefined,
    flexWrap: wrap ? 'wrap' : undefined,
    ...sizeStyle,
  }

  switch (layout) {
    case 'vertical':
      layoutStyle.flexDirection = 'column'
      break
    case 'horizontal':
      layoutStyle.flexDirection = 'row'
      if (!align) layoutStyle.alignItems = 'center'
      break
    case 'grid':
      if (columns) {
        layoutStyle.gridTemplateColumns = `repeat(${columns}, 1fr)`
      } else {
        layoutStyle.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))'
      }
      break
  }

  const content = children.map((child, index) => renderChild(child, index))

  if (naked) {
    return (
      <div style={layoutStyle} className={className}>
        {content}
      </div>
    )
  }

  return (
    <Card className={className} style={background || border ? { background, border, borderRadius: toPx(borderRadius) } : undefined}>
      <CardContent style={layoutStyle} className="p-0">
        {content}
      </CardContent>
    </Card>
  )
}
