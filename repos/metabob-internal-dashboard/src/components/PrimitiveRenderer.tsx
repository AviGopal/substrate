/**
 * Primitive Renderer
 *
 * Recursive renderer for composable UI primitives.
 * Supports unbounded rendering - any primitive composition MiniBob creates.
 *
 * Anti-patterns avoided:
 * - No component type enums
 * - No query pattern matching
 * - No template gates
 *
 * Unknown primitives render debug info instead of crashing.
 */

import { memo, type CSSProperties } from 'react'
import type { Primitive, ContainerPrimitive, TextPrimitive, DataTablePrimitive, ChartPrimitive, GraphPrimitive, InputPrimitive, ButtonPrimitive, BadgePrimitive, ProgressPrimitive, CodePrimitive, ImagePrimitive } from '../lib/websocket-handler'

// ============================================================================
// Types
// ============================================================================

interface PrimitiveRendererProps {
  primitive: Primitive
  onAction?: (action: string, componentId: string, payload?: unknown) => void
  dataContext?: Record<string, unknown>
  path?: string
}

// ============================================================================
// Primitive Components
// ============================================================================

/** Container with layout support */
const Container = memo(function Container({
  primitive,
  onAction,
  dataContext,
  path
}: {
  primitive: ContainerPrimitive
  onAction?: PrimitiveRendererProps['onAction']
  dataContext?: Record<string, unknown>
  path: string
}) {
  const layoutStyles: CSSProperties = {
    display: 'flex',
    flexDirection: primitive.layout === 'horizontal' ? 'row' : 'column',
    gap: primitive.gap ?? '0.5rem',
    padding: primitive.padding ?? '0',
    ...convertStyleRecord(primitive.style)
  }

  if (primitive.layout === 'grid') {
    layoutStyles.display = 'grid'
    layoutStyles.gridTemplateColumns = `repeat(${primitive.columns ?? 2}, 1fr)`
  } else if (primitive.layout === 'absolute') {
    layoutStyles.position = 'relative'
  }

  return (
    <div style={layoutStyles} data-primitive="container" data-path={path}>
      {primitive.children?.map((child, i) => (
        <PrimitiveRenderer
          key={i}
          primitive={child}
          onAction={onAction}
          dataContext={dataContext}
          path={`${path}.children[${i}]`}
        />
      ))}
    </div>
  )
})

/** Text with formatting */
const Text = memo(function Text({ primitive }: { primitive: TextPrimitive }) {
  const variantStyles: Record<string, string> = {
    heading: 'text-xl font-bold text-zinc-100',
    subheading: 'text-lg font-semibold text-zinc-200',
    body: 'text-base text-zinc-300',
    caption: 'text-sm text-zinc-400',
    label: 'text-sm font-medium text-zinc-300'
  }

  const className = variantStyles[primitive.variant ?? 'body']

  if (primitive.format === 'code') {
    return (
      <pre
        className={`${className} font-mono bg-zinc-900 p-2 rounded overflow-x-auto`}
        style={convertStyleRecord(primitive.style)}
        data-primitive="text"
        data-format="code"
      >
        {primitive.content}
      </pre>
    )
  }

  if (primitive.format === 'markdown') {
    // Simple markdown rendering (bold, italic, code)
    const rendered = primitive.content
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-zinc-800 px-1 rounded">$1</code>')

    return (
      <p
        className={className}
        style={convertStyleRecord(primitive.style)}
        dangerouslySetInnerHTML={{ __html: rendered }}
        data-primitive="text"
        data-format="markdown"
      />
    )
  }

  return (
    <p
      className={className}
      style={convertStyleRecord(primitive.style)}
      data-primitive="text"
    >
      {primitive.content}
    </p>
  )
})

