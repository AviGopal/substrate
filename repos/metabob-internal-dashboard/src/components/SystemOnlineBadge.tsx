/**
 * System Online Badge Component
 *
 * A visual badge component that displays a 'System Online' status message
 * using a success-styled variant (green color, positive indicator).
 */

import { Badge } from './Badge'
import { CheckCircle } from 'lucide-react'

interface SystemOnlineBadgeProps {
  /** Size of the badge */
  size?: 'sm' | 'md' | 'lg'
  /** Whether to show a pulsing animation to indicate live status */
  animate?: boolean
  /** Whether to show an icon */
  showIcon?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * SystemOnlineBadge displays a 'System Online' status message
 * with success styling (green color scheme)
 */
export function SystemOnlineBadge({
  size = 'md',
  animate = false,
  showIcon = true,
  className
}: SystemOnlineBadgeProps) {
  return (
    <Badge
      variant="success"
      size={size}
      animate={animate}
      icon={showIcon ? <CheckCircle className="h-3 w-3" /> : undefined}
      className={className}
    >
      System Online
    </Badge>
  )
}

export default SystemOnlineBadge
