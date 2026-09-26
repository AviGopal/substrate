## ADDED Requirements

### Requirement: A landed edit ends its dispatch
When the edit route lands a commit for the goal, the dispatch SHALL terminate with a
landed verdict. On a compose timeout, exception or non-favourable return, goal-host SHALL
probe the target repo for a commit carrying the goal's route-edit identity before falling
back to a walk, and SHALL NOT start a post-walk compose when a landing exists.

#### Scenario: Caller timed out, compose landed
- **WHEN** the early edit-intent fetch times out and the compose then lands a commit for the goal
- **THEN** the dispatch ends `completed / reached:true` citing that commit, and no walk steps run after it

### Requirement: A landed verdict is never downgraded
Once a dispatch has a landed verdict, no later step (walk, retry, BUSY refusal) SHALL
overwrite it with `failed` or `reached:false`.

#### Scenario: Later BUSY refusal
- **WHEN** a later compose attempt in the same dispatch is refused BUSY after a landing
- **THEN** the dispatch's final verdict remains the landed verdict
