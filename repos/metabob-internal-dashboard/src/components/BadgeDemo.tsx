/**
 * Badge Component Demo
 *
 * Demonstrates the Badge component with various states including
 * success/healthy operational status styling.
 */

import { Badge, SystemStatusBadge, SuccessBadge, HealthyBadge } from './Badge'
import { CheckCircle, Heart, AlertTriangle, XCircle, Info } from 'lucide-react'

export function BadgeDemo() {
  return (
    <div className="p-6 space-y-6 bg-zinc-950 text-zinc-100">
      <h2 className="text-2xl font-bold mb-4">System Status Badges</h2>
      
      {/* System Status Examples */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-300">System Operational Status</h3>
        <div className="flex flex-wrap gap-3">
          <SystemStatusBadge status="operational" />
          <SystemStatusBadge status="healthy" animate />
          <SystemStatusBadge status="degraded" />
          <SystemStatusBadge status="down" />
          <SystemStatusBadge status="maintenance" />
        </div>
      </div>

      {/* Success/Healthy States */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-300">Success & Healthy States</h3>
        <div className="flex flex-wrap gap-3">
          <SuccessBadge>All Systems Go</SuccessBadge>
          <HealthyBadge animate>Live & Healthy</HealthyBadge>
          <Badge variant="success" icon={<CheckCircle className="h-3 w-3" />}>
            API Operational
          </Badge>
          <Badge variant="healthy" icon={<Heart className="h-3 w-3" />}>
            Database Healthy
          </Badge>
        </div>
      </div>

      {/* Different Sizes */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-300">Badge Sizes</h3>
        <div className="flex flex-wrap items-center gap-3">
          <SuccessBadge size="sm">Small</SuccessBadge>
          <SuccessBadge size="md">Medium</SuccessBadge>
          <SuccessBadge size="lg">Large</SuccessBadge>
        </div>
      </div>

      {/* All Variants */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-300">All Badge Variants</h3>
        <div className="flex flex-wrap gap-3">
          <Badge variant="success">Success</Badge>
          <Badge variant="healthy">Healthy</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="neutral">Neutral</Badge>
        </div>
      </div>

      {/* Animated Examples */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-300">Animated Status Indicators</h3>
        <div className="flex flex-wrap gap-3">
          <Badge variant="success" animate>Live Status</Badge>
          <Badge variant="healthy" animate>Health Check</Badge>
          <Badge variant="warning" animate>Processing</Badge>
          <Badge variant="error" animate>Alert</Badge>
        </div>
      </div>

      {/* Real-world Examples */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-zinc-300">Real-world Usage Examples</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 w-24">API Status:</span>
            <SuccessBadge>Online</SuccessBadge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 w-24">Database:</span>
            <HealthyBadge animate>Healthy</HealthyBadge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 w-24">Services:</span>
            <Badge variant="success" icon={<CheckCircle className="h-3 w-3" />}>
              All Operational
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 w-24">Monitoring:</span>
            <Badge variant="healthy" animate size="sm">
              Active
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BadgeDemo
