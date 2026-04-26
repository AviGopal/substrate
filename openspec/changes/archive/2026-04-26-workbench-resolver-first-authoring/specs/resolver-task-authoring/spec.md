## MODIFIED Requirements

### Requirement: LLM resolver shows prompt field; non-LLM resolver shows config field
When resolver is `llm`, the task row SHALL show a prompt textarea (optional, for the LLM hint/template). When resolver is anything other than `llm`, the task row SHALL show a `ConfigEditor` component for resolver configuration instead of a raw JSON textarea. The `ConfigEditor` renders structured fields for `bash`, `file`, and `git`; it falls back to a raw JSON textarea for other resolvers.

#### Scenario: Prompt field shown for llm resolver
- **WHEN** the resolver dropdown is set to `llm`
- **THEN** a prompt textarea is visible and no `ConfigEditor` is rendered

#### Scenario: Structured config shown for bash resolver
- **WHEN** the resolver dropdown is set to `bash`
- **THEN** `ConfigEditor` is rendered with `command` and `timeout` fields visible and the prompt textarea is hidden

#### Scenario: Structured config shown for file resolver
- **WHEN** the resolver dropdown is set to `file`
- **THEN** `ConfigEditor` is rendered with `path`, `operation`, and (conditionally) `content` fields and the prompt textarea is hidden

#### Scenario: Structured config shown for git resolver
- **WHEN** the resolver dropdown is set to `git`
- **THEN** `ConfigEditor` is rendered with an `operation` picker and the prompt textarea is hidden

#### Scenario: Raw JSON fallback for unstructured resolvers
- **WHEN** the resolver dropdown is set to `human`
- **THEN** `ConfigEditor` is rendered showing the raw JSON textarea fallback

#### Scenario: Switching resolver toggles displayed fields
- **WHEN** the resolver is changed from `llm` to `git`
- **THEN** the prompt textarea disappears and `ConfigEditor` appears, and vice versa when switching back
