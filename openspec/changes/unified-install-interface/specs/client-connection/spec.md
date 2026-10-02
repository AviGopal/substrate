## ADDED Requirements

### Requirement: The image emits the client connection
The image SHALL provide one command that prints the client configuration — the endpoint
computed from the published port prefix and an API key that passes `seeded` — in the
format the cockpit reads, and the one-line cockpit registration command. The configuration
SHALL be the only output on stdout; the registration line and any warning SHALL go to
stderr. It SHALL refuse,
with a non-zero exit and no key printed, while `seeded` is not `pass`.

#### Scenario: A non-default port prefix
- **WHEN** a fleet launched with `SUBSTRATE_PORT_PREFIX=24` emits its client connection
- **THEN** the endpoint names port 24080

#### Scenario: Before seeding completes
- **WHEN** the command runs while identity seeding is in progress
- **THEN** it exits non-zero, prints the current verdict, and prints no key

### Requirement: One client configuration location
The client configuration SHALL follow the cockpit's existing location rule — one override
variable (`METABOB_CONFIG_PATH`), then a project-local file, then the home file — and every
tool and document SHALL use that rule and that one variable name. The connection command
SHALL warn when a project-local file would shadow the file it writes.

#### Scenario: A project-local file shadows the home file
- **WHEN** the connection is emitted for a cockpit started in a directory containing
  `.metabob/config.json`
- **THEN** the output warns that the project-local file takes precedence

#### Scenario: The two names are gone
- **WHEN** the tracked source tree and docs are searched for the retired override name
- **THEN** it appears only in migration notes

### Requirement: The cockpit is part of setup
The install page SHALL state the cockpit's prerequisites and SHALL include the emitted
registration step, and setup SHALL NOT be reported complete until a cockpit query answers
against the new fleet.

#### Scenario: A fresh host follows the page
- **WHEN** a person on a fresh host follows the install page to its end
- **THEN** a cockpit registry query returns the new fleet's shapes

### Requirement: Teardown names the client side
The install page's teardown section SHALL name the client configuration file and the
cockpit registration to remove.

#### Scenario: Destroying a fleet
- **WHEN** a person follows the teardown section with state destruction
- **THEN** no container, volume, client configuration entry or cockpit registration for
  that fleet remains
