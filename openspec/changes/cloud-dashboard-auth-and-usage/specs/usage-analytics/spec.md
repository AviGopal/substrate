## ADDED Requirements

### Requirement: Usage dashboard displays token consumption over time
The system SHALL provide a Usage Analytics page showing token consumption trends.

#### Scenario: View daily token usage chart
- **WHEN** user navigates to Usage Analytics page
- **THEN** system displays line/bar chart of token consumption by day
- **THEN** system fetches data from GET /v2/costs endpoint (user-vessel)
- **THEN** system shows last 30 days by default

#### Scenario: Change time range
- **WHEN** user selects "Last 7 days" filter
- **THEN** system updates chart to show 7 days of data
- **THEN** system re-fetches data with days=7 query parameter

#### Scenario: No usage data
- **WHEN** organization has no execution traces yet
- **THEN** system shows "No usage data yet" message
- **THEN** system displays empty chart with helpful prompt

### Requirement: Cost tracking displays LLM costs
The system SHALL show total costs and breakdown by model/provider.

#### Scenario: Display total cost
- **WHEN** viewing Usage Analytics page
- **THEN** system shows total cost in USD for current billing period
- **THEN** system fetches from GET /v2/activities/metrics/summary (activity-api)
- **THEN** system displays cost with 2 decimal precision ($12.45)

#### Scenario: Cost breakdown by model
- **WHEN** user views cost details
- **THEN** system shows costs grouped by LLM model (claude-sonnet-4, opus-4.5, etc.)
- **THEN** system shows token count and average cost per 1M tokens for each model

#### Scenario: Zero cost
- **WHEN** organization has no billable usage
- **THEN** system shows $0.00 cost
- **THEN** system does NOT show cost breakdown

### Requirement: Usage breakdown by member
The system SHALL show token consumption and costs per member.

#### Scenario: View member usage table
- **WHEN** user scrolls to "Usage by Member" section
- **THEN** system displays table with columns: Member, Executions, Tokens, Cost
- **THEN** system joins execution traces with user_id to aggregate per member
- **THEN** system sorts by total tokens descending (highest usage first)

#### Scenario: Member with no usage
- **WHEN** member has not triggered any executions
- **THEN** system shows member in table with 0 executions, 0 tokens, $0.00 cost
- **THEN** system does NOT hide inactive members

### Requirement: Usage breakdown by API key
The system SHALL show token consumption and costs per API key.

#### Scenario: View API key usage table
- **WHEN** user scrolls to "Usage by API Key" section
- **THEN** system displays table with columns: Key (prefix), Owner, Executions, Tokens, Cost
- **THEN** system shows masked key prefix (mb_live_••••)
- **THEN** system links to member who owns the key

#### Scenario: Revoked key usage
- **WHEN** API key is revoked
- **THEN** system still shows historical usage for that key
- **THEN** system marks key as "(Revoked)" in table

### Requirement: Activity execution statistics
The system SHALL display execution metrics and success rates.

#### Scenario: View success rate metric
- **WHEN** viewing Usage Analytics page
- **THEN** system shows overall success rate as percentage (e.g., 87%)
- **THEN** system calculates from GET /v2/activities/metrics/summary
- **THEN** system uses formula: (successful_executions / total_executions) * 100

#### Scenario: View total executions
- **WHEN** viewing metrics summary
- **THEN** system shows total executions count
- **THEN** system shows executions today count
- **THEN** system shows average execution duration in seconds

### Requirement: Most used activities display
The system SHALL show which activity templates are most frequently executed.

#### Scenario: View top activities
- **WHEN** user scrolls to "Most Used Activities" section
- **THEN** system displays list of top 10 activity templates by execution count
- **THEN** system shows template name, category, execution count, success rate
- **THEN** system fetches from GET /v2/activities/templates with execution counts

#### Scenario: No executions yet
- **WHEN** organization has no execution traces
- **THEN** system shows "No activity data yet" message
- **THEN** system does NOT show activities table

### Requirement: Trend visualization
The system SHALL display trend indicators for key metrics.

#### Scenario: Usage increasing
- **WHEN** current period token usage is higher than previous period
- **THEN** system shows green upward arrow with percentage increase
- **THEN** system calculates: ((current - previous) / previous) * 100

#### Scenario: Usage decreasing
- **WHEN** current period token usage is lower than previous period
- **THEN** system shows red downward arrow with percentage decrease

#### Scenario: No previous period data
- **WHEN** organization is new with less than 2 periods of data
- **THEN** system shows "—" (no trend) instead of arrow
- **THEN** system does NOT calculate trend percentage
