# Contributing to MiniBob CICD

Thank you for your interest in contributing to MiniBob CICD! This document provides guidelines and instructions for contributing to this demonstration project.

---

## Table of Contents

- [Development Philosophy](#development-philosophy)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [MiniBob Integration](#minibob-integration)

---

## Development Philosophy

### MiniBob-First Development

**All development in this repository SHOULD be performed by MiniBob** to demonstrate autonomous CI/CD capabilities.

**Humans should:**
- Write goals and requirements
- Review and approve changes
- Provide feedback (/cheer, /chide)
- Monitor metrics and health

**MiniBob should:**
- Implement features
- Fix bugs
- Update documentation
- Create tests
- Maintain code quality

### The Process-of-Becoming

This project demonstrates continuous transformation:
- **Vessel** (instructional state): Activity templates and specifications
- **Process** (transient state): MiniBob executing activities
- **Instance** (functional state): Completed work and artifacts

The goal is continuous improvement, not perfection.

---

## Getting Started

### Prerequisites

```bash
# Required
- Bun 1.3.11 or later
- Node.js 20+ (for compatibility)
- Git

# Optional
- GitHub CLI (gh)
- MiniBob CLI (@metabob/minibob)
```

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/MetabobProject/demo-minibob-cicd.git
cd demo-minibob-cicd

# Install dependencies
bun install

# Verify setup
bun run lint
bun run typecheck
bun test
```

### Configuration

**For MiniBob:**
Create `~/.metabob/config.json`:
```json
{
  "metabob": {
    "apiKey": "your-api-key",
    "endpoint": "https://activity.metabob.com"
  },
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." }
  }
}
```

---

## Development Workflow

### 1. Create an Issue

```bash
# Create issue describing what needs to be done
gh issue create --title "Add feature X" --body "Description..."
```

### 2. Label for MiniBob

```bash
# Add 'minibob' label to trigger autonomous work
gh issue edit <issue-number> --add-label "minibob"
```

### 3. MiniBob Processes

MiniBob will:
1. Read the issue
2. Plan the implementation
3. Create a branch
4. Implement changes
5. Run tests
6. Create a PR
7. Request review

### 4. Human Review

Review the PR:
```bash
# View the PR
gh pr view <pr-number>

# Check CI status
gh pr checks <pr-number>

# Review changes
gh pr diff <pr-number>

# Approve if good
gh pr review <pr-number> --approve

# Or request changes
gh pr review <pr-number> --request-changes --body "Please fix X"
```

### 5. Merge

```bash
# MiniBob will auto-merge after approval
# Or manually merge
gh pr merge <pr-number> --squash
```

---

## Coding Standards

### TypeScript

**Style:**
- Use ESLint configuration (enforced)
- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- No unused variables

**Types:**
- Explicit return types for functions
- No `any` types (use `unknown` if needed)
- Interface for object shapes
- Type for unions and primitives

**Example:**
```typescript
// Good
export function calculateSum(a: number, b: number): number {
  return a + b;
}

// Bad
export function calculateSum(a, b) {
  return a + b;
}
```

### File Organization

```
demos/minibob-cicd/
├── src/                    # Source code
│   ├── calculator.ts       # Core functionality
│   └── ...
├── tests/                  # Test files
│   ├── calculator.test.ts  # Unit tests
│   └── ...
├── activities/             # MiniBob activities
│   ├── autonomous-loop/    # Meta-activities
│   ├── primitives/         # Base activities
│   └── ...
├── .github/workflows/      # CI/CD workflows
└── docs/                   # Documentation
```

### Naming Conventions

- **Files**: kebab-case (e.g., `calculator.ts`)
- **Functions**: camelCase (e.g., `calculateSum`)
- **Classes**: PascalCase (e.g., `CalculatorService`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_VALUE`)
- **Interfaces**: PascalCase with `I` prefix optional (e.g., `ICalculator` or `Calculator`)

---

## Testing Requirements

### Test Coverage

- All public functions must have tests
- Critical paths must have integration tests
- Edge cases and error handling must be tested

### Running Tests

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test file
bun test calculator.test.ts

# Watch mode
bun test --watch
```

### Writing Tests

**Structure:**
```typescript
import { describe, test, expect } from 'bun:test';
import { calculateSum } from '../src/calculator';

