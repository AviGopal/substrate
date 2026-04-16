// Resolver registry for react-renderer vessel

import type { ImpulsePointer, ResolverFunction } from '../types'

// Resolver registry
const resolvers = new Map<string, ResolverFunction>()

/**
 * Register a resolver for an impulse pointer type
 */
export function registerResolver<T extends ImpulsePointer>(
  type: string,
  resolver: ResolverFunction<T>
) {
  resolvers.set(type, resolver as ResolverFunction)
  console.log(`[Resolver] Registered: ${type}`)
}

/**
 * Check if a resolver exists for a type
 */
export function hasResolver(type: string): boolean {
  return resolvers.has(type)
}

/**
 * Get all registered resolver types
 */
export function getResolverTypes(): string[] {
  return Array.from(resolvers.keys())
}

/**
 * Resolve an impulse pointer to its content
 */
export async function resolve<T = unknown>(
  pointer: ImpulsePointer
): Promise<T> {
  const resolver = resolvers.get(pointer.type)

  if (!resolver) {
    throw new Error(`No resolver for impulse type: ${pointer.type}`)
  }

  const result = await resolver(pointer)
  return result as T
}

/**
 * Resolve multiple pointers in parallel
 */
export async function resolveAll<T = unknown>(
  pointers: ImpulsePointer[]
): Promise<T[]> {
  return Promise.all(pointers.map((p) => resolve<T>(p)))
}
