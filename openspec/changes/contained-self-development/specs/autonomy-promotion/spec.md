## ADDED Requirements

### Requirement: Promotion to the live branch is an activity graded on durability
Autonomous commits that land off the live branch SHALL reach it only through a promotion
activity that consumes an evidence shape (falsifier passed, soak on the node running the
branch, no new gap in the same family) and produces a fast-forward of `dev`. Its posterior SHALL
be graded on durability (the promoted change is not reverted and its gap does not reappear).
No operator approval step SHALL exist.

#### Scenario: First unassisted landing
- **WHEN** an autonomously authored commit is promoted by the activity with no operator action
- **THEN** it is on `origin/dev` with its evidence cited in the commit and trace
