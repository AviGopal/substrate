#!/bin/sh
docker exec -i substrate-live sh -c '. /etc/substrate/env; curl -sS -m 180 -X POST -u "$SURREALDB_USERNAME:$SURREALDB_PASSWORD" -H "surreal-ns: activity-system" -H "surreal-db: learning_loop" -H "Accept: application/json" --data-binary @- http://127.0.0.1:8000/sql; echo; echo "curl_rc=$?" >&2' 2>&1 | grep -v Emulate
