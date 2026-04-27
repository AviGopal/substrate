import { useQuery } from '@tanstack/react-query'
import type { UIComponentImpulse } from '../../types'

export function useImpulseStore() {
  return useQuery<UIComponentImpulse[]>({
    queryKey: ['impulses'],
    queryFn: () => [], // Bridge populates this; queryFn never actually called
    staleTime: Infinity,
    initialData: [],
  })
}

export function useImpulseStoreForRender() {
  const { data: impulses = [], ...rest } = useImpulseStore()
  const sorted = [...impulses].sort((a, b) => {
    const ld = (b.pointer?.layer ?? 0) - (a.pointer?.layer ?? 0)
    return ld !== 0 ? ld : (b.createdAt ?? 0) - (a.createdAt ?? 0)
  })
  return { data: sorted, ...rest }
}
