// TanStack Table-backed data table primitive (data-table-v2)

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
} from "@tanstack/react-table"
import { useState } from "react"
import type { DataTableTanstackCorePrimitive } from "../types"

// Re-export under the original public name for backward compatibility.
export type { DataTableTanstackCorePrimitive as DataTableTanstackPrimitive } from "../types"

// Local alias used by the component below.
type DataTableTanstackPrimitive = DataTableTanstackCorePrimitive

export function DataTableTanstack({
  primitive,
  onAction,
}: {
  primitive: DataTableTanstackPrimitive
  onAction?: (action: string, payload: unknown) => void
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")

  const columnHelper = createColumnHelper<Record<string, unknown>>()
  const columns = primitive.columns.map((col) =>
    columnHelper.accessor(col, {
      header: col,
      cell: (info) => String(info.getValue() ?? ""),
    })
  )

  const table = useReactTable({
    data: primitive.data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize: primitive.pageSize ?? 10 } },
  })

  return (
    <div style={{ fontFamily: "monospace", fontSize: 13, overflowX: "auto" }}>
      {/* Global filter */}
      <input
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder="Filter…"
        style={{ marginBottom: 8, padding: "2px 6px", width: "100%" }}
      />

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{ padding: "4px 8px", borderBottom: "1px solid #ccc", cursor: "pointer", textAlign: "left" }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onAction?.(primitive.onRowClick ?? "row_click", { row: row.original, index: row.index })}
              style={{ cursor: primitive.onRowClick ? "pointer" : "default" }}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} style={{ padding: "4px 8px", borderBottom: "1px solid #eee" }}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>←</button>
        <span>Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>→</button>
        <span style={{ marginLeft: "auto", color: "#888" }}>
          {table.getFilteredRowModel().rows.length} rows
        </span>
      </div>
    </div>
  )
}
