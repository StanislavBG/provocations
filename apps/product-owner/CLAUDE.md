# Product Owner Agent — App Guide

> **Template ID**: `product-owner` | **Category**: `build` | **Layout**: `standard`

## Purpose

Helps users create a comprehensive Product Owner guide — a "product owner brain in a file" that any AI agent team can consult for alignment, quality, and integration.

## Structure

The document follows a 10-section framework:

1. **Product Identity** — What the product IS and IS NOT, core promise, who uses it
2. **Product Values** — Ranked "X over Y" decision tiebreakers (not just listed — ranked)
3. **Quality Bar** — Objective "done" checklist (functional, code quality, integration, docs)
4. **Sprint Review Protocol** — Self-check (2 min) + full review (15 min) procedures
5. **Decision Framework** — Feature/architecture/scope decision flowcharts
6. **Cross-Team Coordination** — Dependency map, file ownership, parallel work rules
7. **Anti-Patterns** — Real incidents: what happened, why bad, what to do instead
8. **Release Readiness** — Non-negotiable / important / nice-to-have gates
9. **Agent Protocol** — Before/during/after workflow for AI agents
10. **Evolution** — How and when to update the guide

## Unique Behaviors

- **Ranked values enforced**: The system challenges unranked value lists — "Reliability over features" is useful; "Reliability is important" is not
- **Real incident pressure**: Anti-patterns must come from actual incidents, not hypothetical scenarios
- **Checkbox quality bar**: Quality gates use checkboxes, not prose — "done" is a fact, not a feeling
- **Progressive specificity**: The guide should get MORE specific with each sprint, not more generic
- **Agent autonomy test**: Can an agent resolve a scope question without asking the human?

## Provocations Focus

Personas challenge the user's PO guide:
- "Your quality bar doesn't define what 'tested' means"
- "Your values aren't ranked — they're just listed"
- "Your anti-patterns section has zero items from real incidents"
- "Your readiness checklist has no security requirements"
- "Can an agent resolve a scope question without asking the human?"

See `docs/architecture.md` for the three-layer application pattern.
