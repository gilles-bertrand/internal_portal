---
description: Create a detailed implementation plan and save to specs/todo/
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
argument-hint: [feature or task description]
---

> **Démarrage** : affiche immédiatement `[TPK-plan] 🤖 Modèle : opus` comme première ligne de sortie.

# Quick Plan

## Purpose

Create a detailed implementation plan based on user requirements. The plan is saved to `specs/todo/` and can later be built with `/build`. This separates planning from execution for cleaner workflows.

## Variables

USER_PROMPT: $ARGUMENTS
PLAN_OUTPUT_DIR: specs/todo/

## Instructions

- Think deeply about the best approach before writing
- Include code examples or pseudo-code where helpful
- Consider edge cases, error handling, and scalability
- Generate a descriptive kebab-case filename based on the topic
- Plans should be detailed enough for another developer to follow

## Workflow

1. **Setup folders**
   - Run `mkdir -p specs/todo specs/done` to ensure structure exists

2. **Analyze requirements**
   - Parse USER_PROMPT to understand the core problem
   - Identify the desired outcome and constraints

2.5. **Graph grounding (advisory, skip silently if absent)**
   - Check if `graphify-out/graph.json` exists. If not, skip this step entirely.
   - Check freshness: if `graphify-out/graph.json` is older than the latest commit (`git log -1 --format=%ct`), print a one-line warning `[plan] graph is stale (last update: <date>) — context may be outdated, consider /graphify --update` and continue anyway.
   - Extract 2-4 key terms from USER_PROMPT (entities, features, components — e.g. "sprint", "auth", "kanban").
   - For each key term, run `/graphify query "<term>"` and read the returned subgraph (nodes + relations).
   - From `graphify-out/GRAPH_REPORT.md`, read only the **God Nodes** section. If any god node label matches a key term, run `/graphify explain "<god node>"` to surface its cross-community connections.
   - In the plan document, add an **Architectural Context** subsection listing:
     - Communities touched (from query results)
     - God nodes the plan will modify (flag for extra review/test coverage)
     - Cross-cutting contracts at risk (e.g. `makeSingleJsonApiTopDocument` for backend response schemas)
   - **Advisory rule** : never treat graph output as ground truth. Always confirm with a Read on the actual file before locking implementation details.

3. **Design solution**
   - Develop technical approach
   - Make architecture decisions
   - Plan implementation strategy

4. **Assess complexity**
   - Count the phases needed
   - If 4+ complex phases, consider splitting into multiple specs
   - Name split specs with numeric prefixes: `01-feature-part-one.md`

5. **Document the plan**
   - Create comprehensive markdown document with:
     - Problem statement and objectives
     - Technical approach
     - Step-by-step implementation guide
     - Testing strategy (si le plan inclut des tests d'intégration, les lister explicitement comme critère de succès bloquant — ils ne peuvent pas être substitués par un smoke test manuel)
     - Success criteria (numérotés, vérifiables — chacun sera checké par `/TPK-build` avant `done/`)

6. **Save and report**
   - Generate descriptive filename
   - Write plan to `specs/todo/[filename].md`
   - Provide summary

## Report

```
Plan Created

File: specs/todo/[filename].md
Topic: [brief description]
Phases: [count]

Key Components:
- [component 1]
- [component 2]
- [component 3]

Next: Run `/build specs/todo/[filename].md` to implement
```
