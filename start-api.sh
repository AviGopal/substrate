#!/bin/bash
cd repos/metabob-rpc-api
export SURREALDB_URL=http://localhost:8000
export SURREALDB_USERNAME=root
export SURREALDB_PASSWORD=root
export SURREALDB_NAMESPACE=test
export SURREALDB_DATABASE=learning_loop
python -m uvicorn server.simple_app:app --host 0.0.0.0 --port 8081
