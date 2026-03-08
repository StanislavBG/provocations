#!/bin/bash
# Marketing Agency Loop — runs Claude Code in the agency directory.
#
# Usage: ./agency-loop.sh
#
# This starts a loop that polls for events every 5 minutes.
# Events arrive hourly from the Provocations timer node.
# The actual processing is done by Claude Code reading CLAUDE.md.

set -e
cd "$(dirname "$0")"

echo "=== Marketing Agency Starting ==="
echo "Polling interval: 5 minutes"
echo "Press Ctrl+C to stop"
echo ""

while true; do
  echo "[$(date)] Checking for agency events..."
  claude --print "Poll for pending agency events using agency_poll_events. If there are events, claim and process them following the 6-agent pipeline described in CLAUDE.md. If no events, report that and exit." 2>&1 || true
  echo "[$(date)] Cycle complete. Sleeping 5 minutes..."
  sleep 300
done
