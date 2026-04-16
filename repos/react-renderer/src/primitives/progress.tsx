// Progress primitive - progress indicator

import React from 'react'
import type { ProgressPrimitive } from '../types'

export interface ProgressProps {
  primitive: ProgressPrimitive
}

export function Progress({ primitive }: ProgressProps) {
  const { progressType = 'bar', value, max = 100, label, showValue = true } = primitive
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  if (progressType === 'circle') {
    const radius = 40
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (percentage / 100) * circumference

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#e4e4e7"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#2563eb"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
          {/* Value text */}
          {showValue && (
            <text
              x="50"
              y="50"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="16"
              fontWeight="600"
              fill="#18181b"
            >
              {Math.round(percentage)}%
            </text>
          )}
        </svg>
        {label && <span style={{ fontSize: '0.875rem', color: '#71717a' }}>{label}</span>}
      </div>
    )
  }

  if (progressType === 'gauge') {
    const gaugeColor = percentage >= 80 ? '#22c55e' : percentage >= 50 ? '#eab308' : '#ef4444'

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {label && <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{label}</span>}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            flex: 1,
            height: '24px',
            backgroundColor: '#e4e4e7',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${percentage}%`,
              height: '100%',
              backgroundColor: gaugeColor,
              transition: 'width 0.3s ease, background-color 0.3s ease'
            }} />
          </div>
          {showValue && (
            <span style={{
              minWidth: '48px',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: gaugeColor
            }}>
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      </div>
    )
  }

  // Default: bar
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && <span style={{ fontSize: '0.875rem', color: '#71717a' }}>{label}</span>}
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: '#e4e4e7',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: '#2563eb',
          transition: 'width 0.3s ease'
        }} />
      </div>
      {showValue && (
        <span style={{ fontSize: '0.75rem', color: '#71717a' }}>
          {value} / {max}
        </span>
      )}
    </div>
  )
}
