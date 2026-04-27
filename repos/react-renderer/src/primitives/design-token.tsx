// DesignToken primitive - applies CSS custom properties to :root

import { useEffect } from 'react'
import type { DesignTokenPrimitive } from '../types'

export interface DesignTokenProps {
  primitive: DesignTokenPrimitive
}

/**
 * DesignToken
 *
 * On mount, applies CSS custom property values from `primitive.content`
 * to `document.documentElement` (the `:root` element).
 * On unmount, removes those properties.
 */
export function DesignToken({ primitive }: DesignTokenProps) {
  const { content } = primitive

  useEffect(() => {
    const keys = Object.keys(content)
    keys.forEach((key) => {
      document.documentElement.style.setProperty(key, content[key])
    })

    return () => {
      keys.forEach((key) => {
        document.documentElement.style.removeProperty(key)
      })
    }
  }, [content])

  // Renders nothing — purely a side-effect component
  return null
}
