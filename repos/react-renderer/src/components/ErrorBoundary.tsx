// Server-side ErrorBoundary — used by PrimitiveRenderer for nested child components

import React from 'react'

interface Props {
  impulseId: string
  primitiveType: string
  depth?: number
  children: React.ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // Fire-and-forget: report error
    fetch(`/impulses/${this.props.impulseId}/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primitiveType: this.props.primitiveType,
        error: error.message,
        stack: error.stack,
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 12,
          background: '#fef2f2',
          border: '2px solid #fca5a5',
          borderRadius: 6,
          fontFamily: 'monospace',
          fontSize: 12,
        }}>
          <div style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: 4 }}>
            Render error in {this.props.primitiveType} (depth {this.props.depth ?? 0})
          </div>
          <div style={{ color: '#7f1d1d' }}>{this.state.error.message}</div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
