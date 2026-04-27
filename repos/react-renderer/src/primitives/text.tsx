// Text primitive - text display component

import React from 'react'
import ReactMarkdown from 'react-markdown'
import type { TextPrimitive } from '../types'

export interface TextProps {
  primitive: TextPrimitive
}

export function Text({ primitive }: TextProps) {
  const { content, variant = 'body', format = 'plain', className } = primitive

  const baseStyles: React.CSSProperties = {
    margin: 0
  }

  const variantStyles: Record<string, React.CSSProperties> = {
    heading: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.2
    },
    subheading: {
      fontSize: '1.125rem',
      fontWeight: 500,
      lineHeight: 1.3
    },
    body: {
      fontSize: '0.875rem',
      lineHeight: 1.5
    },
    caption: {
      fontSize: '0.75rem',
      color: '#666',
      lineHeight: 1.4
    },
    code: {
      fontFamily: 'monospace',
      fontSize: '0.8125rem',
      backgroundColor: '#f4f4f5',
      padding: '2px 6px',
      borderRadius: '4px'
    }
  }

  const style = { ...baseStyles, ...variantStyles[variant] }

  if (format === 'markdown') {
    return (
      <div style={style} className={`prose prose-sm max-w-none${className ? ` ${className}` : ''}`}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    )
  }

  if (format === 'code' || variant === 'code') {
    return (
      <code style={style} className={className}>
        {content}
      </code>
    )
  }

  // Render as appropriate element based on variant
  switch (variant) {
    case 'heading':
      return <h2 style={style} className={className}>{content}</h2>
    case 'subheading':
      return <h3 style={style} className={className}>{content}</h3>
    case 'caption':
      return <span style={style} className={className}>{content}</span>
    default:
      return <p style={style} className={className}>{content}</p>
  }
}
