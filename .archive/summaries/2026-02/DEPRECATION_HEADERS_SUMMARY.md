# Deprecation Headers Implementation Summary

## Overview
Added deprecation headers and tracking to the old `/activity-recommendations/*` API endpoints in preparation for sunset on **Mon, 09 Mar 2026** (30 days from now).

## Changes Made

### File Modified
- `repos/metabob-rpc-api/server/routes/activity_recommendations.py`

### 1. Module Documentation
- Updated module docstring with deprecation warning
- Added migration guide mapping old → new endpoints

### 2. Deprecation Infrastructure
Added helper functions and constants:

```python
DEPRECATION_SUNSET_DATE = "Mon, 09 Mar 2026 20:44:14 GMT"
DEPRECATION_REPLACEMENT_MAPPING = {
    "/activity-recommendations/recommendations": "/v2/activities/templates",
    "/activity-recommendations/variants/{variant_id}/details": "/v2/activities/templates/{id}",
    "/activity-recommendations/selections": "/v2/activities/record/start",
    "/activity-recommendations/conversions": "/v2/activities/record/complete",
}

def add_deprecation_headers(response: Response, endpoint_path: str) -> None:
    """Add standard deprecation headers to response."""
    response.headers["X-Deprecated"] = "true"
    response.headers["X-Sunset"] = DEPRECATION_SUNSET_DATE
    response.headers["Deprecation"] = "true"
    response.headers["X-Replacement"] = <mapped_endpoint>

def log_deprecation_usage(endpoint: str, session_id: str, user_id: Optional[str]) -> None:
    """Log deprecation warning for tracking migration progress."""
    logger.warning(f"DEPRECATED_API_USAGE: endpoint={endpoint} session={session_id} user={user_id} sunset_date={DEPRECATION_SUNSET_DATE}")
```

### 3. Updated Endpoints

#### `/recommendations` (POST)
- ✅ Updated summary: "Get Activity recommendations (DEPRECATED)"
- ✅ Updated description with migration notice
- ✅ Added `http_response: Response` parameter
- ✅ Added deprecation headers via `add_deprecation_headers()`
- ✅ Added deprecation logging via `log_deprecation_usage()`
- ✅ Updated docstring with deprecation warning
- **Replacement**: `POST /v2/activities/templates`

#### `/selections` (POST)
- ✅ Updated summary: "Record Activity selection (DEPRECATED)"
- ✅ Updated description with migration notice
- ✅ Added `http_response: Response` parameter
- ✅ Added deprecation headers
- ✅ Added deprecation logging
- ✅ Updated docstring
- **Replacement**: `POST /v2/activities/record/start`

#### `/conversions` (POST)
- ✅ Updated summary: "Record Activity conversion (DEPRECATED)"
- ✅ Updated description with migration notice
- ✅ Added `http_response: Response` parameter
- ✅ Added deprecation headers
- ✅ Added deprecation logging
- ✅ Updated docstring
- **Replacement**: `POST /v2/activities/record/complete`

#### `/variants/{variant_id}/details` (GET)
- ✅ Updated summary: "Get variant details (DEPRECATED)"
- ✅ Updated description with migration notice
- ✅ Added `http_response: Response` parameter
- ✅ Added deprecation headers
- ✅ Added deprecation logging
- ✅ Updated docstring
- **Replacement**: `GET /v2/activities/templates/{id}`

## HTTP Headers Added

All deprecated endpoints now return:

```http
X-Deprecated: true
X-Sunset: Mon, 09 Mar 2026 20:44:14 GMT
Deprecation: true
X-Replacement: <new_endpoint_url>
```

## Logging

Each request to deprecated endpoints generates a warning log:

```
DEPRECATED_API_USAGE: endpoint=/activity-recommendations/recommendations session=session_xyz user=user_abc sunset_date=Mon, 09 Mar 2026 20:44:14 GMT
```

This allows tracking:
- Which endpoints are still in use
- Which users/agents need to migrate
- Migration progress over time

## Migration Path

| Old Endpoint | New Endpoint | Method |
|-------------|--------------|--------|
| `/activity-recommendations/recommendations` | `/v2/activities/templates` | POST |
| `/activity-recommendations/variants/{id}/details` | `/v2/activities/templates/{id}` | GET |
| `/activity-recommendations/selections` | `/v2/activities/record/start` | POST |
| `/activity-recommendations/conversions` | `/v2/activities/record/complete` | POST |

## Testing

✅ Python syntax validation passed
✅ All deprecation headers configured
✅ Logging infrastructure in place
✅ Migration guidance in OpenAPI docs

## Next Steps

1. Monitor deprecation logs to identify active users
2. Notify clients about migration deadline
3. Update client code (metabob-cli, dashboard) to use v2 endpoints
4. Remove deprecated endpoints after sunset date (Mon, 09 Mar 2026)

## Client-Side Changes Needed

Clients should:
1. Check for `X-Deprecated` header in responses
2. Log warnings when deprecated endpoints are used
3. Migrate to replacement endpoints before sunset date
4. Update code to use `/v2/activities/*` endpoints

## Example Client Migration

**Before (deprecated):**
```python
response = requests.post(
    "https://api/activity-recommendations/recommendations",
    json={"consumer_id": "...", "intent": "..."}
)
```

**After (v2 API):**
```python
response = requests.post(
    "https://api/v2/activities/templates",
    json={"consumer_id": "...", "intent": "..."}
)
```

Response format remains compatible, so minimal client changes required.
