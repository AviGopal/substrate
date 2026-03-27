import type { ImpulseRef, ResolveResult } from './src/context/index';
import { resolveImpulse, createImpulseRef } from './src/context/index';

console.log('✓ Successfully imported ImpulseRef interface and resolveImpulse function');
console.log('Available exports:', { resolveImpulse: typeof resolveImpulse, createImpulseRef: typeof createImpulseRef });