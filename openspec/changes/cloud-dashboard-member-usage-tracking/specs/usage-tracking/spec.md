## ADDED Requirements

### Requirement: Display token usage by member
The system SHALL display token consumption for each organization member over a selected time period.

#### Scenario: View current month usage
- **WHEN** user views Usage page with default "Current Month" filter
- **THEN** system displays token usage for each member for the current calendar month

#### Scenario: Filter by custom date range
- **WHEN** user selects custom start and end dates
- **THEN** system displays token usage for selected date range broken down by member

#### Scenario: No usage data available
- **WHEN** organization has no execution traces in selected period
- **THEN** system displays "No usage data for this period"

### Requirement: Display cost metrics
The system SHALL calculate and display cost in USD based on token consumption and model pricing.

#### Scenario: Calculate cost from execution traces
- **WHEN** system fetches execution traces with input_tokens and output_tokens
- **THEN** system calculates cost using model pricing (e.g., $3/$15 per million for Claude Sonnet 4)

#### Scenario: Display total organization cost
- **WHEN** user views Usage dashboard
- **THEN** system displays total cost for organization in selected time period

#### Scenario: Display cost per member
- **WHEN** user views member breakdown
- **THEN** system displays cost attributed to each member's executions

### Requirement: Token consumption trends
The system SHALL display token usage trends over time with daily granularity.

#### Scenario: Display 30-day trend chart
- **WHEN** user views Usage page
- **THEN** system displays line chart showing daily token consumption for past 30 days

#### Scenario: Trend chart by member
- **WHEN** user selects "By Member" view
- **THEN** system displays stacked area chart with each member's daily usage

### Requirement: Activity type breakdown
The system SHALL categorize token usage by activity category (feature, bugfix, refactor, tool, infrastructure).

#### Scenario: Display usage by category
- **WHEN** user views Usage dashboard
- **THEN** system displays pie chart showing token distribution across activity categories

#### Scenario: Filter by category
- **WHEN** user clicks on category in pie chart
- **THEN** system filters all usage data to show only that category

### Requirement: API key usage attribution
The system SHALL attribute token usage to the member who owns the API key used for execution.

#### Scenario: MiniBob execution via API key
- **WHEN** MiniBob executes activity using member's API key
- **THEN** system attributes token consumption to that member

#### Scenario: JWT-based dashboard execution
- **WHEN** user triggers activity from dashboard with JWT token
- **THEN** system attributes token consumption to authenticated user

#### Scenario: Unattributed usage
- **WHEN** execution trace has no member attribution (legacy data)
- **THEN** system categorizes as "System/Unknown" in usage breakdown

### Requirement: Export usage reports
The system SHALL allow users to export usage data as CSV for external analysis.

#### Scenario: Export current view as CSV
- **WHEN** user clicks "Export CSV" button
- **THEN** system downloads CSV file with columns: date, member, activity_category, tokens_input, tokens_output, cost_usd

#### Scenario: CSV includes selected filters
- **WHEN** user exports with date range and member filters active
- **THEN** CSV contains only filtered data matching current view
