# Persona / Agent Definition — App Guide

> **Template ID**: `persona-definition` | **Category**: `write` | **Layout**: `standard`

## Purpose

Defines complete persona, character, or AI agent profiles with identity, motivations, behavioral traits, communication style, and constraints. Used for creating Provocations personas, chatbot characters, roleplay agents, or any entity that needs consistent behavioral rules.

## Unique Behaviors

- **Consistency testing**: Challenges specifically look for contradictions between stated traits and example behaviors
- **Red teaming**: One provocation source specifically tries to break the persona — find edge cases where it would behave unpredictably
- **Forbidden behaviors emphasis**: Strong focus on defining what the persona must never do (as important as what it does)
- **Distinctiveness pressure**: If the persona sounds generic, challenges push for what makes it uniquely different
- **Template pre-populated**: Full persona structure (Identity, Background, Personality, Motivations, Constraints, Interaction Patterns, Example Exchanges)
- **Ties to persona system**: Definitions created here can be used as persona overrides in the admin panel
- **Auto-interview**: Starts with `thinking_bigger` persona

See `docs/architecture.md` for the three-layer application pattern.
