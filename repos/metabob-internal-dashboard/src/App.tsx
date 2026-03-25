/**
 * Internal Dashboard App
 *
 * MiniBob-controlled internal observability dashboard.
 * Uses unbounded rendering via composable primitives.
 */

import { useState, useCallback } from 'react'
import { useMiniBobConnection } from './hooks/useMiniBobConnection'
import { ConnectionStatus } from './components/ConnectionStatus'
import { QueryInput } from './components/QueryInput'
import { ImpulseLayout } from './components/ImpulseRenderer'
import type { ServerMessage } from './lib/websocket-handler'

export function App() {
  // Thinking state for loading indicator
  const [thinkingMessage, setThinkingMessage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Handle incoming messages
  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'thinking':
        setThinkingMessage(message.content)
        setIsProcessing(true)
        break

      case 'tool_call':
        if (message.status === 'started') {
          setThinkingMessage(`Calling ${message.tool}...`)
        }
        break

      case 'activity_complete':
        setThinkingMessage(null)
        setIsProcessing(false)
        break

      case 'error':
        setThinkingMessage(null)
        setIsProcessing(false)
        break
    }
  }, [])

  // Connect to MiniBob
  const { state, impulses, sendQuery, sendAction, reconnect } = useMiniBobConnection(
    {},
    handleMessage
  )

  // Handle query submission
  const handleSubmit = useCallback((query: string) => {
    if (query === '/clear') {
      // Send clear command to MiniBob
      sendAction('clear_ui_components', 'system')
      return
    }

    setIsProcessing(true)
    setThinkingMessage('Processing...')
    sendQuery(query)
  }, [sendQuery, sendAction])

  // Handle actions from UI components
  const handleAction = useCallback((action: string, componentId: string, payload?: unknown) => {
    setIsProcessing(true)
    setThinkingMessage('Executing action...')
    sendAction(action, componentId, payload)
  }, [sendAction])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Connection status indicator */}
      <ConnectionStatus
        status={state.status}
        reconnectAttempt={state.reconnectAttempt}
        sessionId={state.sessionId}
        lastError={state.lastError}
        onReconnect={reconnect}
      />

      {/* Impulse-driven UI layout */}
      <ImpulseLayout
        impulses={impulses}
        onAction={handleAction}
      />

      {/* Query input */}
      <QueryInput
        onSubmit={handleSubmit}
        isLoading={isProcessing}
        thinkingMessage={thinkingMessage}
        disabled={state.status !== 'connected'}
      />
    </div>
  )
}

export default App
