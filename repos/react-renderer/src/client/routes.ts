import { createRootRoute, createRoute, Outlet } from '@tanstack/react-router'
import { z } from 'zod'
import { ImpulseViewport } from './components/ImpulseViewport'

const rootRoute = createRootRoute({ component: Outlet })

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  validateSearch: z.object({
    impulseId: z.string().optional(),
    sort: z.string().optional(),    // "column:asc" or "column:desc"
    filter: z.string().optional(),
    step: z.number().optional(),
    panel: z.string().optional(),
  }).parse,
  component: ImpulseViewport,
})

export const routeTree = rootRoute.addChildren([appRoute])
