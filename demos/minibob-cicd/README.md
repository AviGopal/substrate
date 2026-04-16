# MiniBob CI/CD Demo

**Complete demonstration of MiniBob's learning capabilities and activity-driven development.**

## What's This?

This demo showcases **two powerful MiniBob concepts**:

### 1. Three Learning Loops 🔄

MiniBob learns from every CI/CD interaction through three interconnected feedback loops:

- **Loop 1 (Impulse Flow)**: Context management with lazy loading and relevance learning
- **Loop 2 (External Validation)**: Outcome validation and Thompson Sampling
- **Loop 3 (Discovery)**: Environment scanning and discovery effectiveness

👉 **[See Learning Loops Demo](LEARNING_LOOPS_DEMO.md)**

### 2. Activity-Driven Development 🚀

Manage an entire web application lifecycle through MiniBob activities only:

- Create GitHub issues (activity)
- Create branches (activity)
- Implement features (activity)
- Create PRs (activity)
- Auto-fix CI (activity)
- Merge PRs (activity)
- Deploy (workflow)
- Monitor (activity)

👉 **[See Activity-Driven Development](ACTIVITY_DRIVEN_DEVELOPMENT.md)**

## Quick Start

### Option 1: Learning Loops Demo (Existing Codebase)

Demonstrates how MiniBob learns to fix bugs faster and cheaper over time.

```bash
cd demos/minibob-cicd

# Export API keys
export ANTHROPIC_API_KEY="sk-ant-..."
export METABOB_API_KEY="your-key"

# Run scenario 1: First bug fix (cold start)
./scripts/run-scenario-1-cold-start.sh

# View learning metrics
./scripts/show-learning-metrics.sh
```

**See**: [LEARNING_LOOPS_DEMO.md](LEARNING_LOOPS_DEMO.md) and [SETUP.md](SETUP.md)

### Option 2: Activity-Driven Development (GitHub Pages App)

Demonstrates complete development lifecycle managed by activities.

```bash
cd demos/minibob-cicd

# Export API keys
export ANTHROPIC_API_KEY="sk-ant-..."
export METABOB_API_KEY="your-key"
export GITHUB_TOKEN="ghp_..."  # or use: gh auth login

# Run complete development workflow
./scripts/orchestrate-development.sh "Add dark mode toggle"
```

**See**: [ACTIVITY_DRIVEN_QUICKSTART.md](ACTIVITY_DRIVEN_QUICKSTART.md)

## What's Included

### Web Application

**Task Manager** - Simple, responsive web app:
- Frontend: HTML/CSS/JavaScript (vanilla)
- Backend: GitHub Issues API
- Deployment: GitHub Pages
- Source: `public/`

### Activities (36 total)

**GitHub Management** (3):
- `create-issue-from-bug.json` - Create issues from bugs
- `create-pr-from-branch.json` - Create PRs with auto-generated descriptions
- `merge-pr.json` - Merge PRs after validation

**Discovery** (3):
- `scan-file-system.json` - Discover source files
- `scan-git-history.json` - Discover recent commits
- `scan-execution-traces.json` - Find similar past fixes

**Learning** (4):
- `fix-test-failure.json` - Fix test failures with learning
- `fix-test-failure-with-discovery.json` - Full three-loops demo
- `fix-type-error.json` - Fix TypeScript errors
- `fix-lint-error.json` - Fix lint errors

**Deterministic** (3):
- `run-test-suite.json` - Run tests
- `run-typecheck.json` - Type checking
- `run-lint.json` - Linting

**Upkeep** (4):
- `sync-readme.json` - Update README
- `sync-changelog.json` - Update changelog
- `create-issue-from-failure.json` - Create issue from CI failure
- `create-pr-for-fix.json` - Create PR from fix

### GitHub Actions Workflows

- `ci.yml` - PR validation with auto-remediation
- `ci-with-pr.yml` - PR creation workflow
- `deploy-pages.yml` - Deploy to GitHub Pages
- `monitoring.yml` - Scheduled performance monitoring (planned)

### Documentation

- **[LEARNING_LOOPS_DEMO.md](LEARNING_LOOPS_DEMO.md)** - Three learning loops demonstration
- **[ACTIVITY_DRIVEN_DEVELOPMENT.md](ACTIVITY_DRIVEN_DEVELOPMENT.md)** - Full lifecycle management
- **[ACTIVITY_DRIVEN_QUICKSTART.md](ACTIVITY_DRIVEN_QUICKSTART.md)** - Quick start guide
- **[SETUP.md](SETUP.md)** - Detailed setup instructions
- **[THREE_LOOPS_STATUS.md](THREE_LOOPS_STATUS.md)** - Implementation tracking

### Scripts

- `run-scenario-1-cold-start.sh` - First bug fix demo
- `show-learning-metrics.sh` - Learning metrics dashboard
- `orchestrate-development.sh` - Complete workflow automation
- `introduce-bug.sh` - Bug introduction for testing
- `reset.sh` - Reset to clean state

## Architecture Highlights

### Learning System

