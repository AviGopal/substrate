# Teaching MiniBob React Development

This document explains how to use the React activity templates to teach MiniBob how to build React applications effectively.

## Overview

MiniBob learns through **execution traces** - every activity execution creates a trace that feeds into the Thompson Sampling learning loop. The more MiniBob executes these activities, the better it gets at React development.

## The Learning Progression

The React activities are designed as a **progressive curriculum**, building from fundamentals to complete applications:

```
1. Component Creation (Beginner)
   ↓
2. App Scaffolding (Intermediate)
   ↓
3. UI Integration (Intermediate)
   ↓
4. Styling (Beginner)
   ↓
5. Full-Stack Applications (Advanced)
```

### Learning Path

**Week 1: Fundamentals**
- Execute `react-component-creation` 5-10 times with different component types
- Focus: TypeScript typing, component structure, basic testing

**Week 2: Project Setup**
- Execute `react-app-scaffolding` 3-5 times with different configurations
- Focus: Project architecture, configuration, tooling

**Week 3: Integration Patterns**
- Execute `react-ui-integration` 5-7 times with different data sources
- Focus: Custom hooks, state management, API integration

**Week 4: Polish & Style**
- Execute `react-styling` 5-7 times with different approaches
- Focus: CSS architecture, responsive design, accessibility

**Week 5+: Full Applications**
- Execute `react-full-stack` 2-3 times with increasing complexity
- Focus: End-to-end application development

## Activity Templates

### 1. react-component-creation

**Purpose**: Teach MiniBob how to create well-structured React components with TypeScript.

**Location**: `repos/metabob-proto/activities/react/01-react-component-creation.json`

**What MiniBob Learns**:
- Proper TypeScript interface definitions for props
- Functional component patterns vs class components
- Event handler typing (`React.MouseEvent`, `React.ChangeEvent`)
- Component composition and children props
- CSS Module integration
- React Testing Library patterns
- Accessibility best practices

**Common Pitfalls Addressed**:
- ❌ Forgetting to import React (old pattern)
- ❌ Using `any` type for props
- ❌ Inline function definitions in JSX
- ❌ Missing TypeScript types for event handlers
- ✅ Proper prop interface with required/optional distinction
- ✅ Extracting event handlers outside JSX
- ✅ Using React.FC vs inline typing

**Example Execution**:
```bash
minibob --single "Create a UserCard component that displays user information with avatar, name, email, and a follow button"
```

**Variables**:
- `componentName`: "UserCard"
- `componentDescription`: "Display user profile information"
- `includeStyles`: true
- `includeTests`: true

**Success Criteria**:
- TypeScript compiles without errors
- Tests pass
- Component follows naming conventions
- CSS Module properly scoped

### 2. react-app-scaffolding

**Purpose**: Teach MiniBob how to set up complete React applications with proper architecture.

**Location**: `repos/metabob-proto/activities/react/02-react-app-scaffolding.json`

**What MiniBob Learns**:
- Vite vs Next.js vs CRA trade-offs
- TypeScript configuration for React
- Path aliases (`@/components`, `@hooks/`, etc.)
- React Router v6 setup
- Project directory structure
- Global CSS with design tokens
- Build tool configuration

**Common Pitfalls Addressed**:
- ❌ Inconsistent directory structure
- ❌ Missing TypeScript strict mode
- ❌ No path aliases (relative import hell)
- ❌ Forgetting to configure routing
- ✅ Clear separation: components, pages, hooks, utils
- ✅ Strict TypeScript with helpful settings
- ✅ Clean imports via path aliases
- ✅ Routing with layout components

**Example Execution**:
```bash
minibob --single "Create a new React app called 'task-tracker' with routing and TypeScript"
```

**Variables**:
- `appName`: "task-tracker"
- `framework`: "vite"
- `includeRouting`: true
- `includeStateManagement`: true

**Success Criteria**:
- App runs without errors
- TypeScript strict mode enabled
- Routing functional with example pages
- Path aliases configured

### 3. react-ui-integration

**Purpose**: Teach MiniBob how to connect business logic to UI components through proper architecture.

**Location**: `repos/metabob-proto/activities/react/03-react-ui-integration.json`

