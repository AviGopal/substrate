## 1. Audit and confirm existing stopping conditions

- [x] 1.1 Confirm `--budget` and `--max-activities` flags exist in `repos/minibob/index.ts` and are wired to goal-processor (they exist per codebase check; verify defaults are sane for demo: budget=5.0, max-activities=5)
- [x] 1.2 Confirm goal-satisfaction early-exit is active in single mode (`goal-processor.ts:4543-4556`); no code change needed unless check is bypassed
- [x] 1.3 Update `specs/minibob-single-stopping/spec.md` to note that `--max-sequences` is actually `--max-activities` in the implementation (flag name alignment)

## 2. Create sub-activity: define-specification

- [x] 2.1 Create `repos/minibob/src/embedded-templates/define-specification.json` — LLM task that accepts goal text and optional codebase_structure impulse; produces a `specification` impulse written to `spec.md` in the working directory; includes testable success criteria section
- [x] 2.2 Verify the template has `input_shapes: ["goal", "codebase_structure"]` and `output_shapes: ["specification"]`

## 3. Create sub-activity: spec-to-enforcement-activity

- [x] 3.1 Create `repos/minibob/src/embedded-templates/spec-to-enforcement-activity.json` — LLM task that reads `spec.md`, produces an activity template JSON file (`enforcement-activity.json` in workdir); template must declare `output_shapes: ["validation_result"]`
- [x] 3.2 Verify the produced template file is valid JSON matching the MiniBob activity template schema (has `id`, `name`, `category`, `tasks`, `input_shapes`, `output_shapes`)

## 4. Create sub-activity: enforcement-to-validation-activity

- [x] 4.1 Create `repos/minibob/src/embedded-templates/enforcement-to-validation-activity.json` — LLM task that reads `enforcement-activity.json` and produces `validation-activity.json`; validation variant must be read-only (no write/edit/bash-with-side-effects tasks)
- [x] 4.2 Verify validation variant prompt instructs LLM to only read, compare, and report; include `forbiddenPatterns` checking for write/delete operations in the template's tasks

## 5. Create sub-activity: map-components-to-validations

- [x] 5.1 Create `repos/minibob/src/embedded-templates/map-components-to-validations.json` — bash + LLM tasks: first task enumerates relevant files via `find`/`ls`; second task maps each file to the validation activity; produces `validation-mapping.json` in workdir
- [x] 5.2 Verify `validation-mapping.json` schema: `{ mapped: [{file, validationActivityId, specSection}], unmapped: [file] }`

## 6. Create sub-activity: update-specs-from-validation

- [x] 6.1 Create `repos/minibob/src/embedded-templates/update-specs-from-validation.json` — LLM task that reads `validation-results.json` + `spec.md`; if any results have `passed: false`, refines the relevant spec section; writes updated `spec.md` back
- [x] 6.2 Verify template has a no-op path: when all validation results pass, the task confirms spec is current without modification

## 7. Create sub-activity: synchronize-spec-validation

- [x] 7.1 Create `repos/minibob/src/embedded-templates/synchronize-spec-validation.json` — LLM + bash tasks: reads `spec.md` + `validation-mapping.json` + latest `validation-results.json`; produces `sync-report.json` with `{ converged: boolean, divergences: [...], stopped_reason?: string }`
- [x] 7.2 Verify convergence logic: `converged: true` only when all mapped components pass and `unmapped` list is empty

## 8. Create meta-activity: spec-validation-loop

- [x] 8.1 Create `repos/minibob/src/embedded-templates/spec-validation-loop.json` — meta-activity using `activity` resolver to chain: define-specification → spec-to-enforcement-activity → enforcement-to-validation-activity → map-components-to-validations → run validation activities → update-specs-from-validation → synchronize-spec-validation; loop back from synchronize to map-components when `converged: false` and budget/sequences not exhausted
- [x] 8.2 Add a bash task at the loop check point that reads `sync-report.json` and exits the loop when `converged: true` or `stopped_reason` is set
- [x] 8.3 Verify the meta-activity passes `--max-activities` and `--budget` context through to each dispatched sub-activity

## 9. Demonstration: cellular automata web app

- [x] 9.1 Create `/tmp/cellautomata-demo/` directory (fresh, empty)
- [x] 9.2 Run `minibob --single "Create a working cellular automata web app with a canvas that starts automatically, has controls for play/pause and step, and is served as a standalone index.html file" --workdir /tmp/cellautomata-demo --budget 2.00 --max-activities 15`
- [x] 9.3 Verify `/tmp/cellautomata-demo/index.html` exists after the run
- [x] 9.4 Use playwright_mcp to navigate to `file:///tmp/cellautomata-demo/index.html`
- [x] 9.5 Use playwright_mcp to take a screenshot and confirm: canvas element renders, cells are visible, simulation is running or can be started
- [x] 9.6 Use playwright_mcp to click the play/pause control and confirm the simulation responds

## 10. Validation of the loop itself

- [x] 10.1 Run `minibob --template spec-validation-loop --var goal="Conway's Game of Life cellular automata web app" --var workdir="/tmp/cellautomata-demo" --budget 2.00`
- [x] 10.2 Verify `spec.md` was created in `/tmp/cellautomata-demo/`
- [x] 10.3 Verify `enforcement-activity.json` was created
- [x] 10.4 Verify `validation-activity.json` was created
- [x] 10.5 Verify `validation-mapping.json` was created
- [ ] 10.6 Verify `sync-report.json` shows `converged: true` (first run showed converged:false due to {{workdir}} substitution bug; fixed in spec-validation-loop.json v0.2.1; re-running)

## 11. Fix {{workdir}} substitution and confirm convergence

- [x] 11.1 Fix `spec-validation-loop.json` step5 Python: use `'{' + '{workdir}' + '}'` as placeholder to avoid minibob's own interpolation from corrupting the replace() call
- [x] 11.2 Fix tags in all 7 templates: change hyphens to dots to match backend tag validation regex (`spec.validation.loop`, `readonly`)
- [ ] 11.3 Re-run from scratch: verify `converged: true` in sync-report.json
- [ ] 11.4 Validate via playwright: confirm app still renders correctly at http://localhost:7777/
- [ ] 11.5 Commit all template changes and tasks.md
