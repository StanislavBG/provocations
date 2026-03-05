#!/bin/bash
# Fetch all bugs and feature requests from AIQA Studio
# Usage: ./scripts/fetch-aiqa-bugs.sh [--status open|closed|all]

API_KEY="${AIQA_API_KEY:-REDACTED}"
PROJECT_ID="${AIQA_PROJECT_ID:-eacc71c9-f5f5-4d1b-a798-3f47b99a04da}"
BASE_URL="${AIQA_URL:-https://aiqastudio.replit.app}"

echo "Fetching AIQA bugs for project: $PROJECT_ID"
echo "---"

curl -s -H "X-API-Key: $API_KEY" \
  "$BASE_URL/api/bugs?project_id=$PROJECT_ID" | \
  python3 -m json.tool 2>/dev/null || \
  curl -s -H "X-API-Key: $API_KEY" \
    "$BASE_URL/api/bugs?project_id=$PROJECT_ID"
