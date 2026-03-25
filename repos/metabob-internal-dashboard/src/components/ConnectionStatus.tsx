/**
 * Connection Status Indicator Component
 *
 * Shows the current WebSocket connection state with visual feedback.
 */

import type { ConnectionStatus as Status } from '../hooks/useMiniBobConnection'

interface ConnectionStatusProps {
  status: Status
  reconnectAttempt?: number
  sessionId?: string | null
  lastError?: string | null
  onReconnect?: () => void
}

const STATUS_CONFIG: Record<Status, {
  color: string
  bgColor: string
  label: string
  animate?: boolean
}> = {
  connecting: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400',
    label: 'Connecting...',
    animate: true
  },
  connected: {
    color: 'text-green-400',
    bgColor: 'bg-green-400',
    label: 'Connected'
  },
  disconnected: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-400',
    label: 'Disconnected'
  },
  reconnecting: {
    color: 'text-orange-400',
    bgColor: 'bg-orange-400',
    label: 'Reconnecting...',
    animate: true
  },
  failed: {
    color: 'text-red-400',
    bgColor: 'bg-red-400',
    label: 'Connection Failed'
  }
}

export function ConnectionStatus({
  status,
  reconnectAttempt = 0,
  sessionId,
  lastError,
  onReconnect
}: ConnectionStatusProps) {
  const config = STATUS_CONFIG[status]

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 rounded-lg shadow-lg">
        {/* Status indicator dot */}
        <span className="relative flex h-2.5 w-2.5">
          {config.animate && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.bgColor} opacity-75`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.bgColor}`}
          />
        </span>

        {/* Status text */}
        <span className={`text-sm font-medium ${config.color}`}>
          {config.label}
          {status === 'reconnecting' && reconnectAttempt > 0 && (
            <span className="text-zinc-500 ml-1">
              (attempt {reconnectAttempt})
            </span>
          )}
        </span>

        {/* Session ID (truncated) */}
        {sessionId && status === 'connected' && (
          <span className="text-xs text-zinc-500 ml-2 font-mono">
            {sessionId.slice(0, 8)}
          </span>
        )}

        {/* Reconnect button for failed state */}
        {(status === 'failed' || status === 'disconnected') && onReconnect && (
          <button
            onClick={onReconnect}
            className="ml-2 px-2 py-0.5 text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
          >
            Reconnect
          </button>
        )}
      </div>

      {/* Error message */}
      {lastError && (status === 'failed' || status === 'disconnected') && (
        <div className="mt-2 px-3 py-2 bg-red-900/50 border border-red-800 rounded-lg text-sm text-red-300">
          {lastError}
        </div>
      )}
    </div>
  )
}

export default ConnectionStatus