**Thompson Sampling**:
- Activities tracked with α (successes) and β (failures)
- Better activities automatically selected more often
- Weighted penalties for different error types

**Impulse Relevance**:
- Tracks P(used | loaded) for each data shape
- High-relevance data gets higher budgets
- Low-relevance data eventually skipped

**Discovery Effectiveness**:
- Each discovery activity has α/β parameters
- Useful discoveries → α increases
- Useless discoveries → β increases
- Auto-skip low α/β ratio discoveries

### Activity Composition

Activities chain together:
```
Issue → Branch → Development → PR → CI/CD → Merge → Deploy
   ↓        ↓           ↓        ↓      ↓       ↓        ↓
activity activity   activity activity activity activity workflow
```

All activities record traces → learning backend → improved selection

## Use Cases

### 1. Demonstrate Learning

Show investors/stakeholders how MiniBob learns from CI/CD:

```bash
# Run 10 iterations
for i in {1..10}; do
  ./scripts/run-scenario-1-cold-start.sh
  sleep 60
done

# Show improvement
./scripts/show-learning-metrics.sh
```

**Expected**: 40% faster, 60% cheaper after 10 runs

### 2. Dogfood Development

Use MiniBob to develop MiniBob:

```bash
# Create issue for new feature
bunx @metabob/minibob@latest \
  --template activities/github/create-issue-from-bug.json \
  --var "bugDescription=Add variant creation to ribosome" \
  --trace

# Complete workflow automatically
./scripts/orchestrate-development.sh "Implement variant creation"
```

### 3. CI/CD Integration

Add to any project's GitHub Actions:

```yaml
- name: Auto-Fix CI Failures
  if: failure()
  run: |
    bunx @metabob/minibob@latest \
      --template activities/cicd/auto-fix-ci-failure.json \
      --var "prNumber=${{ github.event.pull_request.number }}" \
      --trace
```

### 4. Continuous Monitoring

Schedule performance checks:

```yaml
on:
  schedule:
    - cron: '0 * * * *'  # Every hour

jobs:
  monitor:
    steps:
      - name: Check Performance
        run: |
          bunx @metabob/minibob@latest \
            --template activities/monitoring/check-performance.json \
            --trace
```

## Key Metrics

After 10 executions of fix-test-failure:

**Thompson Sampling**:
```
fix-test-failure: α=8, β=2 (80% success)
scan-file-system: α=10, β=0 (always useful)
scan-git-history: α=2, β=8 (auto-skipped)
```

**Impulse Relevance**:
```
error_log:       0.95 (always needed)
execution_trace: 0.85 (very useful)
source_code:     0.75 (often useful)
test_file:       0.45 (sometimes useful)
```

**Performance**:
```
Execution 1:  60s, $0.12
Execution 10: 35s, $0.05
Improvement:  42% faster, 58% cheaper
```

## Implementation Status

**Loop 1 (Impulse Flow)**: 75% complete
- ✅ Lazy loading, budget enforcement
- ✅ Task chaining
- ⚠️ Usage tracking (partial)
- ❌ Automatic relevance updates

**Loop 2 (External Validation)**: 70% complete
- ✅ Internal + external validation
- ✅ Manual feedback endpoint exists!
- ⚠️ Auto-feedback (needs integration)
- ❌ Variant creation

**Loop 3 (Discovery)**: 40% implemented
- ✅ Activities designed and created
- ✅ Shape inference exists
- ❌ Automatic triggering
- ❌ Thompson Sampling integration

**See**: [THREE_LOOPS_STATUS.md](THREE_LOOPS_STATUS.md) for details

## Requirements

- **Bun**: Latest version
- **GitHub CLI**: For GitHub operations
- **API Keys**:
  - Anthropic API key (for LLM)
  - Metabob API key (for learning backend)
  - GitHub token (for API access)

## Getting Help

- **Setup issues**: See [SETUP.md](SETUP.md)
- **Activity usage**: See [ACTIVITY_DRIVEN_QUICKSTART.md](ACTIVITY_DRIVEN_QUICKSTART.md)
- **Learning loops**: See [LEARNING_LOOPS_DEMO.md](LEARNING_LOOPS_DEMO.md)
- **Implementation status**: See [THREE_LOOPS_STATUS.md](THREE_LOOPS_STATUS.md)

## Contributing

Want to add activities or improve the demo?

1. Create activity in `activities/` directory
2. Follow existing activity structure
3. Add to appropriate category (github, cicd, discovery, etc.)
4. Document in this README
5. Test with `--dry-run` flag

## License

MIT - See repository root for license details

---

**Built with**: Bun, GitHub Pages, GitHub Actions, MiniBob Activities

**Learn more**: https://docs.metabob.com/minibob

**Sources**:
- [GitHub Pages Documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Deploy to GitHub Pages (2026)](https://docs.bswen.com/blog/2026-03-26-how-to-deploy-static-site-github-pages/)
- [GitHub Actions for Pages](https://github.com/peaceiris/actions-gh-pages)
- [Using Custom Workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
