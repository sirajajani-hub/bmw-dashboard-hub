# Business Context

Doc Type: Spec
Status: Draft
Primary Domain: Quarterly reporting policy
Primary Code Touchpoints:
- `server/dashboardService.ts`
- `src/pages/DashboardShell.tsx`
- `scripts/export_dashboard_pdf.py`

## Purpose

This document defines the business context for the BMW quarterly dashboard and deck workflow.

Use this file to answer:
- who the dashboard is for
- what business questions it should answer
- what reporting scope is in or out
- how Region and MACO should be interpreted
- what the dashboard is trying to communicate at a quarterly level

## Intended Audience

Primary audience:
- BMW US client stakeholders reviewing quarterly media performance
- internal strategy, analytics, and account teams preparing quarterly reporting decks
- operators who need a scoped, repeatable Tier 2 view for Region and MACO performance

Secondary audience:
- engineers and analysts maintaining the reporting logic
- reviewers validating whether dashboard output matches the intended business framing

## Reporting Purpose

The quarterly dashboard is intended to turn scoped Tableau source data into a deck-ready reporting view for BMW US Tier 2 media performance.

The dashboard should help users:
- understand quarter-over-quarter and year-over-year performance within the selected scope
- identify which channels, platforms, and campaigns contributed most to results
- assess efficiency and delivery quality using KPI and channel-specific metrics
- summarize the quarter in language suitable for client reporting
- surface evidence-backed optimization and recommendation signals

## Business Reporting Scope

### Market Scope

The current dashboard behavior is built for:
- BMW
- USA
- Tier 2 reporting

### Organizational Scope

The core reporting slices are:
- Region
- MACO
- Channel
- Platform or site-level entity, depending on channel
- Campaign

For `CTV` / `Connected TV/OTT` and `OLV` / `Online Video`, the platform/site-level entity should resolve from `Site Name`. If `Site Name` contains `DV360`, use `Placement Type` instead of generic ad-server labels such as `DV360` or `CM360`.

### Time Scope

The dashboard is quarter-based.

It compares:
- one selected current quarter
- one selected comparison quarter

The comparison quarter is typically the same quarter in the prior year unless the user explicitly selects a different valid comparison period.

## Tier 2 Scope Definition

The dashboard is intended to operate on strict Tier 2 scoped data.

This means:
- the base filter set should enforce Tier 2 scope
- Region selection should be exact
- MACO selection should be exact when a specific MACO is selected
- `ALL MACOS` should still remain within the selected Region

## Region And MACO Framing

### Region

Region is the primary geographic and business scope selector for the quarterly deck.

It determines:
- which MACOs are valid for selection
- which rows are considered in-scope
- how the report title and subtitle are framed
- how split-deck versus master-deck views are interpreted

### MACO

MACO is a sub-scope within Region.

The reporting model currently supports two modes:
- `ALL MACOS`
- one specific MACO within the selected Region

Interpretation:
- `ALL MACOS` means a Region-level master view
- a specific MACO means a narrower split-deck view inside that Region

## What The Deck Should Answer

At minimum, the quarterly deck should answer:
1. What happened this quarter versus the chosen comparison quarter?
2. Which KPIs improved, worsened, or remained stable?
3. Which channels and campaigns contributed the most scale?
4. Which entities delivered strong or weak efficiency relative to expectations?
5. Where are the clearest optimization opportunities?
6. What are the most evidence-backed quarter learnings that can be reused in client-facing reporting?

## Reporting Priorities

When tradeoffs arise, the dashboard should prioritize:
1. scope correctness
2. reconciliation and mathematical integrity
3. business interpretability
4. evidence-backed narrative output
5. deck-ready readability

## Business Interpretation Principles

The dashboard should be:
- evidence-backed
- comparative
- business-facing
- operational rather than theatrical
- scoped to the selected Region and MACO context

## Expected Outputs

Within the selected quarterly scope, the dashboard is expected to produce:
- KPI scorecard
- monthly trend view
- channel summary
- driver analysis
- efficiency observations
- campaign appendix
- insight sections suitable for quarterly deck use
- QA posture describing whether the assembled reporting view is internally coherent

## Non-Goals

This dashboard is not intended to:
- act as a raw Tableau field browser
- replace upstream datasource governance
- generate speculative causal explanations without evidence
- provide a full-funnel MMM or attribution model
- serve every market or reporting contract without explicit extension
- become a freeform narrative-generation system

## Known Constraints

The current implementation reflects the following constraints:
- dashboard output is built from a specific Tableau datasource and app-side transformations
- some narrative behavior is channel-specific
- evidence gating is part of the reporting model
- quarter comparisons depend on valid scoped quarter selection

## Decision Guidance For Future Changes

When evaluating future business or reporting changes, use this file to decide whether the change affects:
- scope
- interpretation
- audience-facing purpose
- allowed reporting claims
- non-goals

If a requested change alters how the deck should frame the business question, update this file before code changes are made.

## Code Touchpoints

Current implementation references most related to this business context:
- `server/dashboardService.ts`
- `src/pages/DashboardShell.tsx`
- `scripts/export_dashboard_pdf.py`
