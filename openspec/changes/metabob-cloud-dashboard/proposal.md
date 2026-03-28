# metabob-cloud-dashboard - OpenSpec Proposal

**Status:** Draft
**Created:** 2026-03-23
**Author:** System (via Claude Code)
**Type:** Frontend Application
**Repo:** `repos/metabob-cloud-dashboard`

---

## Problem Statement

The existing `repos/metabob-dashboard` (MUI-based React 18) is:

1. **Tightly Coupled:** Depends on deprecated `repos/metabob-rpc-api` (Python)
2. **Heavy Dependencies:** MUI + Emotion + Redux = large bundle
3. **Missing Features:** No support for new architecture (progressive sync, value measurement)
4. **Deployment Complexity:** react-scripts, manual build process

Need a modern dashboard that integrates with **all** new TypeScript backends.

## Proposed Solution

Build fresh dashboard using modern stack aligned with new architecture.

**Scope:** ~5,000-8,000 LOC
**Stack:** React 19 + shadcn/ui + Tailwind CSS v4 + Bun.serve

### Key Features

**1. Overview Dashboard** - High-level metrics from all systems
**2. Development Events** - Real-time activity stream (WebSocket + polling)
**3. Project Management** - CRUD for org projects
**4. Issue Tracking** - Problems from analysis-api with filtering
**5. Value & Impact** - Quality trends, template performance
**6. API Key Management** - User provisioning (1:1 user ↔ API key)
**7. Knowledge Base** - Progressive sync data (future)

### Backend Integration

**Three APIs:**
- `metabob-analysis-api` - Auth, projects, problems, analytics
- `metabob-activity-api` - Activities, executions, impulses
- `metabob-mcp` - Code understanding (read-only initially)

**Routing:** All via Istio Gateway → `dashboard.minibob.local`

### Architecture Principles

**1. Federated APIs** - Dashboard talks to 3 independent backends
**2. Shared Auth** - JWT from analysis-api, validated by all services
**3. WebSocket Primary** - Real-time updates with polling fallback
**4. Simple & Transparent** - shadcn/ui with Metabob dark theme, unobtrusive design
**5. Type Safety** - Shared TypeScript interfaces

### Design Philosophy

- **Transparency over decoration** - subtle backgrounds, clear typography
- **Information density where needed** - tables for data, cards for summaries
- **Progressive disclosure** - show summaries first, details on demand
- **Not overbearing** - professional, helpful, focused on the user's work

## Dependencies

**Blocked By:**
- `metabob-analysis-api` (needs API endpoints)

**Recommended Before:**
- `metabob-mcp` (for full feature set)

**External Dependencies:**
- React 19
- shadcn/ui components
- Tailwind CSS v4
- Bun runtime
- @radix-ui (headless components)
- zod (validation)

## Success Criteria

1. **Functional Parity:** All 7 core features operational
2. **Performance:**
   - Initial page load < 2s
   - Navigation < 500ms
   - WebSocket latency < 100ms
3. **Deployment:** Successfully deploy to `dashboard.minibob.local`
4. **Integration:** All API endpoints working
5. **Bundle Size:** < 500KB gzipped

## Non-Goals

- Not migrating old dashboard data (fresh start)
- Not achieving pixel-perfect MUI match
- Not supporting IE11 or legacy browsers
- Not implementing every old dashboard feature (core only)

## Timeline

**Week 6:** Complete dashboard (15 tasks)
- Days 1-2: Foundation (setup + API client + auth)
- Days 3-4: Core features (4 pages)
- Day 5: Real-time updates + deployment

## References

- Original: `archive/cloud-dashboard-implementation/`
- Old Dashboard: `repos/metabob-dashboard/`
- Starter: `repos/metabob-cloud-dashboard/` (11 files exist)
- Tasks: [tasks.md](./tasks.md)
- Design: [design.md](./design.md)
- Query Topology: [specs/query-topology.md](./specs/query-topology.md)
