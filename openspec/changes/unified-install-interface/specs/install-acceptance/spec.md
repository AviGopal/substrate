## ADDED Requirements

### Requirement: The install page is executable
README § Installation SHALL be the only document containing setup commands, and its
commands SHALL be in fenced blocks marked for extraction. Every other document SHALL link
to it instead of restating commands.

#### Scenario: Restated commands are found
- **WHEN** the docs, skills and compose header are searched for a launch command outside
  the install page
- **THEN** none is found

### Requirement: Acceptance runs off-host, cold, and verbatim
For every published image, an acceptance run SHALL execute the install page's marked
commands verbatim on a fresh host that has no client configuration, no CLI credential
cache, no local image of the substrate, no build toolchain, and no pre-existing volumes,
once per declared container engine. It SHALL pass only when the verdict reaches
`connected` and a cockpit query answers.

#### Scenario: A host-local advantage is removed
- **WHEN** the install page depends on a step that only works with ambient credentials
- **THEN** the acceptance run fails at that step

#### Scenario: Health without usability
- **WHEN** a fleet reaches `served` but no goal can be reached
- **THEN** the acceptance run fails and names `usable`

### Requirement: CI judges; the substrate learns
The acceptance verdict SHALL be decided outside any substrate built from the image under
test and SHALL gate publishing. Each run SHALL additionally post its verdict, image digest,
engine, profile and failing step as a traced impulse to the reference hub, and SHALL file a
gap through the existing gap-intake path on failure, with the failing install-page block as
evidence. Posting SHALL retry and SHALL NOT block publishing. The CI credential SHALL be
able to write only acceptance results and gap intake.

#### Scenario: The hub is down during a run
- **WHEN** the reference hub is unreachable when a run finishes
- **THEN** the publish decision is unaffected and the result is posted when the hub returns

#### Scenario: A regression files its own gap
- **WHEN** an image breaks a step of the install page
- **THEN** a gap naming that step and the image digest exists without operator action

### Requirement: Only acceptance calls setup green
A setup, lifecycle or join defect SHALL be closed only when an acceptance run passes on a
published image that contains its fix. A result measured on an operator host, a warm
volume, or with a drop-in, overlay or uncommitted change SHALL NOT close it.

#### Scenario: A fix verified with a drop-in
- **WHEN** a defect's fix has been verified only through a mounted unit drop-in
- **THEN** the defect remains open until the acceptance run passes on an image containing
  the fix

### Requirement: Human installs can report
The verdict command SHALL offer an opt-in report that posts the same acceptance shape,
marked as human-reported, from any install with an anchor to report to.

#### Scenario: A person's failed install reaches the gap store
- **WHEN** a person whose install stops at `served` runs the report option
- **THEN** the reference hub holds an acceptance record with their verdict and engine, and a
  gap exists for the failing level
