# Product Requirement — App Guide

> **Template ID**: `product-requirement` | **Category**: `build` | **Layout**: `standard`

## Purpose

Produces enterprise-grade product requirement documents for incremental features — not greenfield apps. Uses a semi-structured format covering who the user is, their current workflow, what's broken or missing, the proposed change, scope boundaries, and acceptance criteria.

## Unique Behaviors

- **Dual objective input**: Users provide both an app-level description AND a feature-specific description
- **Context Store integration**: Primary objective can be loaded from saved context (previous app descriptions)
- **Template pre-populated**: Document starts with full PRD structure (Problem, User, Workflow, Proposed Change, Scope, Acceptance Criteria, Edge Cases)
- **Incremental features only**: System guidance is tuned for adding to existing products, not building from scratch
- **Testability focus**: Acceptance criteria must be Given/When/Then format
- **Edge case pressure**: Personas specifically challenge for missing error states and boundary conditions
- **Auto-interview**: Starts with `thinking_bigger` persona

See `docs/architecture.md` for the three-layer application pattern.
