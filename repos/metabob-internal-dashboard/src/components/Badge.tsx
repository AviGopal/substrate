/**
 * Badge Component
 *
 * A visual badge component that displays system operational status
 * with configurable variants including success/healthy state styling.
 */

import { clsx } from 'clsx'

export type BadgeVariant = 'success' | 'healthy' | 'warning' | 'error' | 'info' | 'neutral'
export type BadgeSize = 'sm' | 'md' | 'lg'

interface BadgeProps {
  /** The variant determines the color scheme and semantic meaning */
  variant?: BadgeVariant
  /** Size of the badge */
  size?: BadgeSize
  /** Badge content */
  children: React.ReactNode
  /** Optional icon to display */
  icon?: React.ReactNode
  /** Additional CSS classes */
  className?: string
  /** Whether to show a pulsing animation (useful for live status) */
  animate?: boolean
}

const VARIANT_STYLES: Record<BadgeVariant, {
  bg: string
  text: string
  border: string
  dot?: string
}> = {
  success: {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/20',
    dot: 'bg-green-400'
  },
  healthy: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400'
  },
  warning: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/20',
    dot: 'bg-yellow-400'
  },
  error: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    dot: 'bg-red-400'
  },
  info: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    dot: 'bg-blue-400'
  },
  neutral: {
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    border: 'border-zinc-500/20',
    dot: 'bg-zinc-400'
  }
}

const SIZE_STYLES: Record<BadgeSize, {
  container: string
  text: string
  dot: string
}> = {
  sm: {
    container: 'px-2 py-0.5 gap-1',
    text: 'text-xs',
    dot: 'h-1.5 w-1.5'
  },
  md: {
    container: 'px-2.5 py-1 gap-1.5',
    text: 'text-sm',
    dot: 'h-2 w-2'
  },
  lg: {
    container: 'px-3 py-1.5 gap-2',
    text: 'text-base',
    dot: 'h-2.5 w-2.5'
  }
}

export function Badge({
  variant = 'neutral',
  size = 'md',
  children,
  icon,
  className,
  animate = false
}: BadgeProps) {
  const variantStyle = VARIANT_STYLES[variant]
  const sizeStyle = SIZE_STYLES[size]

  return (
    <span
      className={clsx(
        // Base styles
        'inline-flex items-center rounded-full border font-medium',
        // Variant styles
        variantStyle.bg,
        variantStyle.text,
        variantStyle.border,
        // Size styles
        sizeStyle.container,
        sizeStyle.text,
        // Custom className
        className
      )}
    >
      {/* Status dot indicator */}
      {!icon && (
        <span className="relative flex">
          {animate && (
            <span
              className={clsx(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                variantStyle.dot
              )}
            />
          )}
          <span
            className={clsx(
              'relative inline-flex rounded-full',
              sizeStyle.dot,
              variantStyle.dot
            )}
          />
        </span>
      )}
      
      {/* Custom icon */}
      {icon && (
        <span className="flex items-center justify-center">
          {icon}
        </span>
      )}
      
      {/* Badge content */}
      <span>{children}</span>
    </span>
  )
}

// Convenience components for common use cases
export function SuccessBadge(props: Omit<BadgeProps, 'variant'>) {
  return <Badge {...props} variant="success" />
}

export function HealthyBadge(props: Omit<BadgeProps, 'variant'>) {
  return <Badge {...props} variant="healthy" />
}

export function SystemStatusBadge({ 
  status, 
  ...props 
}: Omit<BadgeProps, 'variant' | 'children'> & { 
  status: 'operational' | 'healthy' | 'degraded' | 'down' | 'maintenance'
}) {
  const statusConfig = {
    operational: { variant: 'success' as const, label: 'Operational', animate: false },
    healthy: { variant: 'healthy' as const, label: 'Healthy', animate: false },
    degraded: { variant: 'warning' as const, label: 'Degraded', animate: true },
    down: { variant: 'error' as const, label: 'Down', animate: true },
    maintenance: { variant: 'info' as const, label: 'Maintenance', animate: false }
  }
  
  const config = statusConfig[status]
  
  return (
    <Badge 
      {...props} 
      variant={config.variant} 
      animate={config.animate}
    >
      {config.label}
    </Badge>
  )
}

export default Badge
