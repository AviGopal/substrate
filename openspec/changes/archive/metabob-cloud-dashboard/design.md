# metabob-cloud-dashboard - Design Document

**Status:** Draft
**Created:** 2026-03-23
**Updated:** 2026-03-25
**Author:** System (via Claude Code)
**Type:** Frontend Application

---

## Overview

The Metabob Cloud Dashboard is the primary SaaS interface for development teams. It provides visibility into code quality, project health, and development activity across the organization.

## Design Philosophy

### Simple & Transparent

The dashboard should feel **unobtrusive** - letting the data speak for itself without visual noise. Users come here for clarity and actionable insights, not to be impressed by animations or complex visualizations.

**Key Principles:**
- **Transparency over decoration** - subtle backgrounds, clear typography
- **Information density where needed** - tables for data, cards for summaries
- **Progressive disclosure** - show summaries first, details on demand
- **Consistent interaction patterns** - same gestures work everywhere

### First Impressions Matter

This is one of Metabob's first public faces. The design should communicate:
- **Professionalism** - we take code quality seriously
- **Clarity** - we help you see what matters
- **Reliability** - our tools work consistently
- **Not overbearing** - we're here to help, not to show off

---

## Technology Stack

### UI Framework
- **shadcn/ui** - Headless components with full customization
- **Tailwind CSS v4** - Utility-first styling
- **@radix-ui** - Accessible primitives

### Why shadcn/ui
1. **Ownership** - components are copied into the project, not imported
2. **Customization** - full control over styling and behavior
3. **Accessibility** - built on Radix primitives (WCAG 2.1 AA)
4. **Simplicity** - no heavy runtime, just CSS and React

---

## Color Palette

Based on the established Metabob brand from `repos/metabob-dashboard`:

### Core Colors (Dark Theme)

```css
:root {
  /* Background layers */
  --background-default: #161721;    /* Primary background */
  --background-secondary: #282536;  /* Card/panel background */
  --background-elevated: #1d1f26;   /* Elevated surfaces */

  /* Primary palette */
  --primary-main: #161721;
  --primary-dark: #161721;
  --primary-light: #25273b;

  /* Secondary (purple accent) */
  --secondary-main: #282536;
  --secondary-dark: #282536;
  --secondary-light: #d5bdfa;       /* Light purple highlight */

  /* Grey scale */
  --grey-main: #e8e8e9;
  --grey-A100: #d0d1d3;
  --grey-A200: #a2a2a6;
  --grey-300: #73747a;
  --grey-400: #393d4b;
  --grey-500: #16181d;
  --grey-600: #222222;
  --grey-A400: #1d1f26;
  --grey-A700: #1a1d23;

  /* Text hierarchy */
  --primary-text: #ffffff;
  --secondary-text: #c0c1c3;
  --disabled-text: #73747a;

  /* Borders */
  --divider: #23262e;
  --border-subtle: rgba(35, 38, 46, 1);

  /* Accent (blue) */
  --accent-main: #1f97d9;
  --accent-dark: #1777ad;
  --accent-light: #4db1e9;

  /* Info (cyan-blue) */
  --info-main: #4fc5ff;
  --info-dark: #1a89bf;
  --info-light: #a7e2ff;

  /* Success (green) */
  --success-main: #18bf80;
  --success-dark: #108055;
  --success-light: #20ffaa;

  /* Error (red) */
  --error-main: #ff3c54;
  --error-dark: #cc3044;
  --error-light: #ff6b7c;

  /* Critical (purple) */
  --critical-main: #a70cea;
  --critical-dark: #850bbb;
  --critical-light: #c23cf2;

  /* Priority indicators */
  --priority-high: rgba(255, 171, 112, 0.75);    /* Orange */
  --priority-critical: rgba(255, 86, 69, 0.75);  /* Red */
  --priority-low: rgba(167, 226, 255, 0.75);     /* Light blue */
}
```

