// Chart primitive - data visualization

import React from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import type { ChartPrimitive } from '../types'

export interface ChartProps {
  primitive: ChartPrimitive
}

const COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#ea580c',
  '#16a34a', '#0891b2', '#4f46e5', '#c026d3'
]

export function Chart({ primitive }: ChartProps) {
  const { chartType, data, xKey = 'name', yKey = 'value', title, height = 300 } = primitive

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey={yKey} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        )

      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={COLORS[0]}
              strokeWidth={2}
              dot={{ fill: COLORS[0], strokeWidth: 2 }}
            />
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey={yKey}
              stroke={COLORS[0]}
              fill={COLORS[0]}
              fillOpacity={0.3}
            />
          </AreaChart>
        )

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        )

      case 'scatter':
        return (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis dataKey={yKey} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Scatter data={data} fill={COLORS[0]} />
          </ScatterChart>
        )

      case 'gauge':
        // Simple gauge using a pie chart
        const rawGaugeValue = data[0]?.[yKey]
        const gaugeValue = typeof rawGaugeValue === 'number' ? rawGaugeValue : 0
        const gaugeMax = 100
        const gaugeData = [
          { name: 'value', value: gaugeValue },
          { name: 'remaining', value: gaugeMax - gaugeValue }
        ]
        const gaugeColor = gaugeValue >= 80 ? '#22c55e' : gaugeValue >= 50 ? '#eab308' : '#ef4444'

        return (
          <PieChart>
            <Pie
              data={gaugeData}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              startAngle={180}
              endAngle={0}
            >
              <Cell fill={gaugeColor} />
              <Cell fill="#e4e4e7" />
            </Pie>
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={24}
              fontWeight={600}
              fill="#18181b"
            >
              {gaugeValue}%
            </text>
          </PieChart>
        )

      case 'sparkline':
        return (
          <LineChart data={data}>
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={COLORS[0]}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        )

      default:
        return (
          <div style={{ padding: '24px', textAlign: 'center', color: '#71717a' }}>
            Unknown chart type: {chartType}
          </div>
        )
    }
  }

  return (
    <div>
      {title && (
        <h3 style={{
          fontSize: '1rem',
          fontWeight: 600,
          marginBottom: '12px',
          color: '#18181b'
        }}>
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  )
}
