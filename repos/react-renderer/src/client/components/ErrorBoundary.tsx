// ErrorBoundary - Full-spec error boundary for the SPA

import React from 'react'

export interface ErrorBoundaryProps {
  impulseId: string
  primitiveType: string
  depth?: number
  updatedAt?: number
  children: React.ReactNode
}

export interface ErrorBoundaryState {
  error: Error | null
  errorInfo: React.ErrorInfo | null
  resetKey?: string
}

/**
 * ErrorBoundary
 *
 * Catches render errors in child components, shows a fallback UI,
 * and reports errors to the server (fire-and-forget).
 *
 * Resets automatically when `updatedAt` changes (impulse was updated).
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    errorInfo: null,
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState
  ): Partial<ErrorBoundaryState> | null {
    if (
      state.error &&
      props.updatedAt &&
      state.resetKey !== String(props.updatedAt)
    ) {
      return { error: null, errorInfo: null, resetKey: String(props.updatedAt) }
    }
    return null
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Fire-and-forget: report to vessel error store
    fetch(`/impulses/${this.props.impulseId}/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primitiveType: this.props.primitiveType,
        error: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        timestamp: Date.now(),
      }),
    }).catch(() => {})

    // Fire-and-forget: create render_failure impulse in vessel store
    fetch('/impulses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'render_failure',
        content: {
          primitiveType: this.props.primitiveType,
          errorMessage: error.message,
          impulseId: this.props.impulseId,
        },
        priority: 'high',
      }),
    }).catch(() => {})

    this.setState({
      error,
      errorInfo: info,
      resetKey: this.props.updatedAt ? String(this.props.updatedAt) : undefined,
    })
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fef2f2',
            border: '2px solid #fca5a5',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
          data-testid="error-boundary-fallback"
        >
          <div style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: '4px' }}>
            Render error in {this.props.primitiveType}
          </div>
          <div style={{ color: '#7f1d1d', marginBottom: '8px' }}>
            {this.state.error.message}
          </div>
          {this.state.errorInfo && (
            <details>
              <summary style={{ cursor: 'pointer', color: '#991b1b', marginBottom: '4px' }}>
                Stack trace
              </summary>
              <pre style={{
                fontSize: '10px',
                color: '#9f1239',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                marginTop: '4px',
              }}>
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
