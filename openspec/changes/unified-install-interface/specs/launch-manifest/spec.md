## ADDED Requirements

### Requirement: One declaration of how the image runs
The published port set, volume names and mount points, tmpfs mounts, privilege, stop
signal, stop grace period, restart policy and healthcheck SHALL be declared in exactly one
launch manifest. Every supported launcher SHALL consume that manifest rather than declare
any of these facts itself.

#### Scenario: No launcher re-declares a port list
- **WHEN** the tracked source tree outside the manifest is searched for a host-port
  mapping of a container port the manifest publishes
- **THEN** no launcher script, Makefile recipe or secondary compose file contains one

#### Scenario: Two launchers agree
- **WHEN** the same inputs are launched through the install page and through `make up`
- **THEN** `docker inspect` of the two containers reports identical port bindings, mounts,
  stop timeout and healthcheck

### Requirement: The manifest is shipped with the image
The image SHALL carry a byte-identical copy of the manifest and SHALL print it on request,
so a host without a checkout obtains the same declaration. The build SHALL fail when the
baked copy differs from the tracked file.

#### Scenario: Checkout-free acquisition
- **WHEN** a person on a host with only a container engine prints the manifest from the
  image and launches it
- **THEN** the result is indistinguishable, by `docker inspect`, from a launch from a checkout

### Requirement: Stop grace covers the drain
The manifest's stop grace period SHALL be at least the longest configured vessel drain
plus the datastore flush allowance. The acceptance run SHALL fail when the stop timeout
it inspects on the launched container is shorter.

#### Scenario: Compose stop does not cut off the datastore
- **WHEN** a fleet with in-flight work is stopped with the engine's own `compose stop`
- **THEN** the datastore unit logs a clean shutdown and the next boot performs no recovery

### Requirement: Published vessels are reachable
Every vessel whose port the manifest publishes SHALL bind a non-loopback address inside
the container. Exposure SHALL be controlled only by the manifest's host-side port mapping.

#### Scenario: The relay is part of the manifest
- **WHEN** a hub is launched from the manifest with `PROFILE=hub`
- **THEN** the relay runs inside the container, its port is published from the prefix, and
  `/bootstrap` advertises that published address; no host process is required

#### Scenario: The human surface on a fresh pull
- **WHEN** a fresh volume is booted from a pulled image with the default manifest
- **THEN** `GET http://localhost:18310/` from the host returns 200
