# V2 API Quick Start Guide

## 🚀 Quick Test

```bash
# 1. Create session
curl -X POST http://localhost:8080/v2/session \
  -H 'X-API-Key: mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ' \
  -d '{"project_id":"test"}'

# Response contains session_token in metadata.session_token

# 2. List activity templates
curl -X GET 'http://localhost:8080/v2/activities/templates?limit=5' \
  -H 'Authorization: Bearer <session_token_from_step_1>'
```

## 📝 Test API Key

```
Key: mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ
Database: development
Org: test-org-v2-dev
```

## 🧪 Test Scripts

```bash
bash test_v2_session_full.sh      # Full session lifecycle test
bash test_v2_activities.sh         # Activities API test
```

## 📚 Documentation

- `V2_API_IMPLEMENTATION_COMPLETE.md` - Full implementation details
- `NEXT_SESSION_CLI_MIGRATION.md` - Next steps
- `SESSION_SUMMARY_FEB_8_2026.md` - This session's work

## ✅ Status

- V2 Session API: **Working** ✅
- V2 Activities API: **Working** ✅  
- Proto JSON Format: **Stable** ✅
- Next: CLI Migration ⏳
