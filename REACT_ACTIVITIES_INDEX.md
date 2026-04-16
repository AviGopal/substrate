# React Activities - Complete File Index

## Summary

Created a comprehensive React learning curriculum for MiniBob consisting of:
- 5 Activity Templates (28 total tasks)
- 2 Documentation Files
- 2 Automation Scripts

## File Locations

### Activity Templates
**Directory**: `repos/metabob-proto/activities/react/`

| File | Size | Tasks | Category | Difficulty |
|------|------|-------|----------|------------|
| 01-react-component-creation.json | 20KB | 6 | feature | Beginner |
| 02-react-app-scaffolding.json | 20KB | 5 | infrastructure | Intermediate |
| 03-react-ui-integration.json | 24KB | 5 | feature | Intermediate |
| 04-react-styling.json | 17KB | 5 | feature | Beginner |
| 05-react-full-stack.json | 28KB | 7 | feature | Advanced |

**Total**: 109KB, 28 tasks across 5 templates

### Documentation
**Directory**: Root and `repos/metabob-proto/activities/react/`

| File | Size | Purpose |
|------|------|---------|
| TEACHING_MINIBOB_REACT.md | 18KB | Master documentation, learning progression, validation |
| repos/metabob-proto/activities/react/README.md | 6.4KB | Quick reference, usage examples |
| REACT_ACTIVITIES_SUMMARY.md | 10KB | Implementation summary, metrics, outcomes |
| REACT_ACTIVITIES_INDEX.md | 2KB | This file - complete file listing |

**Total**: 36.4KB, 4 documentation files

### Automation Scripts
**Directory**: `scripts/`

| File | Purpose |
|------|---------|
| test-react-activities.sh | Test all activities once to verify correctness |
| learn-react.sh | Execute multiple variations for training MiniBob |

**Total**: 2 executable scripts

## Quick Access

### To Use Activities

```bash
# Component creation
minibob --single "Create a Button component with variants"

# App setup
minibob --single "Create a new React app called 'my-app'"

# Feature integration
minibob --single "Integrate UserProfile with /api/users endpoint"

# Styling
minibob --single "Style the Card component with CSS Modules"

# Full application
minibob --single "Build a task manager with auth and CRUD"
```

### To Test Activities

```bash
# Validate all templates
cd scripts
./test-react-activities.sh

# Review output
ls -la /tmp/react-activities-test/
```

### To Train MiniBob

```bash
# All activities
cd scripts
./learn-react.sh

# Specific category
./learn-react.sh --components
./learn-react.sh --integration
./learn-react.sh --apps
```

### To Monitor Learning

```bash
# View dashboard
open https://internal.metabob.com

# Check recent executions
minibob --single "Show me React activity metrics from the last week"
```

## Activity Details

### 1. react-component-creation (Beginner)
**What it teaches**: Component structure, TypeScript, testing, CSS Modules

**Tasks**:
1. Analyze component requirements
2. Create component file with TypeScript
3. Create CSS Module styles
4. Create barrel export (index.ts)
5. Create component tests
6. Create usage documentation

**Example**: "Create a UserCard component"

### 2. react-app-scaffolding (Intermediate)
**What it teaches**: Project setup, configuration, routing, architecture

**Tasks**:
1. Initialize project with build tool
2. Configure TypeScript with strict mode
3. Set up React Router with example routes
4. Create global styles with design tokens
5. Create development documentation

**Example**: "Create a blog-platform app with Vite"

### 3. react-ui-integration (Intermediate)
**What it teaches**: Custom hooks, state management, API integration, error handling

**Tasks**:
1. Create custom hooks for data fetching
2. Create TypeScript type definitions
3. Integrate hooks with components (Container/View)
4. Add error handling (boundaries, loading, errors)
5. Create integration tests

**Example**: "Integrate ArticleList with /api/articles"

### 4. react-styling (Beginner)
**What it teaches**: CSS architecture, responsive design, accessibility, design tokens

**Tasks**:
1. Analyze component styling needs
2. Create CSS Module stylesheet
3. Create Tailwind classes (if applicable)
4. Update component with styles
5. Create styling documentation

**Example**: "Style the ArticleCard with CSS Modules"

### 5. react-full-stack (Advanced)
**What it teaches**: Architecture, features, auth, testing, deployment

**Tasks**:
1. Plan application architecture
2. Scaffold application with dependencies
3. Implement features (CRUD, auth, etc.)
4. Add authentication (if required)
5. Set up comprehensive testing
6. Configure deployment pipeline
7. Create complete documentation

**Example**: "Build a task manager with auth and CRUD"

## Learning Progression

```
Week 1: Component Creation
  ├─ Execute 5-10 times
  ├─ Focus: TypeScript, structure, testing
  └─ Target: >80% success rate

Week 2: App Scaffolding
  ├─ Execute 3-5 times
  ├─ Focus: Configuration, routing
  └─ Target: >85% success rate

Week 3: UI Integration
  ├─ Execute 5-7 times
  ├─ Focus: Hooks, state, API
  └─ Target: >85% success rate

Week 4: Styling
  ├─ Execute 5-7 times
  ├─ Focus: CSS, responsive, a11y
  └─ Target: >90% success rate

Week 5+: Full-Stack
  ├─ Execute 2-3 times
  ├─ Focus: End-to-end development
  └─ Target: >80% success rate
```

## Validation

All templates validated:
```
✓ 01-react-component-creation.json - Valid JSON, 6 tasks
✓ 02-react-app-scaffolding.json    - Valid JSON, 5 tasks
✓ 03-react-ui-integration.json     - Valid JSON, 5 tasks
✓ 04-react-styling.json            - Valid JSON, 5 tasks
✓ 05-react-full-stack.json         - Valid JSON, 7 tasks
```

## Related Documentation

- **Foundation**: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
- **MiniBob Guide**: `repos/minibob/CLAUDE.md`
- **Activity Creation**: `repos/metabob-proto/activities/bootstrap/create-activity-self-contained.json`
- **Main CLAUDE.md**: Root development guide

## Next Steps

1. **Test**: Run `scripts/test-react-activities.sh`
2. **Learn**: Run `scripts/learn-react.sh` daily/weekly
3. **Monitor**: Check dashboard at `https://internal.metabob.com`
4. **Refine**: Update templates based on trace analysis
5. **Expand**: Create project-specific variants
6. **Share**: Document learnings for team

## Contributing

To add new patterns or improve existing activities:

1. Fork and create feature branch
2. Add/modify activity templates
3. Test with `test-react-activities.sh`
4. Update documentation
5. Submit PR with test results

## Support

For questions or issues:
- Check `TEACHING_MINIBOB_REACT.md` for detailed guidance
- Review execution traces in dashboard
- Analyze Thompson Sampling metrics
- Consult `CLAUDE.md` for development philosophy
