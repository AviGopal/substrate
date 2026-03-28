/**
 * Query Input Component
 *
 * Floating centered text input for sending queries to MiniBob.
 * Features:
 * - Glassmorphism effect with dark theme
 * - Enter key submission
 * - Loading state during processing
 * - Query history with up/down navigation
 * - Persistent history in localStorage
 */

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'

interface QueryInputProps {
  onSubmit: (query: string) => void
  isLoading?: boolean
  thinkingMessage?: string | null
  disabled?: boolean
}

const HISTORY_KEY = 'metabob-internal-dashboard-query-history'
const MAX_HISTORY = 50

export function QueryInput({
  onSubmit,
  isLoading = false,
  thinkingMessage = null,
  disabled = false
}: QueryInputProps) {
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [tempValue, setTempValue] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      if (saved) {
        setHistory(JSON.parse(saved))
      }
    } catch (error) {
      console.warn('[QueryInput] Failed to load history:', error)
    }
  }, [])

  // Save history to localStorage
  const saveHistory = useCallback((newHistory: string[]) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory))
    } catch (error) {
      console.warn('[QueryInput] Failed to save history:', error)
    }
  }, [])

  // Add query to history
  const addToHistory = useCallback((query: string) => {
    setHistory(current => {
      // Don't add duplicates of the most recent query
      if (current[0] === query) return current

      const updated = [query, ...current.filter(q => q !== query)].slice(0, MAX_HISTORY)
      saveHistory(updated)
      return updated
    })
  }, [saveHistory])

  // Handle form submission
  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isLoading || disabled) return

    // Handle /clear command
    if (trimmed === '/clear') {
      onSubmit('/clear')
      setValue('')
      setHistoryIndex(-1)
      setTempValue(null)
      return
    }

    addToHistory(trimmed)
    onSubmit(trimmed)
    setValue('')
    setHistoryIndex(-1)
    setTempValue(null)
  }, [value, isLoading, disabled, onSubmit, addToHistory])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return

      if (historyIndex === -1) {
        // Save current input before navigating history
        setTempValue(value)
      }

      const newIndex = Math.min(historyIndex + 1, history.length - 1)
      setHistoryIndex(newIndex)
      setValue(history[newIndex])
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex === -1) return

      const newIndex = historyIndex - 1
      if (newIndex === -1) {
        // Restore original input
        setHistoryIndex(-1)
        setValue(tempValue ?? '')
        setTempValue(null)
      } else {
        setHistoryIndex(newIndex)
        setValue(history[newIndex])
      }
      return
    }

    // Reset history navigation on any other key
    if (historyIndex !== -1) {
      setHistoryIndex(-1)
      setTempValue(null)
    }
  }, [handleSubmit, history, historyIndex, value, tempValue])

  // Focus input on mount and when loading completes
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isLoading])

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-40">
      {/* Thinking message */}
      {thinkingMessage && (
        <div className="mb-3 px-4 py-2 bg-zinc-900/80 backdrop-blur-md border border-zinc-700 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="italic">{thinkingMessage}</span>
          </div>
        </div>
      )}

      {/* Input container with glassmorphism */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the system..."
          disabled={disabled}
          className={`
            w-full px-6 py-4
            bg-zinc-900/80 backdrop-blur-md
            border border-zinc-700 hover:border-zinc-600
            focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20
            rounded-xl
            text-zinc-100 placeholder:text-zinc-500
            text-base
            outline-none
            transition-all duration-200
            shadow-lg shadow-black/20
            ${isLoading ? 'cursor-wait' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />

        {/* Submit button / loading indicator */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <div className="p-2">
              <svg className="animate-spin h-5 w-5 text-indigo-400" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!value.trim() || disabled}
              className={`
                p-2 rounded-lg
                transition-all duration-200
                ${value.trim() && !disabled
                  ? 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10'
                  : 'text-zinc-600 cursor-not-allowed'
                }
              `}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* History hint */}
      {history.length > 0 && !isLoading && (
        <div className="mt-2 text-center text-xs text-zinc-600">
          Press ↑↓ to navigate history • /clear to reset
        </div>
      )}
    </div>
  )
}

export default QueryInput
