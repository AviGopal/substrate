#!/usr/bin/env python3
"""Query database for impulse effectiveness metrics."""

import asyncio
import json
import sys


async def query_db():
    """Query impulse_effectiveness table for recent records."""
    try:
        from surrealdb import Surreal

        async with Surreal("ws://localhost:8000/rpc") as db:
            await db.signin({"user": "root", "pass": "root"})
            await db.use("metabob", "production")

            # Get recent impulse_effectiveness records
            result = await db.query(
                "SELECT * FROM impulse_effectiveness ORDER BY created_at DESC LIMIT 50;"
            )
            records = (
                result[0]["result"] if result and result[0]["status"] == "OK" else []
            )

            # Analyze data quality
            total = len(records)
            unknown_ids = sum(1 for r in records if r.get("impulse_id") == "unknown")
            zero_tokens = sum(1 for r in records if r.get("tokens_used", 0) == 0)
            all_useful = sum(1 for r in records if r.get("was_useful") is True)

            # Print results as JSON
            print(
                json.dumps(
                    {
                        "total": total,
                        "unknown_ids": unknown_ids,
                        "unknown_pct": round(unknown_ids / total * 100, 1)
                        if total > 0
                        else 0,
                        "zero_tokens": zero_tokens,
                        "zero_tokens_pct": round(zero_tokens / total * 100, 1)
                        if total > 0
                        else 0,
                        "all_useful": all_useful,
                        "all_useful_pct": round(all_useful / total * 100, 1)
                        if total > 0
                        else 0,
                        "sample_records": [
                            {
                                "impulse_id": r.get("impulse_id", "missing"),
                                "tokens": r.get("tokens_used", 0),
                                "useful": r.get("was_useful", False),
                            }
                            for r in records[:5]
                        ],
                    },
                    indent=2,
                )
            )

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(query_db())
