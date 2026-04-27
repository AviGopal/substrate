// Tests for ErrorBoundary component

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'

// Suppress console.error for expected error boundary tests
const originalError = console.error
beforeEach(() => {
  console.error = () => {}
})

afterEach(() => {
  console.error = originalError
  cleanup()
})

// A component that throws on render
function ThrowingComponent({ message }: { message: string }): React.ReactNode {
  throw new Error(message)
}

// A component that renders normally
function SafeComponent({ text }: { text: string }) {
  return <div data-testid="safe">{text}</div>
}

describe('ErrorBoundary', () => {
  it('renders children normally when no error occurs', () => {
    render(
      <ErrorBoundary impulseId="imp-1" primitiveType="text">
        <SafeComponent text="Hello" />
      </ErrorBoundary>
    )
    expect(screen.getByTestId('safe').textContent).toBe('Hello')
  })

  it('renders fallback UI with red border when child throws', () => {
    render(
      <ErrorBoundary impulseId="imp-1" primitiveType="text">
        <ThrowingComponent message="Something went wrong" />
      </ErrorBoundary>
    )
    const fallback = screen.getByTestId('error-boundary-fallback')
    expect(fallback).toBeTruthy()
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByText(/Render error in text/)).toBeTruthy()
  })

  it('shows stack trace in details element', () => {
    render(
      <ErrorBoundary impulseId="imp-1" primitiveType="container">
        <ThrowingComponent message="Stack test" />
      </ErrorBoundary>
    )
    const summary = screen.getByText('Stack trace')
    expect(summary).toBeTruthy()
  })

  it('sibling ErrorBoundary survives when one throws', () => {
    render(
      <div>
        <ErrorBoundary impulseId="imp-1" primitiveType="bad">
          <ThrowingComponent message="fails" />
        </ErrorBoundary>
        <ErrorBoundary impulseId="imp-2" primitiveType="good">
          <SafeComponent text="still alive" />
        </ErrorBoundary>
      </div>
    )
    // Both rendered — one fallback, one safe
    expect(screen.getByTestId('error-boundary-fallback')).toBeTruthy()
    expect(screen.getByTestId('safe').textContent).toBe('still alive')
  })

  it('resets error state when updatedAt changes', () => {
    const { rerender } = render(
      <ErrorBoundary impulseId="imp-1" primitiveType="text" updatedAt={1000}>
        <ThrowingComponent message="initial error" />
      </ErrorBoundary>
    )

    // Error shown
    expect(screen.getByTestId('error-boundary-fallback')).toBeTruthy()

    // Rerender with new updatedAt and non-throwing child
    rerender(
      <ErrorBoundary impulseId="imp-1" primitiveType="text" updatedAt={2000}>
        <SafeComponent text="recovered" />
      </ErrorBoundary>
    )

    // Error cleared — safe component renders
    expect(screen.getByTestId('safe').textContent).toBe('recovered')
    expect(screen.queryByTestId('error-boundary-fallback')).toBeFalsy()
  })

  it('does NOT reset if updatedAt remains the same', () => {
    const { rerender } = render(
      <ErrorBoundary impulseId="imp-1" primitiveType="text" updatedAt={1000}>
        <ThrowingComponent message="persistent error" />
      </ErrorBoundary>
    )

    expect(screen.getByTestId('error-boundary-fallback')).toBeTruthy()

    // Same updatedAt — should still show error
    rerender(
      <ErrorBoundary impulseId="imp-1" primitiveType="text" updatedAt={1000}>
        <SafeComponent text="not shown" />
      </ErrorBoundary>
    )

    expect(screen.getByTestId('error-boundary-fallback')).toBeTruthy()
    expect(screen.queryByTestId('safe')).toBeFalsy()
  })
})
