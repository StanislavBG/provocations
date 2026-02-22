# Persona / Agent Definition — App Guide

> **Template ID**: `persona-definition` | **Category**: `write` | **Layout**: `standard`

## Purpose

Defines complete **persona, character, or AI agent profiles** with identity, motivations, behavioral traits, communication style, and constraints. Used for creating Provocations personas, chatbot characters, roleplay agents, or any entity that needs consistent behavioral rules. Challenges focus on trait coherence, distinctiveness, and behavioral specificity.

## User Workflow

1. **Select** the Persona / Agent template from the landing page
2. **Define identity** — Who is this persona? Primary goal? What makes them distinct? Boundaries?
3. **Auto-interview starts** with `thinking_bigger` persona
4. **Provoke tab** generates challenges against trait coherence, consistency, and distinctiveness
5. **Iterate** — respond to challenges, persona definition becomes more precise
6. **Output** — A complete persona profile: Identity, Background, Personality, Motivations, Constraints, Interaction Patterns, Example Exchanges

## Three-Layer Definition

### Layer 1: PrebuiltTemplate (`client/src/lib/prebuiltTemplates.ts`)
- **Title**: Persona / Agent
- **Short Label**: Persona
- **Subtitle**: Character, role, or AI agent profile
- **Objective**: "Write a complete, structured persona definition covering identity, motivations, expertise, behavioral traits, communication style, and constraints"
- **Draft Questions**:
  1. Who is this persona and what role do they play?
  2. What is their primary goal or mission?
  3. What makes them distinct from similar personas?
  4. What are their boundaries — what should they never do?
- **Steps**: `[{ id: "context", label: "Share your context" }]`
- **Provocation Sources**: Character Designer, Psychologist, End User, Red Teamer, Consistency Checker
- **Template Content**: Full persona template:
  - Identity & Role
  - Background & Expertise
  - Personality Traits
  - Motivations & Goals
  - Constraints & Forbidden Behaviors
  - Interaction Patterns
  - Example Exchanges

### Layer 2: AppFlowConfig (`client/src/lib/appWorkspaceConfig.ts`)
- **Workspace Layout**: `standard`
- **Default Toolbox Tab**: `provoke`
- **Auto-Start Interview**: `true`
- **Auto-Start Personas**: `["thinking_bigger"]`
- **Left Panel Tabs**: `[provoke, context]`
- **Right Panel Tabs**: `[discussion]`
- **Writer Config**:
  - Mode: `edit`
  - Output Format: `markdown`
  - Document Type: "persona definition"
  - Feedback Tone: "character-focused and consistency-driven"

### Layer 3: Context Builder (`server/context-builder.ts`)
- **Document Type**: "persona definition"
- **Feedback Tone**: "character-focused and consistency-driven"
- **Output Format**: `markdown`
- **System Guidance**: Challenges trait coherence (do personality traits contradict each other?), behavioral specificity (how exactly does this persona respond to conflict?), distinctiveness (how is this different from persona X?). Pushes for concrete example exchanges that demonstrate the persona in action.

## Components Used

All shared/standard components — no app-specific components.

## API Endpoints Used

All shared endpoints only.

## Key Behaviors

- **Consistency testing**: Challenges specifically look for contradictions between stated traits and example behaviors
- **Red teaming**: One provocation source specifically tries to break the persona — find edge cases where it would behave unpredictably
- **Template pre-populated**: Document starts with the full persona structure
- **Distinctiveness pressure**: If the persona sounds generic, challenges push for what makes it uniquely different
- **Forbidden behaviors**: Strong emphasis on defining what the persona must never do (as important as what it does)
- **Ties to Provocations persona system**: Definitions created here can be used as persona overrides in the admin panel