### Tailwind Configuration

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#161721',
          secondary: '#282536',
          elevated: '#1d1f26',
        },
        primary: {
          DEFAULT: '#161721',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#282536',
          foreground: '#c0c1c3',
          light: '#d5bdfa',
        },
        accent: {
          DEFAULT: '#1f97d9',
          dark: '#1777ad',
          light: '#4db1e9',
        },
        muted: {
          DEFAULT: '#73747a',
          foreground: '#a2a2a6',
        },
        border: '#23262e',
        destructive: {
          DEFAULT: '#ff3c54',
          foreground: '#ffffff',
        },
        success: {
          DEFAULT: '#18bf80',
          foreground: '#ffffff',
        },
        warning: {
          DEFAULT: 'rgba(255, 171, 112, 0.75)',
          foreground: '#ffffff',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Noto Sans Mono', 'monospace'],
      },
    },
  },
}
```

---

## User Personas & Flows

Understanding who uses the dashboard and what they need:

### Persona 1: Engineering Manager

**Role:** Oversees 2-3 development teams, reports to VP Engineering
**Goals:**
- Demonstrate value of code quality tools to leadership
- Track team progress on reducing technical debt
- Identify problematic areas before they become blockers

**Mental Model:**
- Thinks in sprints and quarters
- Needs evidence for stakeholder conversations
- Values trends over snapshots

**User Stories:**

1. **"Show me the value we're getting"**
   - View: Overview Dashboard
   - Key Metrics: Issues resolved this sprint, quality trends
   - Decision: Should we continue investing in code quality?

2. **"Which areas need attention?"**
   - View: Issues filtered by severity + project
   - Pattern: Critical issues clustered in specific modules
   - Action: Prioritize tech debt in next sprint

3. **"How is my team doing?"**
   - View: Project metrics over time
   - Pattern: Success rate improving week over week
   - Output: Screenshot for leadership update

### Persona 2: Developer

**Role:** Individual contributor, works on features daily
**Goals:**
- Understand what issues affect their code
- Quickly fix problems before they compound
- Feel empowered, not surveilled

**Mental Model:**
- Thinks in features and pull requests
- Wants direct links to code locations
- Values speed and accuracy over completeness

**User Stories:**

1. **"What's wrong with my code?"**
   - View: Issues filtered by file path or recent changes
   - Pattern: Same issue type appearing in new code
   - Action: Click through to file:line in IDE/repo

2. **"Did the fix work?"**
   - View: Issue detail after commit
   - Pattern: Status changed to resolved
   - Confirmation: Quality check passed

3. **"What should I fix next?"**
   - View: Issues sorted by impact/severity
   - Pattern: Highest-impact issues in areas I own
   - Action: Create task/ticket from issue

### Persona 3: CTO/Engineering Leader

**Role:** Strategic oversight, rarely in dashboard
**Goals:**
- Quick pulse check on code quality health
- Evidence for board/investor conversations
- ROI justification for tooling spend

**Mental Model:**
- Thinks in business outcomes
- Needs summary metrics, not details
- Values clear trends and comparisons

**User Stories:**

1. **"Are we getting better?"**
   - View: Overview Dashboard (30-second scan)
   - Key Metric: Quality trend arrow (up/down)
   - Output: "Quality improved 15% this quarter"

2. **"Is this worth the investment?"**
   - View: Value & Impact metrics
   - Pattern: Issues caught before production
   - Evidence: Problems prevented vs. cost

---

## User Flow Mappings

### Authentication Flow

```
Login Page
    │
    ├─── Email/Password Form
    │         │
    │         └── POST /auth/login (analysis-api)
    │                   │
    │                   ├── Success → JWT Token
    │                   │              │
    │                   │              └── Store in memory
    │                   │                       │
    │                   │                       └── Redirect to Overview
    │                   │
    │                   └── Failure → Error message + retry
    │
    └─── "Forgot Password" link → External auth flow
```

### Overview Dashboard Flow

```
Overview Page Load
    │
    ├─── Parallel API Calls:
    │    │
    │    ├── GET /projects (analysis-api)
    │    │       └── Count, list for dropdown
    │    │
    │    ├── GET /projects/default/problems?severity=critical (analysis-api)
    │    │       └── Count of critical issues
    │    │
    │    ├── GET /v2/activities/templates (activity-api)
    │    │       └── Template count, categories
    │    │
    │    └── GET /v2/activities/execution-traces?limit=10 (activity-api)
    │            └── Recent activity for timeline
    │
    ├─── Render:
    │    │
    │    ├── Metric Cards (4 columns)
    │    │    ├── Projects: {count}
    │    │    ├── Critical Issues: {count} [badge color]
    │    │    ├── Templates: {count}
    │    │    └── Recent Activity: {count today}
    │    │
    │    └── Timeline (recent 10 events)
    │         └── Click → Navigate to detail
    │
    └─── WebSocket Connection (optional)
         └── Subscribe to: activity.completed, issues.created
