#!/bin/bash
# Fetch all bugs and feature requests from AIQA Studio
# Usage: ./scripts/fetch-aiqa-bugs.sh [--status open|closed|all]

API_KEY="${AIQA_API_KEY:-3b03bd31-93b9-4efe-9c3d-4d6a54db97f0}"
PROJECT_ID="${AIQA_PROJECT_ID:-0681dd20-4cec-4a1a-8280-7c7b33fdaee7}"
BASE_URL="${AIQA_URL:-https://aiqastudio.replit.app}"

echo "Fetching AIQA bugs for project: $PROJECT_ID"
echo "---"

curl -s -H "X-API-Key: $API_KEY" \
  "$BASE_URL/api/bugs?project_id=$PROJECT_ID" | \
  python3 -m json.tool 2>/dev/null || \
  curl -s -H "X-API-Key: $API_KEY" \
    "$BASE_URL/api/bugs?project_id=$PROJECT_ID"
