// Core context interfaces and function signatures
import type { ImpulseRef } from '../types';

export interface LoadedImpulse {
  id: string;
  type: string;
  content: string;
  metadata?: {
    summary?: string;
    size?: number;
    lastModified?: string;
    [key: string]: any;
  };
  budget: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

// Re-export resolveImpulse from impulse module
export { resolveImpulse } from '../impulse/resolver';

// Core context functions - to be implemented
export async function loadImpulses(): Promise<LoadedImpulse[]> {
  // Implementation will be added later
  throw new Error('Not implemented');
}

export function formatForPrompt(impulses: LoadedImpulse[]): string {
  // Implementation will be added later
  throw new Error('Not implemented');
}

// Utility types
export type ImpulseType = 'memo' | 'file' | 'activityOutput' | 'custom';
export type Priority = 'critical' | 'high' | 'medium' | 'low';