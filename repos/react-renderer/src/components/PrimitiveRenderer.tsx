// PrimitiveRenderer - Recursive renderer for primitive compositions

import React from 'react'
import type { Primitive } from '../types'
import { Container } from '../primitives/container'
import { Text } from '../primitives/text'
import { Badge } from '../primitives/badge'
import { Button } from '../primitives/button'
import { Progress } from '../primitives/progress'
import { Code } from '../primitives/code'
import { DataTable } from '../primitives/data-table'
import { Chart } from '../primitives/chart'

export interface PrimitiveRendererProps {
  primitive: Primitive
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void
}

/**
 * PrimitiveRenderer
 *
 * Recursively renders primitive compositions. Each primitive type
 * is mapped to its corresponding React component.
 *
 * Unknown primitive types are rendered as debug info rather than
 * causing errors - this allows the system to gracefully degrade.
 */
export function PrimitiveRenderer({ primitive, onAction }: PrimitiveRendererProps) {
  // Render child primitives recursively
  const renderChild = (child: Primitive, index: number): React.ReactNode => {
    return (
      <PrimitiveRenderer
        key={child.id || index}
        primitive={child}
        onAction={onAction}
      />
    )
  }

  switch (primitive.type) {
    case 'container':
      return (
        <Container
          primitive={primitive}
          renderChild={renderChild}
        />
      )

    case 'text':
      return <Text primitive={primitive} />

    case 'badge':
      return <Badge primitive={primitive} />

    case 'button':
      return <Button primitive={primitive} onAction={onAction} />

    case 'progress':
      return <Progress primitive={primitive} />

    case 'code':
      return <Code primitive={primitive} />

    case 'data-table':
      return <DataTable primitive={primitive} onAction={onAction} />

    case 'chart':
      return <Chart primitive={primitive} />

    case 'graph':
      // Graph primitive - using react-force-graph-2d
      return <GraphPrimitive primitive={primitive} />

    case 'input':
      // Input primitive
      return <InputPrimitive primitive={primitive} onAction={onAction} />

    case 'image':
      // Image primitive
      return <ImagePrimitive primitive={primitive} />

    case 'custom':
      // Custom primitive - render placeholder
      return (
        <div style={{
          padding: '16px',
          backgroundColor: '#f4f4f5',
          borderRadius: '8px',
          border: '1px dashed #d4d4d8'
        }}>
          <Badge primitive={{ type: 'badge', text: 'Custom Component', variant: 'info' }} />
          <pre style={{ marginTop: '8px', fontSize: '0.75rem' }}>
            {JSON.stringify(primitive, null, 2)}
          </pre>
        </div>
      )

    default:
      // Unknown primitive type - render debug info
      return (
        <div style={{
          padding: '16px',
          backgroundColor: '#fef2f2',
          borderRadius: '8px',
          border: '1px solid #fca5a5'
        }}>
          <Badge primitive={{ type: 'badge', text: `Unknown: ${(primitive as any).type}`, variant: 'warning' }} />
          <pre style={{ marginTop: '8px', fontSize: '0.75rem', color: '#991b1b' }}>
            {JSON.stringify(primitive, null, 2)}
          </pre>
        </div>
      )
  }
}

// ============================================================================
// Additional Primitive Components (inline for now)
// ============================================================================

function GraphPrimitive({ primitive }: { primitive: any }) {
  // Simplified graph rendering - would use react-force-graph-2d in full implementation
  const { nodes = [], edges = [] } = primitive

  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      border: '1px solid #e4e4e7'
    }}>
      <div style={{ marginBottom: '8px', fontWeight: 500 }}>
        Graph: {nodes.length} nodes, {edges.length} edges
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {nodes.map((node: any) => (
          <div
            key={node.id}
            style={{
              padding: '8px 12px',
              backgroundColor: node.color || '#2563eb',
              color: 'white',
              borderRadius: '4px',
              fontSize: '0.875rem'
            }}
          >
            {node.label}
          </div>
        ))}
      </div>
      {edges.length > 0 && (
        <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#71717a' }}>
          Connections: {edges.map((e: any) => `${e.source}→${e.target}`).join(', ')}
        </div>
      )}
    </div>
  )
}

function InputPrimitive({
  primitive,
  onAction
}: {
  primitive: any
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void
}) {
  const { inputType = 'text', label, placeholder, value, options, onChange } = primitive
  const [inputValue, setInputValue] = React.useState(value ?? '')

  const handleChange = (newValue: unknown) => {
    setInputValue(newValue)
    if (onChange && onAction) {
      onAction(onChange, { value: newValue })
    }
  }

  const baseInputStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #d4d4d8',
    fontSize: '0.875rem',
    width: '100%',
    boxSizing: 'border-box'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>
          {label}
        </label>
      )}

      {inputType === 'select' ? (
        <select
          style={baseInputStyle}
          value={inputValue as string}
          onChange={(e) => handleChange(e.target.value)}
        >
          {options?.map((opt: any) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : inputType === 'checkbox' ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={!!inputValue}
            onChange={(e) => handleChange(e.target.checked)}
          />
          <span style={{ fontSize: '0.875rem' }}>{placeholder}</span>
        </label>
      ) : (
        <input
          type={inputType}
          style={baseInputStyle}
          placeholder={placeholder}
          value={inputValue as string}
          onChange={(e) => handleChange(e.target.value)}
        />
      )}
    </div>
  )
}

function ImagePrimitive({ primitive }: { primitive: any }) {
  const { src, alt, width, height } = primitive

  return (
    <img
      src={src}
      alt={alt || ''}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        maxWidth: '100%',
        borderRadius: '8px'
      }}
    />
  )
}

export default PrimitiveRenderer
