## ADDED Requirements

### Requirement: Column header shows produced shape badge count after execution
Each column in the TrajectoryGrid SHALL display an impulse overlay beneath its column index indicator when trace or live execution data is present. The overlay SHALL show a count of unique produced shape names and, on hover or expansion, the individual shape names as compact monospace badges.

#### Scenario: Overlay shown after column completes during live execution
- **WHEN** a live execution is running and tasks in column N have completed with shape contributions
- **THEN** column N's header area shows a badge with the count of unique produced shapes from that column

#### Scenario: Overlay shows shape names on hover
- **WHEN** the user hovers over the column impulse badge
- **THEN** a tooltip or expanded row shows the individual shape name strings (e.g., "file_content", "test_result")

#### Scenario: Overlay absent when no execution data
- **WHEN** no trace is loaded and no live execution is active
- **THEN** no impulse overlay badge is rendered beneath any column header

#### Scenario: Multiple tasks in same column aggregate shapes
- **WHEN** column 2 contains 3 tasks that produced shapes ["file_content"], ["test_result"], and ["memo"]
- **THEN** the column overlay badge shows count "3" and lists all three shapes on hover

#### Scenario: Duplicate shapes deduplicated in overlay count
- **WHEN** two tasks in the same column both produce the shape "file_content"
- **THEN** the overlay badge shows count "1" (deduplication by shape name)

### Requirement: Static expected shapes shown when no trace active
When `ImpulseStateSpace` is computed but no live execution or trace is active, the column overlay SHALL show the statically expected output shapes from the state-space computation as a faded/muted badge (visually distinct from live data).

#### Scenario: Static overlay from ImpulseStateSpace
- **WHEN** activities are loaded but no trace or execution is active
- **THEN** column headers show muted shape count badges derived from the activities' output_shapes declarations

#### Scenario: Static overlay replaced by live data
- **WHEN** a live execution starts for a trajectory that previously showed static overlays
- **THEN** column overlays switch to live trace data as tasks complete, replacing the static view
