# Specification: Activity-API Discovery Migration

## Overview

This specification defines the migration path for activity-api vessel registration endpoints to the centralized discovery-vessel service. The migration ensures backward compatibility during transition while establishing activity-api as a properly registered vessel.

---

## ADDED Requirements

### Requirement: Self-registration with discovery-vessel

Activity-API SHALL register itself with discovery-vessel on startup.

#### Scenario: Registration on startup
- **WHEN** activity-api starts and `DISCOVERY_VESSEL_URL` is configured
- **THEN** activity-api SHALL call `POST /register` with:
  - `vesselId`: "activity-api" (or instance-specific ID)
  - `vesselName`: "Activity Learning Backend"
  - `version`: from package.json
  - `endpoint`: `ACTIVITY_API_EXTERNAL_URL`
  - `shapes`: advertised impulse shapes (see below)
  - `metadata`: domain-specific context

#### Scenario: Shapes to advertise
- **WHEN** activity-api registers
- **THEN** shapes SHALL include:
  - `activityExecutionTrace`
  - `activityTemplate`
  - `activityMetrics`
  - `toolRiskProfile`
  - `executionTraceList`
  - `variantMetricsSummary`
  - `activityTemplateRecommendation`
  - `compositionSuccess`
  - `impulseRelevance`
  - `preValidationResult`

#### Scenario: Registration failure is non-fatal
- **WHEN** registration fails
- **THEN** activity-api SHALL log warning and continue
- **AND** retry every 60 seconds with backoff

### Requirement: Heartbeat to discovery-vessel

Activity-API SHALL send periodic heartbeats.

#### Scenario: Heartbeat on interval
- **WHEN** activity-api is registered
- **THEN** it SHALL send `POST /heartbeat` every 2 minutes
- **AND** include optional domain-specific metrics

#### Scenario: Heartbeat failure triggers re-registration
- **WHEN** heartbeat returns 404
- **THEN** activity-api SHALL re-register

---

### Requirement: Deprecation headers on legacy vessel endpoints

Legacy `/v2/vessels/*` endpoints SHALL be marked deprecated.

#### Scenario: Deprecation header on all vessel endpoints
- **WHEN** any request is made to `/v2/vessels/*` endpoints
- **THEN** response SHALL include HTTP header `Deprecation: true`
- **AND** header `Sunset: <30 days from deployment>`
- **AND** header `Link: <discovery-vessel-url>; rel="successor-version"`

#### Scenario: Deprecation warning in response body
- **WHEN** a response is returned from deprecated endpoints
- **THEN** response MAY include `_deprecation` field with migration info

---

### Requirement: Optional proxy to discovery-vessel during migration

Activity-API MAY proxy vessel requests to discovery-vessel.

#### Scenario: Proxy mode enabled via environment
- **WHEN** `VESSEL_PROXY_ENABLED=true` is set
- **THEN** activity-api SHALL proxy:
  - `POST /v2/vessels/register` → `POST /register`
  - `POST /v2/vessels/heartbeat` → `POST /heartbeat`
  - `GET /v2/vessels/discover?shape=X` → `POST /resolve` with vesselCapability pointer

#### Scenario: Proxy fallback on discovery failure
- **WHEN** proxy mode is enabled but discovery-vessel is unreachable
- **THEN** activity-api SHALL fall back to local registry

---

### Requirement: Health endpoint includes discovery-vessel status

#### Scenario: Health check includes discovery state
- **WHEN** `GET /health` is called
- **THEN** response SHALL include `checks.discovery_vessel` with connectivity status

---

## REMOVED Requirements (after sunset)

### Requirement: Remove legacy vessel endpoints after sunset

#### Scenario: Endpoint returns 410 Gone after sunset
- **WHEN** `/v2/vessels/*` is called after sunset date
- **AND** `VESSEL_ENDPOINTS_REMOVED=true` is set
- **THEN** activity-api SHALL return 410 Gone

---

## Migration Timeline

| Phase | Days | Actions |
|-------|------|---------|
| 1. Preparation | 1-3 | Self-registration, heartbeat, deprecation headers |
| 2. Dual-Write | 4-17 | Proxy mode, write to both registries |
| 3. Read Migration | 18-24 | Switch queries to discovery-vessel |
| 4. Write Removal | 25-30 | Disable local registry writes |
| 5. Endpoint Removal | 31+ | Return 410 Gone |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCOVERY_VESSEL_URL` | (none) | Discovery-vessel endpoint |
| `ACTIVITY_API_EXTERNAL_URL` | (none) | Activity-api external URL |
| `VESSEL_PROXY_ENABLED` | false | Enable proxying to discovery |
| `VESSEL_ENDPOINTS_REMOVED` | false | Return 410 for vessel endpoints |