/** Data table with dynamic columns */
const DataTable = memo(function DataTable({
  primitive,
  onAction
}: {
  primitive: DataTablePrimitive
  onAction?: PrimitiveRendererProps['onAction']
}) {
  const handleRowClick = (row: Record<string, unknown>, index: number) => {
    if (primitive.rowAction && onAction) {
      onAction(primitive.rowAction.tool, `row-${index}`, {
        row,
        index,
        ...primitive.rowAction.params
      })
    }
  }

  return (
    <div
      className="overflow-x-auto rounded-lg border border-zinc-800"
      style={convertStyleRecord(primitive.style)}
      data-primitive="data-table"
    >
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            {primitive.columns.map(col => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-sm font-medium text-zinc-400"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {primitive.rows.map((row, i) => (
            <tr
              key={i}
              className={`
                border-b border-zinc-800/50 last:border-b-0
                ${primitive.rowAction ? 'cursor-pointer hover:bg-zinc-800/50' : ''}
              `}
              onClick={() => primitive.rowAction && handleRowClick(row, i)}
            >
              {primitive.columns.map(col => (
                <td
                  key={col.key}
                  className="px-4 py-3 text-sm text-zinc-300"
                >
                  {renderCellValue(row[col.key], col.render)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {primitive.pagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 bg-zinc-900/50">
          <span className="text-sm text-zinc-500">
            Page {primitive.pagination.page} of {Math.ceil(primitive.pagination.total / primitive.pagination.pageSize)}
          </span>
          <span className="text-sm text-zinc-500">
            {primitive.pagination.total} total rows
          </span>
        </div>
      )}
    </div>
  )
})

/** Render cell value based on render type */
function renderCellValue(value: unknown, render?: string): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-zinc-600">—</span>
  }

  switch (render) {
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value)

    case 'date':
      try {
        return new Date(value as string | number).toLocaleDateString()
      } catch {
        return String(value)
      }

    case 'badge':
      const badgeColors: Record<string, string> = {
        success: 'bg-green-900/50 text-green-300 border-green-800',
        warning: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
        error: 'bg-red-900/50 text-red-300 border-red-800',
        info: 'bg-blue-900/50 text-blue-300 border-blue-800'
      }
      const badgeValue = String(value).toLowerCase()
      const badgeClass = badgeColors[badgeValue] ?? 'bg-zinc-800 text-zinc-300 border-zinc-700'
      return (
        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded border ${badgeClass}`}>
          {String(value)}
        </span>
      )

    case 'progress':
      const progress = typeof value === 'number' ? value : parseFloat(String(value))
      return (
        <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )

    default:
      return String(value)
  }
}

/** Chart placeholder - will integrate with recharts */
const Chart = memo(function Chart({ primitive }: { primitive: ChartPrimitive }) {
  // Basic chart rendering - in production, use recharts
  return (
    <div
      className="p-4 border border-zinc-800 rounded-lg bg-zinc-900/50"
      style={convertStyleRecord(primitive.style)}
      data-primitive="chart"
      data-chart-type={primitive.chartType}
    >
      <div className="text-center text-zinc-400 py-8">
        <div className="text-lg font-medium mb-2">{primitive.chartType} chart</div>
        <div className="text-sm text-zinc-500">
          {primitive.data.length} data points
          {primitive.xAxis && ` • X: ${primitive.xAxis}`}
          {primitive.yAxis && ` • Y: ${Array.isArray(primitive.yAxis) ? primitive.yAxis.join(', ') : primitive.yAxis}`}
        </div>
      </div>
    </div>
  )
})

/** Graph placeholder - will integrate with react-force-graph */
const Graph = memo(function Graph({ primitive }: { primitive: GraphPrimitive }) {
  return (
    <div
      className="p-4 border border-zinc-800 rounded-lg bg-zinc-900/50"
      style={convertStyleRecord(primitive.style)}
      data-primitive="graph"
      data-layout={primitive.layout}
    >
      <div className="text-center text-zinc-400 py-8">
        <div className="text-lg font-medium mb-2">{primitive.layout ?? 'force-directed'} graph</div>
        <div className="text-sm text-zinc-500">
          {primitive.nodes.length} nodes • {primitive.edges.length} edges
        </div>
      </div>
    </div>
  )
})

/** Input field */
const Input = memo(function Input({
  primitive,
  onAction
}: {
  primitive: InputPrimitive
  onAction?: PrimitiveRendererProps['onAction']
}) {
  const handleSubmit = (value: string) => {
    if (primitive.onSubmit && onAction) {
      onAction(primitive.onSubmit.tool, 'input', {
        value,
        ...primitive.onSubmit.params
      })
    }
  }

  const baseClass = `
    w-full px-3 py-2
    bg-zinc-900 border border-zinc-700
    rounded-lg
    text-zinc-100 placeholder:text-zinc-500
    focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
    outline-none transition-colors
  `

  if (primitive.inputType === 'select') {
    return (
      <div style={convertStyleRecord(primitive.style)} data-primitive="input" data-input-type="select">
        {primitive.label && (
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            {primitive.label}
          </label>
        )}
        <select
          className={baseClass}
          onChange={(e) => handleSubmit(e.target.value)}
        >
          {primitive.options?.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (primitive.inputType === 'checkbox') {
    return (
      <label
        className="flex items-center gap-2 cursor-pointer"
        style={convertStyleRecord(primitive.style)}
        data-primitive="input"
        data-input-type="checkbox"
      >
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500/50"
          onChange={(e) => handleSubmit(e.target.checked ? 'true' : 'false')}
        />
        <span className="text-sm text-zinc-300">{primitive.label}</span>
      </label>
    )
  }

  return (
    <div style={convertStyleRecord(primitive.style)} data-primitive="input" data-input-type={primitive.inputType}>
      {primitive.label && (
        <label className="block text-sm font-medium text-zinc-300 mb-1">
          {primitive.label}
        </label>
      )}
      <input
        type={primitive.inputType}
        placeholder={primitive.placeholder}
        className={baseClass}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSubmit((e.target as HTMLInputElement).value)
          }
        }}
      />
    </div>
  )
})

/** Button */
const Button = memo(function Button({
  primitive,
  onAction
}: {
  primitive: ButtonPrimitive
  onAction?: PrimitiveRendererProps['onAction']
}) {
  const handleClick = () => {
    if (primitive.confirm) {
      if (window.confirm(`${primitive.confirm.title}\n\n${primitive.confirm.message}`)) {
        onAction?.(primitive.onClick.tool, 'button', primitive.onClick.params)
      }
    } else {
      onAction?.(primitive.onClick.tool, 'button', primitive.onClick.params)
    }
  }

  const variantStyles: Record<string, string> = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    secondary: 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
    ghost: 'bg-transparent hover:bg-zinc-800 text-zinc-300'
  }

  return (
    <button
      className={`
        px-4 py-2 rounded-lg font-medium
        transition-colors
        ${variantStyles[primitive.variant ?? 'secondary']}
      `}
      style={convertStyleRecord(primitive.style)}
      onClick={handleClick}
      data-primitive="button"
      data-variant={primitive.variant}
    >
      {primitive.label}
    </button>
  )
})

/** Badge */
const Badge = memo(function Badge({ primitive }: { primitive: BadgePrimitive }) {
  const variantStyles: Record<string, string> = {
    success: 'bg-green-900/50 text-green-300 border-green-800',
    warning: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
    error: 'bg-red-900/50 text-red-300 border-red-800',
    info: 'bg-blue-900/50 text-blue-300 border-blue-800',
    neutral: 'bg-zinc-800 text-zinc-300 border-zinc-700'
  }

  return (
    <span
      className={`
        inline-flex px-2 py-0.5 text-xs font-medium rounded border
        ${variantStyles[primitive.variant ?? 'neutral']}
      `}
      style={convertStyleRecord(primitive.style)}
      data-primitive="badge"
      data-variant={primitive.variant}
    >
      {primitive.text}
    </span>
  )
})

/** Progress indicator */
const Progress = memo(function Progress({ primitive }: { primitive: ProgressPrimitive }) {
  const percent = (primitive.value / (primitive.max ?? 100)) * 100

  if (primitive.progressType === 'circle') {
    const size = 60
    const strokeWidth = 6
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (percent / 100) * circumference

    return (
      <div
        className="inline-flex flex-col items-center"
        style={convertStyleRecord(primitive.style)}
        data-primitive="progress"
        data-progress-type="circle"
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-zinc-800"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="text-indigo-500 transition-all duration-300"
          />
        </svg>
        {primitive.label && (
          <span className="mt-1 text-sm text-zinc-400">{primitive.label}</span>
        )}
      </div>
    )
  }

  // Default: bar
  return (
    <div
      className="w-full"
      style={convertStyleRecord(primitive.style)}
      data-primitive="progress"
      data-progress-type="bar"
    >
      {primitive.label && (
        <div className="flex justify-between mb-1">
          <span className="text-sm text-zinc-400">{primitive.label}</span>
          <span className="text-sm text-zinc-500">{Math.round(percent)}%</span>
        </div>
      )}
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
})

/** Code block with syntax highlighting placeholder */
const Code = memo(function Code({ primitive }: { primitive: CodePrimitive }) {
  return (
    <div
      className="rounded-lg overflow-hidden border border-zinc-800"
      style={convertStyleRecord(primitive.style)}
      data-primitive="code"
      data-language={primitive.language}
    >
      {primitive.language && (
        <div className="px-3 py-1.5 bg-zinc-800 text-xs text-zinc-400 font-mono">
          {primitive.language}
        </div>
      )}
      <pre className="p-4 bg-zinc-900 overflow-x-auto">
        <code className="text-sm text-zinc-300 font-mono">
          {primitive.lineNumbers
            ? primitive.code.split('\n').map((line, i) => (
                <div key={i} className="flex">
                  <span className="w-8 text-right pr-4 text-zinc-600 select-none">
                    {i + 1}
                  </span>
                  <span>{line}</span>
                </div>
              ))
            : primitive.code
          }
        </code>
      </pre>
    </div>
  )
})

/** Image */
const Image = memo(function Image({ primitive }: { primitive: ImagePrimitive }) {
  return (
    <img
      src={primitive.src}
      alt={primitive.alt ?? ''}
      className="max-w-full h-auto rounded-lg"
      style={convertStyleRecord(primitive.style)}
      data-primitive="image"
    />
  )
})

/** Unknown primitive fallback - debug info without crashing */
const UnknownPrimitive = memo(function UnknownPrimitive({
  primitive,
  path
}: {
  primitive: Primitive
  path: string
}) {
  return (
    <div
      className="p-3 border border-yellow-800/50 bg-yellow-900/20 rounded-lg"
      data-primitive="unknown"
      data-path={path}
    >
      <div className="text-sm text-yellow-400 font-medium mb-1">
        Unknown primitive: {primitive.type}
      </div>
      <pre className="text-xs text-yellow-300/70 overflow-x-auto">
        {JSON.stringify(primitive, null, 2)}
      </pre>
    </div>
  )
})

// ============================================================================
// Main Renderer
// ============================================================================

export const PrimitiveRenderer = memo(function PrimitiveRenderer({
  primitive,
  onAction,
  dataContext,
  path = 'root'
}: PrimitiveRendererProps) {
  switch (primitive.type) {
    case 'container':
      return <Container primitive={primitive} onAction={onAction} dataContext={dataContext} path={path} />
    case 'text':
      return <Text primitive={primitive} />
    case 'data-table':
      return <DataTable primitive={primitive} onAction={onAction} />
    case 'chart':
      return <Chart primitive={primitive} />
    case 'graph':
      return <Graph primitive={primitive} />
    case 'input':
      return <Input primitive={primitive} onAction={onAction} />
    case 'button':
      return <Button primitive={primitive} onAction={onAction} />
    case 'badge':
      return <Badge primitive={primitive} />
    case 'progress':
      return <Progress primitive={primitive} />
    case 'code':
      return <Code primitive={primitive} />
    case 'image':
      return <Image primitive={primitive} />
    default:
      return <UnknownPrimitive primitive={primitive} path={path} />
  }
})

// ============================================================================
// Utilities
// ============================================================================

/** Convert style record to CSSProperties */
function convertStyleRecord(style?: Record<string, string | number>): CSSProperties {
  if (!style) return {}
  return style as CSSProperties
}

export default PrimitiveRenderer