```

### Issues Flow

```
Issues Page
    │
    ├─── Initial Load:
    │    │
    │    └── GET /projects/{project_id}/problems (analysis-api)
    │            │
    │            ├── Query params: severity, status, limit, offset
    │            │
    │            └── Returns: paginated issues list
    │
    ├─── Filter Interactions:
    │    │
    │    ├── Severity Toggle
    │    │       └── Update query param → re-fetch
    │    │
    │    ├── Status Filter
    │    │       └── Update query param → re-fetch
    │    │
    │    ├── Search Input (debounced 300ms)
    │    │       └── Update query param → re-fetch
    │    │
    │    └── Project Dropdown
    │            └── Change project_id → re-fetch
    │
    └─── Issue Row Click:
         │
         └── Issue Detail Modal/Page
              │
              ├── GET /problems/{id} (analysis-api)
              │       └── Full problem details
              │
              └── Display:
                   ├── Code snippet with highlighting
                   ├── Suggested fix (if available)
                   ├── File path (linkable)
                   └── Action buttons: Resolve, Ignore, Create Task
```

### Projects Flow

```
Projects Page
    │
    ├─── Initial Load:
    │    │
    │    └── GET /projects (analysis-api)
    │            └── Returns: all org projects
    │
    ├─── Project Card/Row:
    │    │
    │    ├── Name, description
    │    ├── Issue counts by severity
    │    ├── Created date
    │    └── Actions: Edit, Delete (not for default)
    │
    ├─── Create Project:
    │    │
    │    ├── Open modal/form
    │    ├── POST /projects (analysis-api)
    │    │       └── Body: { name, description }
    │    └── Optimistic update → Add to list
    │
    └─── Project Detail Click:
         │
         └── Navigate to Issues filtered by project
```

---

## API Integration Map

### Endpoint to Component Mapping

| Component | API Endpoint | Service | Data Used |
|-----------|-------------|---------|-----------|
| Overview Metrics | `GET /projects` | analysis-api | count |
| Overview Metrics | `GET /projects/:id/problems` | analysis-api | count by severity |
| Overview Timeline | `GET /v2/activities/execution-traces` | activity-api | recent executions |
| Issues Table | `GET /projects/:id/problems` | analysis-api | paginated list |
| Issue Detail | `GET /problems/:id` | analysis-api | full details |
| Projects List | `GET /projects` | analysis-api | all projects |
| Project CRUD | `POST/PUT/DELETE /projects` | analysis-api | mutations |
| API Keys | `GET/POST/DELETE /api-keys` | analysis-api | key management |
| Value Metrics | `GET /analytics/metrics` | analysis-api | quality trends |
| Activity Stream | WebSocket `/ws` | activity-api | real-time events |

### Authentication Headers

All requests include:
```typescript
{
  'Authorization': `Bearer ${jwt}`,
  'Content-Type': 'application/json',
  'X-Org-Id': orgId  // from JWT claims
}
```

---

## Component Architecture

### Page Components

```
src/
├── pages/
│   ├── Login.tsx           # Auth form
│   ├── Overview.tsx        # Dashboard home
│   ├── Projects.tsx        # Project list
│   ├── ProjectDetail.tsx   # Single project
│   ├── Issues.tsx          # Issues table
│   ├── IssueDetail.tsx     # Issue modal/page
│   ├── APIKeys.tsx         # Key management
│   └── ValueImpact.tsx     # Metrics/charts
```

### Shared Components

```
src/
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   └── ...
│   │
│   ├── Layout.tsx          # App shell
│   ├── Header.tsx          # Top nav
│   ├── Sidebar.tsx         # Left nav
│   ├── MetricCard.tsx      # KPI display
│   ├── ActivityTimeline.tsx
│   ├── IssueRow.tsx        # Table row
│   ├── ProjectCard.tsx
│   ├── ConnectionStatus.tsx
│   ├── LoadingSkeleton.tsx
│   └── ErrorBoundary.tsx
```

### Hooks

```
src/
├── hooks/
│   ├── useAuth.ts          # Auth context
│   ├── useProjects.ts      # Project data
│   ├── useIssues.ts        # Issues with filters
│   ├── useMetrics.ts       # Aggregated metrics
│   ├── useWebSocket.ts     # Real-time connection
│   └── useMediaQuery.ts    # Responsive breakpoints
```

---

## Visual Design Specs

### Layout Grid

```
┌──────────────────────────────────────────────────────┐
│ Header (h: 56px)                                     │
│ [Logo]              [Connection Status] [User Menu]  │
├─────────┬────────────────────────────────────────────┤
│ Sidebar │ Main Content                               │
│ (w:220) │                                            │
│         │ ┌──────────────────────────────────────┐  │
│ [Nav]   │ │ Page Content (padding: 24px)         │  │
│         │ │                                       │  │
│         │ │                                       │  │
│         │ └──────────────────────────────────────┘  │
│         │                                            │
└─────────┴────────────────────────────────────────────┘
```

### Metric Cards

```
┌─────────────────────────┐
│ [Icon]                  │
│                         │
│ 42                      │  ← Primary value (text-3xl)
│ Critical Issues         │  ← Label (text-sm muted)
│                         │
│ ↑ 12% from last week    │  ← Trend (text-xs success/error)
└─────────────────────────┘