**What MiniBob Learns**:
- Container/Presentational component pattern
- Custom React hooks for data fetching
- API integration patterns
- Error boundaries
- Loading states and error handling
- Type-safe API service layers
- Integration testing with mocked data

**Common Pitfalls Addressed**:
- ❌ Mixing logic and presentation in one component
- ❌ Fetching data directly in components
- ❌ Not handling loading/error states
- ❌ Missing error boundaries
- ✅ Separate container (logic) from view (UI)
- ✅ Extract data fetching to custom hooks
- ✅ Comprehensive state handling (loading, error, empty, success)
- ✅ Error boundaries wrapping features

**Example Execution**:
```bash
minibob --single "Integrate the UserProfile feature with the REST API endpoint /api/users/:id"
```

**Variables**:
- `featureName`: "UserProfile"
- `dataSource`: "api"
- `apiEndpoint`: "/api/users/:id"

**Success Criteria**:
- Custom hooks properly typed
- Container/View separation clear
- Error handling comprehensive
- Integration tests passing

### 4. react-styling

**Purpose**: Teach MiniBob how to style React components professionally.

**Location**: `repos/metabob-proto/activities/react/04-react-styling.json`

**What MiniBob Learns**:
- CSS Modules best practices
- Design tokens (CSS variables)
- Responsive design patterns
- Accessibility in styling
- Dark mode support
- Tailwind CSS utility-first approach
- Component variants via data attributes

**Common Pitfalls Addressed**:
- ❌ Hardcoded colors and spacing
- ❌ No responsive breakpoints
- ❌ Missing focus states
- ❌ Inline styles instead of modules
- ✅ CSS variables for all design tokens
- ✅ Mobile-first responsive design
- ✅ Accessible focus indicators
- ✅ Scoped CSS Modules

**Example Execution**:
```bash
minibob --single "Style the TaskCard component with CSS Modules, making it responsive and accessible"
```

**Variables**:
- `componentName`: "TaskCard"
- `stylingApproach`: "css-modules"
- `designSystem`: true

**Success Criteria**:
- CSS Module properly scoped
- Responsive across breakpoints
- Accessible (contrast, focus states)
- Uses design tokens

### 5. react-full-stack

**Purpose**: Teach MiniBob how to build complete, production-ready React applications.

**Location**: `repos/metabob-proto/activities/react/05-react-full-stack.json`

**What MiniBob Learns**:
- Application architecture planning
- Feature-driven development
- State management (Zustand + React Query)
- Authentication flows
- API service layers
- E2E testing with Playwright
- Deployment pipelines
- Comprehensive documentation

**Common Pitfalls Addressed**:
- ❌ No architectural planning
- ❌ Mixing concerns across layers
- ❌ Inadequate testing
- ❌ Missing deployment configuration
- ✅ Architecture-first approach
- ✅ Clear separation: services, hooks, components, pages
- ✅ Unit + Integration + E2E tests
- ✅ Production-ready deployment

**Example Execution**:
```bash
minibob --single "Build a complete task management app with auth, CRUD operations, and search"
```

**Variables**:
- `appName`: "task-manager"
- `features`: "auth,crud,search"
- `backendType`: "rest-api"
- `deployTarget`: "vercel"

**Success Criteria**:
- All tests passing
- TypeScript strict mode passing
- Production build successful
- Deployed and accessible

## How to Use These Activities

### Option 1: Manual Execution (Immediate Learning)

Execute activities directly with MiniBob:

```bash
# Basic component creation
minibob --single "Create a Button component with variants (primary, secondary, danger) and sizes (small, medium, large)"

# App scaffolding
minibob --single "Create a new React app called 'blog-platform' with routing and state management"

# Feature integration
minibob --single "Integrate the ArticleList feature with the /api/articles endpoint"

# Styling
minibob --single "Style the ArticleCard component with CSS Modules using the design system"

# Full application
minibob --single "Build a complete blog platform with authentication, article CRUD, and comments"
```

### Option 2: Programmatic Execution (Batch Learning)

Create a learning script to execute multiple variations:

