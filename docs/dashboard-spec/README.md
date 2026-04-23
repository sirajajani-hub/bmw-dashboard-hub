# Dashboard Spec

Doc Type: Spec

## Purpose

This folder is the human-facing specification layer for the quarterly dashboard.

Use it to define:
- intended business behavior
- reporting scope
- KPI semantics
- insight rules
- tone and language rules
- QA rules
- doc-to-code workflow

Do not use it to store:
- temporary debugging notes
- raw datasource dumps
- unreviewed implementation experiments

## Contract

The workflow is docs-first:

1. The user updates a spec document.
2. Codex interprets the spec.
3. Codex updates the implementation to match.
4. Codex keeps the spec and code aligned.

The docs define intended behavior.
The code remains the executable implementation.

## Spec vs Reference

### Spec Docs

Spec docs are source-of-truth for intended behavior.

A spec doc may define:
- what the dashboard should do
- what logic is allowed
- what language is allowed
- what validations are required
- what edge cases should block output

### Reference Docs

Reference docs describe the current state of the system.

A reference doc may contain:
- runtime code maps
- datasource notes
- known gaps
- assumptions
- implementation pointers

Reference docs must not silently become behavior owners.

## Folder Model

This folder currently includes:
- `00-product-overview-prd.md`
- `01-business-context-prd.md`
- `02-terminology-and-metrics.md`
- `03-data-pull-and-execution-flow.md`
- `04-insights.md`
- `05-qa-logic.md`
- `06-doc-to-code-workflow.md`
- `90-reference-runtime-code-map.md`
- `91-reference-campaign-card-logic.md`

## Authoring Rules

Each spec file should be:
- scoped to one behavior area
- easy to translate into code
- concise
- explicit about inputs, rules, and boundaries

Each source-of-truth spec should include:
- Purpose
- Applies To
- Inputs
- Rules
- Blocking Conditions
- Output Expectations
- Examples
- Non-Goals
- Code Touchpoints

## Ownership Boundary

Keep these boundaries strict:
- PRD files explain why the dashboard exists and what business outcome it should support
- terminology and metrics explain what fields and KPIs mean
- execution flow explains how the payload gets assembled
- insights explain what gets said and how it gets said
- QA explains what gets validated
- workflow explains how changes happen
- reference docs explain where implementation currently lives

## Drift Prevention Rules

To reduce doc/code drift:
- one behavior should have one owning spec file
- every spec should name the implementing code path
- examples are illustrative unless explicitly marked otherwise
- ambiguity should be resolved before implementation when it would materially change behavior

## Current Runtime Owner

The current quarterly dashboard runtime is primarily implemented in:
- `server/dashboardService.ts`

This folder does not replace runtime code. It governs intended behavior for future code changes.
