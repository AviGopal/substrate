// TanStack Table-backed data table primitive (data-table-v2)

import React, { useState, useRef, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
  type ColumnDef,
} from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { DataTableTanstackCorePrimitive } from "../types"
import { Badge } from '../client/components/ui/badge'
import { Button } from '../client/components/ui/button'
import { Input } from '../client/components/ui/input'

// Re-export under the original public name for backward compatibility.
export type { DataTableTanstackCorePrimitive as DataTableTanstackPrimitive } from "../types"

// Local alias used by the component below.
type DataTableTanstackPrimitive = DataTableTanstackCorePrimitive

// ============================================================================
// Column type renderers
// ============================================================================

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function renderCellValue(
  value: unknown,
  colType?: 'text' | 'number' | 'date' | 'status'
): React.ReactNode {
  switch (colType) {
    case 'date': {
      try {
        const d = new Date(value as string)
        if (isNaN(d.getTime())) return String(value ?? '')
        return dateFormatter.format(d)
      } catch {
        return String(value ?? '')
      }
    }
    case 'number':
      return Number(value).toLocaleString()
    case 'status': {
      const str = String(value ?? '').toLowerCase()
      let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary'
      if (['active', 'success', 'done', 'completed'].includes(str)) variant = 'default'
      else if (['error', 'failed'].includes(str)) variant = 'destructive'
      return <Badge variant={variant}>{String(value ?? '')}</Badge>
    }
    default:
      return String(value ?? '')
  }
}

// ============================================================================
// Router integration (try/catch fallback)
// ============================================================================

function useSafeRouterSort(): [
  string | undefined,
  (col: string, dir: 'asc' | 'desc') => void
] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSearch, useNavigate } = require('@tanstack/react-router')
    const search = useSearch({ from: '/app' }) as { sort?: string }
    const navigate = useNavigate()

    const setSort = (col: string, dir: 'asc' | 'desc') => {
      navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, sort: `${col}:${dir}` }) })
    }

    return [search?.sort, setSort]
  } catch {
    return [undefined, () => {}]
  }
}

// ============================================================================
// DataTableTanstack component
// ============================================================================

const VIRTUAL_THRESHOLD = 200
const ESTIMATED_ROW_HEIGHT = 36

export function DataTableTanstack({
  primitive,
  onAction,
}: {
  primitive: DataTableTanstackPrimitive
  onAction?: (action: string, payload: unknown) => void
}) {
  const [routerSort, setRouterSort] = useSafeRouterSort()

  // Initialise sort from URL search param if available
  const initialSorting: SortingState = (() => {
    if (!routerSort) return []
    const [col, dir] = routerSort.split(':')
    if (col && (dir === 'asc' || dir === 'desc')) {
      return [{ id: col, desc: dir === 'desc' }]
    }
    return []
  })()

  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  // Sync sort state changes back to URL
  const handleSortingChange = (updater: React.SetStateAction<SortingState>) => {
    setSorting((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (next.length > 0) {
        setRouterSort(next[0].id, next[0].desc ? 'desc' : 'asc')
      }
      return next
    })
  }

  const columnHelper = createColumnHelper<Record<string, unknown>>()

  const columns: ColumnDef<Record<string, unknown>>[] = primitive.columns.map((col) =>
    columnHelper.accessor(col.key, {
      id: col.key,
      header: col.header,
      enableSorting: col.sortable ?? true,
      size: col.width ? parseInt(col.width, 10) : undefined,
      cell: (info) => renderCellValue(info.getValue(), col.type),
    })
  )

  const table = useReactTable({
    data: primitive.data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: primitive.pageSize ?? 10 } },
  })

  const rows = table.getRowModel().rows
  const useVirtual = primitive.virtual === true || primitive.data.length > VIRTUAL_THRESHOLD

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    enabled: useVirtual,
  })

  return (
    <div className="font-mono text-sm overflow-x-auto">
      {/* Global filter */}
      <Input
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder="Filter…"
        className="mb-2 w-full"
      />

      {useVirtual ? (
        /* Virtual rendering */
        <div ref={parentRef} style={{ overflow: 'auto', maxHeight: 400 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{
                        padding: '4px 8px',
                        borderBottom: '1px solid #ccc',
                        cursor: header.column.getCanSort() ? 'pointer' : 'default',
                        textAlign: 'left',
                        width: header.column.getSize() !== 150 ? header.column.getSize() : undefined,
                      }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody
              style={{
                position: 'relative',
                height: virtualizer.getTotalSize(),
                display: 'block',
              }}
            >
              {virtualizer.getVirtualItems().map((vRow) => {
                const row = rows[vRow.index]
                return (
                  <tr
                    key={row.id}
                    onClick={() => onAction?.(primitive.onRowClick ?? 'row_click', { row: row.original, index: row.index })}
                    style={{
                      cursor: primitive.onRowClick ? 'pointer' : 'default',
                      position: 'absolute',
                      top: vRow.start,
                      left: 0,
                      width: '100%',
                      display: 'flex',
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{
                          padding: '4px 8px',
                          borderBottom: '1px solid #eee',
                          flex: 1,
                          textAlign: primitive.columns.find((c) => c.key === cell.column.id)?.type === 'number' ? 'right' : 'left',
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Normal rendering */
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    style={{
                      padding: '4px 8px',
                      borderBottom: '1px solid #ccc',
                      cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      textAlign: 'left',
                      width: header.column.getSize() !== 150 ? header.column.getSize() : undefined,
                    }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onAction?.(primitive.onRowClick ?? 'row_click', { row: row.original, index: row.index })}
                style={{ cursor: primitive.onRowClick ? 'pointer' : 'default' }}
              >
                {row.getVisibleCells().map((cell) => {
                  const colDef = primitive.columns.find((c) => c.key === cell.column.id)
                  return (
                    <td
                      key={cell.id}
                      style={{
                        padding: '4px 8px',
                        borderBottom: '1px solid #eee',
                        textAlign: colDef?.type === 'number' ? 'right' : 'left',
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          ←
        </Button>
        <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          →
        </Button>
        <span style={{ marginLeft: 'auto', color: '#888' }}>
          {table.getFilteredRowModel().rows.length} rows
        </span>
      </div>
    </div>
  )
}