```bash
# repos/minibob/scripts/learn-react.sh

#!/bin/bash

# Component creation variations
minibob --single "Create a Card component with header, body, and footer sections"
minibob --single "Create a Modal component with overlay and close button"
minibob --single "Create a Dropdown component with keyboard navigation"
minibob --single "Create a Form component with validation"

# Styling variations
minibob --single "Style the Card component with CSS Modules"
minibob --single "Style the Modal component with Tailwind CSS"

# Integration variations
minibob --single "Integrate UserProfile with REST API"
minibob --single "Integrate ProductList with GraphQL API"
minibob --single "Integrate Settings with localStorage"
```

### Option 3: Goal-Based Learning (Natural Language)

Let MiniBob decompose goals into activities:

```bash
minibob --single "I need to build a notes application where users can create, edit, and delete notes. Include authentication and make it look professional."
```

MiniBob will use the goal processor to:
1. Identify relevant activities (`react-full-stack`, `react-styling`, etc.)
2. Extract variables from the goal
3. Execute activities in the right order
4. Learn from successes and failures

## Validating MiniBob's Learning

### Metrics to Track

Monitor these metrics in the activity dashboard to see improvement:

1. **Success Rate** (target: >85%)
   - % of activity executions that pass all validation
   - Track per activity template

2. **Average Duration** (target: decreasing)
   - Time to complete each activity
   - Should decrease as patterns are learned

3. **Token Usage** (target: stable or decreasing)
   - Tokens consumed per execution
   - Efficient prompts use fewer tokens

4. **Variant Creation** (target: <10%)
   - How often MiniBob creates variants (trailblazing)
   - Lower rate = better learning

### Quality Gates

After each learning session, verify:

```bash
# Component creation quality
- [ ] TypeScript compiles without errors
- [ ] Tests pass
- [ ] No console.log statements
- [ ] Proper ARIA attributes
- [ ] CSS Module scoping works

# App scaffolding quality
- [ ] npm install succeeds
- [ ] Dev server starts
- [ ] TypeScript strict mode enabled
- [ ] Path aliases configured
- [ ] Routes functional

# Integration quality
- [ ] API calls properly typed
- [ ] Error boundaries present
- [ ] Loading states handled
- [ ] Integration tests pass

# Styling quality
- [ ] Responsive across breakpoints
- [ ] Accessible (contrast, focus)
- [ ] Uses design tokens
- [ ] No !important declarations

# Full-stack quality
- [ ] All tests passing (unit + integration + e2e)
- [ ] Production build successful
- [ ] Documentation complete
- [ ] Deployment configured
```

## Expected Learning Outcomes

### After 10 Executions (Component Creation)

MiniBob should consistently:
- Generate properly typed TypeScript interfaces
- Create functional components with correct patterns
- Include proper event handler typing
- Write basic tests with React Testing Library
- Apply CSS Modules correctly

### After 20 Executions (App Scaffolding + Integration)

MiniBob should consistently:
- Set up projects with correct configuration
- Implement proper routing patterns
- Create custom hooks for data fetching
- Separate container from presentational components
- Handle all UI states (loading, error, empty, success)

### After 50 Executions (Full Proficiency)

MiniBob should consistently:
- Design application architecture before coding
- Implement features with proper separation of concerns
- Write comprehensive tests (unit + integration + e2e)
- Style components accessibly and responsively
- Deploy applications successfully

## Common Learning Patterns

### Pattern 1: TypeScript Typing

**Initial attempts** (executions 1-5):
- Uses `any` frequently
- Forgets to type event handlers
- Missing interface exports

**After learning** (executions 10+):
- Properly typed props interfaces
- Correct event handler types (`React.MouseEvent<HTMLButtonElement>`)
- Exported types for consumers

### Pattern 2: Component Structure

**Initial attempts**:
- Mixes logic and presentation
- Inline function definitions
- No separation of concerns

**After learning**:
- Container/Presentational split
- Extracted event handlers
- Custom hooks for reusable logic

### Pattern 3: Error Handling

**Initial attempts**:
- No error boundaries
- Missing loading states
- Generic error messages

**After learning**:
- Error boundaries wrapping features
- Comprehensive state handling
- Specific, actionable error messages

### Pattern 4: Testing

**Initial attempts**:
- Tests implementation details
- No accessibility queries
- Missing edge cases

