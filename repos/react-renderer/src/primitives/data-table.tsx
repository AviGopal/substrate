// DataTable primitive - tabular data display

import React, { useState } from 'react'
import type { DataTablePrimitive } from '../types'

export interface DataTableProps {
  primitive: DataTablePrimitive
  onAction?: (actionId: string, payload?: Record<string, unknown>) => void
}

export function DataTable({ primitive, onAction }: DataTableProps) {
  const { columns, data, pagination, onRowClick } = primitive
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(pagination?.page ?? 0)
  const pageSize = pagination?.pageSize ?? 10

  // Sort data
  let sortedData = [...data]
  if (sortColumn) {
    sortedData.sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      if (aVal === bVal) return 0
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1
      const comparison = aVal < bVal ? -1 : 1
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }

  // Paginate
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const paginatedData = pagination
    ? sortedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    : sortedData

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }

  const handleRowClick = (row: Record<string, unknown>, index: number) => {
    if (onRowClick && onAction) {
      onAction(onRowClick, { row, index })
    }
  }

  const cellStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid #e4e4e7',
    textAlign: 'left',
    fontSize: '0.875rem'
  }

  const headerStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: '#f4f4f5',
    fontWeight: 600,
    color: '#3f3f46',
    cursor: 'pointer',
    userSelect: 'none'
  }

  return (
    <div style={{ overflow: 'auto', borderRadius: '8px', border: '1px solid #e4e4e7' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ ...headerStyle, width: col.width }}
                onClick={() => col.sortable !== false && handleSort(col.key)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {col.header}
                  {col.sortable !== false && sortColumn === col.key && (
                    <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onClick={() => handleRowClick(row, rowIndex)}
              style={{
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (onRowClick) e.currentTarget.style.backgroundColor = '#f9fafb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = ''
              }}
            >
              {columns.map((col) => (
                <td key={col.key} style={cellStyle}>
                  {formatCellValue(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {pagination && totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderTop: '1px solid #e4e4e7',
          backgroundColor: '#f9fafb'
        }}>
          <span style={{ fontSize: '0.875rem', color: '#71717a' }}>
            Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, data.length)} of {data.length}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                border: '1px solid #d4d4d8',
                backgroundColor: 'white',
                cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 0 ? 0.5 : 1
              }}
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                border: '1px solid #d4d4d8',
                backgroundColor: 'white',
                cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage >= totalPages - 1 ? 0.5 : 1
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatCellValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span style={{ color: '#a1a1aa' }}>—</span>
  }
  if (typeof value === 'boolean') {
    return value ? '✓' : '✗'
  }
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  if (value instanceof Date) {
    return value.toLocaleDateString()
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}