describe('Calculator', () => {
  describe('calculateSum', () => {
    test('should add two positive numbers', () => {
      const result = calculateSum(2, 3);
      expect(result).toBe(5);
    });

    test('should handle negative numbers', () => {
      const result = calculateSum(-2, 3);
      expect(result).toBe(1);
    });

    test('should handle zero', () => {
      const result = calculateSum(0, 5);
      expect(result).toBe(5);
    });
  });
});
```

**Test Requirements:**
- Descriptive test names
- One assertion per test (prefer)
- Test edge cases
- Test error conditions
- Fast execution (< 100ms per test)

---

## Pull Request Process

### PR Creation

**Title Format:**
```
<type>(<scope>): <subject>

Examples:
- feat(calculator): add division operation
- fix(ci): resolve timeout issues
- docs(readme): update installation instructions
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code change that neither fixes nor adds
- `test`: Adding tests
- `chore`: Maintenance tasks

### PR Description Template

```markdown
## Summary
Brief description of changes

## Motivation
Why this change is needed

## Changes
- Change 1
- Change 2

## Testing
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No breaking changes (or documented)

## Screenshots/Traces
(If applicable)
```

### PR Review Checklist

**Code Quality:**
- [ ] Follows coding standards
- [ ] No linting errors
- [ ] No type errors
- [ ] Tests included and passing

**Functionality:**
- [ ] Solves the stated problem
- [ ] No regressions introduced
- [ ] Edge cases handled

**Documentation:**
- [ ] Code is self-documenting
- [ ] Complex logic has comments
- [ ] README updated if needed
- [ ] CHANGELOG updated

**CI/CD:**
- [ ] All workflows passing
- [ ] No timeout issues
- [ ] Proper error handling

---

## MiniBob Integration

### Using MiniBob for Development

**Create a feature:**
```bash
minibob --single "Add feature: user authentication with JWT"
```

**Fix a bug:**
```bash
minibob --single "Fix bug: calculator division by zero error"
```

**Refactor code:**
```bash
minibob --single "Refactor: extract calculator operations into separate functions"
```

### MiniBob Activities

Activities are reusable templates for common tasks:

**Using an activity:**
```bash
minibob --template fix-bug-complete --var "bugDescription=Division by zero"
```

**Creating a new activity:**
```json
{
  "id": "my-activity",
  "name": "My Custom Activity",
  "category": "feature",
  "tasks": [
    {
      "id": "task-1",
      "description": "Do something",
      "prompt": {
        "template": "Perform {{action}} on {{target}}",
        "variables": [
          {"name": "action", "type": "string"},
          {"name": "target", "type": "string"}
        ]
      }
    }
  ]
}
```

**Registering an activity:**
```bash
minibob doctor tutor activities/my-activity.json
```

### Providing Feedback

**Positive feedback:**
```bash
minibob
# After successful work
/cheer! Great fix, tests all pass
```

**Constructive feedback:**
```bash
minibob
# After problematic work
/chide The solution works but broke backward compatibility
```

This feedback updates Thompson Sampling scores for better future recommendations.

---

## Quality Gates

### Pre-commit

Automatic checks before commit:
- Linting
- Type checking
- Tests
- File organization

### CI/CD

Automatic checks on push:
- All pre-commit checks
- Integration tests
- Build verification
- Security scan

### Pre-merge

Required before merging:
- All CI checks passing
- Code review approval
- No merge conflicts
- Documentation updated

---

## Getting Help

- **Issues**: Create an issue for bugs or questions
- **Discussions**: Use GitHub Discussions for general questions
- **Documentation**: Check existing docs in `/docs`
- **Examples**: Look at closed PRs for examples

---

## Code of Conduct

### Principles

1. **Be respectful** - Treat everyone with respect
2. **Be collaborative** - Work together, help others
3. **Be patient** - Remember we're all learning
4. **Be inclusive** - Welcome diverse perspectives
5. **Be constructive** - Focus on solutions, not blame

### MiniBob Development Policy

- MiniBob is autonomous - let it work
- Human intervention should be minimal
- Trust the process-of-becoming
- Focus on goals, not micromanagement
- Learn from traces and metrics

---

## License

This project is part of the MetabobProject and follows its licensing terms.

---

**Questions?** Open an issue or discussion!

**Ready to contribute?** Create an issue and label it `minibob`!
