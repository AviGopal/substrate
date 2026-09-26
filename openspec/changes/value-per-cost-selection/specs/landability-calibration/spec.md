## ADDED Requirements

### Requirement: Landability is calibrated against outcomes
Each compose outcome SHALL update a per-(edit site, gap category) success posterior, and
selection SHALL read that calibrated landability in place of the hand-set score, falling
back to the hand-set score only when the cell has no observations.

#### Scenario: A site that never lands loses priority
- **WHEN** an edit site has accumulated failed composes and no landings
- **THEN** its calibrated landability falls below sites with landings, and it is picked less often than its hand-set score would imply

### Requirement: Selection optimises value per cost
Success posteriors SHALL measure success only (cost removed from the success yield), and
expected cost SHALL be kept as a separate running mean. Selection SHALL rank by sampled
success probability divided by expected cost.

#### Scenario: Equal success, different cost
- **WHEN** two producers have the same success posterior and one costs ten times more
- **THEN** the cheaper producer is selected in the large majority of samples
