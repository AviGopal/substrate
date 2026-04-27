// Tests for DataTableTanstack primitive

import { describe, it, expect, mock } from 'bun:test'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { DataTableTanstack } from '../data-table-tanstack'
import type { DataTableTanstackCorePrimitive } from '../../types'

// Mock @tanstack/react-router to avoid router context requirement
mock.module('@tanstack/react-router', () => ({
  useSearch: () => ({}),
  useNavigate: () => () => {},
}))

const basePrimitive: DataTableTanstackCorePrimitive = {
  type: 'data-table-v2',
  columns: [
    { key: 'name', header: 'Name', type: 'text' },
    { key: 'count', header: 'Count', type: 'number' },
    { key: 'status', header: 'Status', type: 'status' },
    { key: 'created', header: 'Created', type: 'date' },
  ],
  data: [
    { name: 'Alpha', count: 42, status: 'active', created: '2026-04-01T10:00:00Z' },
    { name: 'Beta', count: 7, status: 'failed', created: 'invalid-date' },
  ],
}

describe('DataTableTanstack', () => {
  it('renders headers from column objects', () => {
    render(<DataTableTanstack primitive={basePrimitive} />)
    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.getByText('Count')).toBeTruthy()
    expect(screen.getByText('Status')).toBeTruthy()
    expect(screen.getByText('Created')).toBeTruthy()
  })

  it('formats number type cells with toLocaleString', () => {
    render(<DataTableTanstack primitive={basePrimitive} />)
    // 42 formatted via toLocaleString should still contain 42
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('renders status type as badge', () => {
    render(<DataTableTanstack primitive={basePrimitive} />)
    // Status values should be rendered (as badge text)
    expect(screen.getByText('active')).toBeTruthy()
    expect(screen.getByText('failed')).toBeTruthy()
  })

  it('handles invalid date gracefully (shows raw value)', () => {
    render(<DataTableTanstack primitive={basePrimitive} />)
    // Invalid dates fall back to raw string
    expect(screen.getByText('invalid-date')).toBeTruthy()
  })

  it('renders number columns with right-align style', () => {
    const { container } = render(<DataTableTanstack primitive={basePrimitive} />)
    const tds = container.querySelectorAll('td')
    // Find cells that contain number content — check text-align on the cell
    const countCells = Array.from(tds).filter((td) => td.textContent === '42' || td.textContent === '7')
    expect(countCells.length).toBeGreaterThan(0)
    countCells.forEach((cell) => {
      expect(cell.style.textAlign).toBe('right')
    })
  })

  it('does not use virtual rendering for < 200 rows', () => {
    const { container } = render(<DataTableTanstack primitive={basePrimitive} />)
    // Virtual rendering wraps tbody in a positioned block; non-virtual uses normal tbody
    const tbody = container.querySelector('tbody')
    expect(tbody).toBeTruthy()
    // Normal tbody should NOT have position absolute style set on it
    expect(tbody?.style.position).not.toBe('absolute')
  })

  it('uses virtual rendering when virtual prop is true', () => {
    const primitive: DataTableTanstackCorePrimitive = {
      ...basePrimitive,
      virtual: true,
    }
    const { container } = render(<DataTableTanstack primitive={primitive} />)
    const tbody = container.querySelector('tbody')
    // Virtual tbody has position: relative and display: block
    expect(tbody?.style.position).toBe('relative')
  })

  it('activates virtual rendering automatically at > 200 rows', () => {
    const manyRows = Array.from({ length: 201 }, (_, i) => ({
      name: `Row ${i}`,
      count: i,
      status: 'active',
      created: '2026-01-01T00:00:00Z',
    }))
    const primitive: DataTableTanstackCorePrimitive = {
      ...basePrimitive,
      data: manyRows,
      pageSize: 50,
    }
    const { container } = render(<DataTableTanstack primitive={primitive} />)
    const tbody = container.querySelector('tbody')
    expect(tbody?.style.position).toBe('relative')
  })
})
