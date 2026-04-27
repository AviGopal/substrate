// composition-metric resolver - records UI composition metrics to activity-api

import { registerResolver } from './index'
import { impulseStore } from '../state/impulse-store'

interface CompositionMetricPointer {
  type: 'composition_metric'
  executionId?: string
  templateId?: string
  variant?: string
  outcome: 'success' | 'failure'
  failureMode?: string
  primitiveType?: string
  timeToActionMs?: number
  impulsesRendered?: number
}

registerResolver('composition_metric', async (rawPointer) => {
  const pointer = rawPointer as unknown as CompositionMetricPointer
  const {
    executionId,
    templateId,
    variant,
    outcome,
    failureMode,
    primitiveType,
    timeToActionMs,
    impulsesRendered,
  } = pointer

  // POST to activity-api if endpoint is configured
  const metabobEndpoint = process.env.METABOB_ENDPOINT
  const metabobApiKey = process.env.METABOB_API_KEY

  if (metabobEndpoint) {
    try {
      const body: Record<string, unknown> = {
        activity_variant_id: variant ?? executionId,
        ...(templateId ? { activity_id: templateId } : {}),
        ...(executionId ? { execution_id: executionId } : {}),
        outcome,
        shape: 'composition_metric',
        metadata: {
          failureMode,
          primitiveType,
          timeToActionMs,
          impulsesRendered,
        },
      }

      await fetch(`${metabobEndpoint}/v2/activities/impulse-relevance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(metabobApiKey ? { Authorization: `ApiKey ${metabobApiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      })
    } catch (err) {
      // Gracefully skip — metric recording is best-effort
      console.warn('[composition_metric] Failed to post metric to activity-api:', err)
    }
  }

  // Create a composition_metric impulse in the store for local observability
  impulseStore.create(
    {
      type: 'badge',
      text: `metric:${outcome}`,
      variant: outcome === 'success' ? 'success' : 'error',
    },
    {
      priority: 'low',
      metadata: { componentType: 'composition_metric' },
      deletable: true,
    }
  )

  return { content: { success: true } }
})