**After learning**:
- Tests user behavior
- Uses semantic queries (getByRole)
- Comprehensive coverage

## Troubleshooting Learning Issues

### Issue: Low Success Rate (<70%)

**Diagnosis**:
- Check validation criteria - too strict?
- Review failed executions for patterns
- Examine error messages

**Solutions**:
- Adjust validation patterns if overly strict
- Add more examples to prompts
- Create intermediate activities for complex patterns

### Issue: High Token Usage

**Diagnosis**:
- Prompts too verbose
- Unnecessary context loaded
- Repeated patterns not optimized

**Solutions**:
- Refactor prompts to be more concise
- Use impulse compression
- Extract common patterns to reusable templates

### Issue: Inconsistent Quality

**Diagnosis**:
- Validation not comprehensive
- Missing quality gates
- Template ambiguity

**Solutions**:
- Add more validation patterns
- Include typecheck/lint in validation
- Make prompts more explicit

## Advanced: Creating New React Activities

When MiniBob encounters new React patterns not covered by existing activities, create new templates:

### 1. Identify the Pattern

Example: "MiniBob struggles with React Hook Form integration"

### 2. Create Activity Template

Use the `create-activity` activity:

```bash
minibob --single "Create an activity template for integrating React Hook Form with Zod validation into React components"
```

### 3. Variables:
- `templateName`: "React Hook Form Integration"
- `templateDescription`: "Integrate React Hook Form with Zod schema validation"
- `category`: "feature"

### 4. Test & Iterate

Execute the new activity 3-5 times, observe:
- Success rate
- Common failures
- Quality of output

Refine the template based on observations.

### 5. Register with Backend

The activity will automatically register with the backend and become available for Thompson Sampling.

## Integration with CI/CD

### Automated Learning Loop

Set up a daily learning job:

```yaml
# .github/workflows/learn-react.yml
name: MiniBob React Learning

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  learn:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install MiniBob
        run: npm install -g minibob

      - name: Execute Learning Script
        run: ./scripts/learn-react.sh
        env:
          METABOB_API_KEY: ${{ secrets.METABOB_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Report Metrics
        run: |
          curl -X POST https://activity.metabob.com/v2/activities/metrics \
            -H "Authorization: ApiKey $METABOB_API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"source": "automated-learning", "date": "'$(date -I)'"}'
```

## Measuring ROI

Track these metrics to measure MiniBob's React development proficiency:

### Before Learning (Baseline)
- Manual component creation: 30-60 minutes
- Manual app setup: 2-4 hours
- Feature integration: 1-3 hours
- Full application: 1-2 weeks

### After Learning (Target)
- Automated component creation: 5-10 minutes
- Automated app setup: 15-30 minutes
- Automated feature integration: 20-40 minutes
- Automated full application: 2-4 hours

### Success Metrics
- **Time Savings**: 70-90% reduction in development time
- **Quality Improvement**: Fewer bugs, better test coverage
- **Consistency**: Standardized patterns across codebase
- **Knowledge Retention**: Patterns persist across sessions

## Next Steps

1. **Start with Component Creation**: Execute 5-10 times to establish baseline
2. **Monitor Dashboard**: Watch success rates and duration trends
3. **Progress to Integration**: Once component success >80%, move to integration
4. **Iterate on Templates**: Refine based on execution traces
5. **Create Custom Activities**: For project-specific patterns
6. **Automate Learning**: Set up CI/CD learning loops
7. **Measure Impact**: Track time savings and quality improvements

## Resources

- **Activity Templates**: `repos/metabob-proto/activities/react/`
- **Dashboard**: `https://internal.metabob.com` (when deployed)
- **Execution Traces**: Stored in backend, viewable in dashboard
- **Thompson Sampling**: Automatic variant selection based on success rates

## Contributing

When you discover patterns that MiniBob should learn:

1. Document the pattern in this file
2. Create an activity template (or enhance existing one)
3. Test with 3-5 executions
4. Submit PR with template + documentation
5. Monitor learning metrics after merge

## Questions?

See `repos/minibob/CLAUDE.md` for MiniBob-specific guidance or `CLAUDE.md` in the root for overall development philosophy.
