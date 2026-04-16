# React Activity Templates

Comprehensive activity templates to teach MiniBob how to build React applications.

## Activities

### 1. Component Creation (Beginner)
**File**: `01-react-component-creation.json`

**Purpose**: Create individual React components with TypeScript, testing, and styling.

**Usage**:
```bash
minibob --single "Create a UserCard component that displays user profile with avatar and bio"
```

**Learns**:
- TypeScript interfaces for props
- Functional component patterns
- Event handler typing
- CSS Modules
- React Testing Library
- Accessibility

---

### 2. App Scaffolding (Intermediate)
**File**: `02-react-app-scaffolding.json`

**Purpose**: Set up complete React applications with routing and configuration.

**Usage**:
```bash
minibob --single "Create a new React app called 'blog-platform' with routing and TypeScript"
```

**Learns**:
- Vite/Next.js setup
- TypeScript configuration
- React Router
- Project structure
- Path aliases
- Global styles

---

### 3. UI Integration (Intermediate)
**File**: `03-react-ui-integration.json`

**Purpose**: Connect business logic to UI through custom hooks and proper architecture.

**Usage**:
```bash
minibob --single "Integrate the ArticleList feature with the /api/articles REST endpoint"
```

**Learns**:
- Custom React hooks
- Container/Presentational pattern
- API integration
- Error boundaries
- Loading states
- Integration testing

---

### 4. Styling (Beginner)
**File**: `04-react-styling.json`

**Purpose**: Add professional styling with CSS Modules or Tailwind.

**Usage**:
```bash
minibob --single "Style the ArticleCard component with CSS Modules using the design system"
```

**Learns**:
- CSS Modules
- Design tokens (CSS variables)
- Responsive design
- Accessibility in styling
- Dark mode
- Tailwind patterns

---

### 5. Full-Stack Applications (Advanced)
**File**: `05-react-full-stack.json`

**Purpose**: Build complete, production-ready applications end-to-end.

**Usage**:
```bash
minibob --single "Build a complete task manager with auth, CRUD operations, and search"
```

**Learns**:
- Application architecture
- State management (Zustand + React Query)
- Authentication flows
- E2E testing (Playwright)
- Deployment pipelines
- Documentation

---

## Learning Path

```
Week 1: Component Creation (5-10 executions)
   ↓
Week 2: App Scaffolding (3-5 executions)
   ↓
Week 3: UI Integration (5-7 executions)
   ↓
Week 4: Styling (5-7 executions)
   ↓
Week 5+: Full-Stack Apps (2-3 executions)
```

## Quick Start

### 1. Basic Component
```bash
minibob --single "Create a Button component with variants (primary, secondary) and sizes (sm, md, lg)"
```

### 2. New Application
```bash
minibob --single "Create a notes app with routing and state management"
```

### 3. Feature Integration
```bash
minibob --single "Integrate the UserProfile feature with /api/users/:id endpoint"
```

### 4. Style Component
```bash
minibob --single "Style the NoteCard component with responsive design and dark mode"
```

### 5. Complete Application
```bash
minibob --single "Build a complete notes app with authentication and CRUD operations"
```

## Success Metrics

Monitor in the activity dashboard:

- **Success Rate**: Target >85%
- **Average Duration**: Should decrease over time
- **Token Usage**: Should stabilize
- **Variant Creation**: Target <10%

## Quality Gates

Each activity includes validation for:

- ✅ TypeScript compilation
- ✅ Tests passing
- ✅ No console.log statements
- ✅ Accessibility standards
- ✅ Code style compliance

## Variables Reference

### Component Creation
- `componentName`: "UserCard"
- `componentDescription`: "Display user info"
- `includeStyles`: true
- `includeTests`: true

### App Scaffolding
- `appName`: "blog-platform"
- `framework`: "vite" | "next" | "cra"
- `includeRouting`: true
- `includeStateManagement`: true

### UI Integration
- `featureName`: "ArticleList"
- `dataSource`: "api" | "local-storage" | "context"
- `apiEndpoint`: "/api/articles"

### Styling
- `componentName`: "ArticleCard"
- `stylingApproach`: "css-modules" | "tailwind"
- `designSystem`: true

### Full-Stack
- `appName`: "task-manager"
- `features`: "auth,crud,search"
- `backendType`: "rest-api" | "graphql" | "firebase"
- `deployTarget`: "vercel" | "netlify" | "docker"

## Common Patterns Learned

### TypeScript Typing
```typescript
// Props interface
interface ComponentProps {
  title: string;
  count?: number;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

// Component
export function Component({ title, count = 0, onClick }: ComponentProps) {
  // ...
}
```

### Custom Hooks
```typescript
export function useFeature() {
  const { data, loading, error } = useQuery(/* ... */);
  const mutation = useMutation(/* ... */);

  return { data, loading, error, action: mutation.mutate };
}
```

### Container/Presentational
```typescript
// Container (logic)
export function FeatureContainer() {
  const { data, loading, error, action } = useFeature();
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  return <FeatureView data={data} onAction={action} />;
}

// View (UI only)
export function FeatureView({ data, onAction }: FeatureViewProps) {
  return <div>{/* Pure UI */}</div>;
}
```

### CSS Modules
```css
.container {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--color-bg);
}

.container[data-variant="primary"] {
  background: var(--color-primary);
}
```

## Troubleshooting

### Low Success Rate (<70%)
- Review validation criteria
- Check error patterns in dashboard
- Add more examples to prompts

### High Token Usage
- Refactor verbose prompts
- Use impulse compression
- Extract common patterns

### Inconsistent Quality
- Add more validation patterns
- Include typecheck/lint in validation
- Make prompts more explicit

## Documentation

See **[TEACHING_MINIBOB_REACT.md](../../../TEACHING_MINIBOB_REACT.md)** for:
- Detailed learning progression
- Expected outcomes
- Validation strategies
- Advanced usage patterns
- ROI measurement

## Contributing

To add new React patterns:

1. Identify the pattern MiniBob struggles with
2. Create activity template using `create-activity`
3. Test with 3-5 executions
4. Update this README
5. Submit PR

## Resources

- **Main Documentation**: `/TEACHING_MINIBOB_REACT.md`
- **Activity Dashboard**: `https://internal.metabob.com`
- **MiniBob Guide**: `repos/minibob/CLAUDE.md`
- **Architecture**: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
