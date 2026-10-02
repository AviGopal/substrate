
// openspec/changes/2026-08-17-orphaned-capability-resolution/impulses.ts

import { resolveOrphanedCapabilityResolution } from "./orphaned-capability-resolution";

export const newImpulseRoutes = [
  {
    shape: "orphaned-capability-resolution",
    resolver: resolveOrphanedCapabilityResolution,
  },
];
