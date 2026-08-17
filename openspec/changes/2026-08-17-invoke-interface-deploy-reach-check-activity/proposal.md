# Proposal: Create Activity to Invoke `interface_deploy_reach_check`

## Rationale

The substrate gap `orphaned-capability-interface_deploy_reach_check` indicates that the `interface_deploy_reach_check` resolver is a live registered capability but is not being invoked by any activity. To close this gap and ensure the capability is utilized, this proposal introduces a new activity template `invoke-interface-deploy-reach-check`.

This activity will directly invoke the `interface_deploy_reach_check` resolver. This ensures that the capability is no longer orphaned and its intended functionality (scoring interface deploys against post-deploy interaction) can be exercised and monitored.

## Changes

- Add a new activity template `invoke-interface-deploy-reach-check.json` which calls the `interface_deploy_reach_check` resolver.
