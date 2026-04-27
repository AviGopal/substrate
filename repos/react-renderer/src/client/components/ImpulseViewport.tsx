import { useImpulseStoreForRender } from '../hooks/useImpulseStore'

export function ImpulseViewport() {
  const { data: impulses } = useImpulseStoreForRender()

  return (
    <div className="impulse-viewport relative min-h-screen p-4">
      {impulses.map((impulse) => (
        <div key={impulse.id} style={{ zIndex: impulse.pointer?.layer ?? 0 }}>
          {/* ImpulseCard will be wired in Commit D */}
          <div className="impulse-card-placeholder border rounded p-2 mb-2">
            <pre className="text-xs">{JSON.stringify(impulse.pointer?.primitive, null, 2)}</pre>
          </div>
        </div>
      ))}
    </div>
  )
}