Background: var(--background-secondary)
Border: 1px solid var(--border-subtle)
Border-radius: 8px
Padding: 16px
```

### Table Rows

```
┌─────────┬──────────────────┬────────────┬──────────┬─────────┐
│ Severity│ Title            │ File       │ Status   │ Actions │
├─────────┼──────────────────┼────────────┼──────────┼─────────┤
│ [Badge] │ SQL injection... │ auth.ts:42 │ [Badge]  │ [...]   │
│ Critical│                  │            │ Open     │         │
├─────────┼──────────────────┼────────────┼──────────┼─────────┤
│ [Badge] │ Unused variable  │ util.ts:15 │ [Badge]  │ [...]   │
│ Low     │                  │            │ Open     │         │
└─────────┴──────────────────┴────────────┴──────────┴─────────┘

Row height: 56px
Row hover: var(--grey-A400)
Border-bottom: 1px solid var(--border-subtle)
```

### Severity Badges

```css
.badge-critical {
  background: rgba(255, 86, 69, 0.2);
  color: var(--error-main);
  border: 1px solid rgba(255, 86, 69, 0.3);
}

.badge-high {
  background: rgba(255, 171, 112, 0.2);
  color: #ffab70;
  border: 1px solid rgba(255, 171, 112, 0.3);
}

.badge-medium {
  background: rgba(79, 197, 255, 0.2);
  color: var(--info-main);
  border: 1px solid rgba(79, 197, 255, 0.3);
}

.badge-low {
  background: rgba(167, 226, 255, 0.2);
  color: var(--info-light);
  border: 1px solid rgba(167, 226, 255, 0.3);
}
```

---

## Interaction Patterns

### Loading States

- **Page level**: Full-page skeleton matching content layout
- **Component level**: Skeleton cards/rows with shimmer animation
- **Button level**: Spinner inside button, disabled state
- **Inline**: Small spinner next to loading content

### Error Handling

- **API errors**: Toast notification with retry button
- **Network errors**: Connection banner at top
- **Form errors**: Inline field validation
- **404**: Friendly "not found" page with navigation

### Real-time Updates

- **WebSocket connected**: Green dot in header
- **WebSocket reconnecting**: Yellow dot, "Reconnecting..."
- **Polling fallback**: Gray dot, silent operation
- **New data**: Subtle highlight on updated rows

---

## Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | < 640px | Hamburger menu, stacked cards, simplified tables |
| Tablet | 640-1024px | Collapsed sidebar, 2-column cards |
| Desktop | > 1024px | Full sidebar, 4-column cards, full tables |

### Mobile Adaptations

- Sidebar becomes hamburger menu
- Tables become card lists
- Metric grid: 1 column
- Forms: full width inputs
- Modals: full screen

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance

- **Color contrast**: 4.5:1 minimum for text
- **Focus indicators**: Visible outline on all interactive elements
- **Keyboard navigation**: All features accessible via keyboard
- **Screen reader**: Proper ARIA labels and roles
- **Motion**: Respect `prefers-reduced-motion`

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search |
| `Esc` | Close modal/menu |
| `Tab` | Navigate elements |
| `Enter` | Activate button/link |
| `Arrow keys` | Navigate lists |

---

## Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3.5s |
| Largest Contentful Paint | < 2.5s |
| Bundle size (gzipped) | < 200KB initial |
| API response display | < 100ms after fetch |

### Optimization Strategies

- **Code splitting**: Lazy load route components
- **Image optimization**: WebP format, lazy loading
- **Caching**: API responses cached 5min client-side
- **Debouncing**: Search inputs, filter changes
- **Virtual scrolling**: Long lists only

---

## Security Considerations

### Token Storage

- JWT stored **in memory only** (not localStorage)
- Token passed via Authorization header
- Automatic refresh before expiry
- Clear on logout or tab close

### API Security

- All requests over HTTPS
- CORS restricted to dashboard domain
- Rate limiting on API endpoints
- Input sanitization before display

### User Data

- No sensitive data logged to console in production
- Error messages don't expose internal details
- Session timeout after 12 hours of inactivity

---

## Future Considerations

- **Theming**: Light mode option (post-MVP)
- **Notifications**: Browser push notifications for critical issues
- **Export**: CSV/PDF export for reports
- **Integrations**: Link to external issue trackers (Jira, Linear)
- **Mobile app**: React Native version (long-term)

---

## References

- [shadcn/ui Components](https://ui.shadcn.com/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Radix UI Primitives](https://www.radix-ui.com/)
- Original dashboard: `repos/metabob-dashboard/src/App.css`
