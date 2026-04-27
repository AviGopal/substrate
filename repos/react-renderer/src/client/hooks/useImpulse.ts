import { useQuery } from '@tanstack/react-query'
import type { UIComponentImpulse } from '../../types'

export function useImpulse(id: string | undefined) {
  return useQuery<UIComponentImpulse | undefined>({
    queryKey: ['impulse', id ?? ''],
    queryFn: () => undefined,
    staleTime: Infinity,
    enabled: !!id,
  })
}
