# Product Overview

Doc Type: Spec
Status: Orientation

## Purpose

This document provides a short orientation to the quarterly dashboard system, its runtime boundaries, and the role of the `dashboard-spec` folder.

## What The System Does

The quarterly dashboard turns scoped Tableau datasource rows into a deck-ready reporting payload for BMW US Tier 2 media performance.

The runtime currently:
- resolves Region, MACO, current quarter, and comparison quarter
- applies a fixed Tableau scope constraint of `CPO Categorization = New Car`
- queries Tableau through MCP
- computes KPIs, charts, summaries, insights, and QA
- assembles channel cards with spend, KBAs, impressions, and CP KBA summary metrics
- renders the dashboard catalog with clearly differentiated per-card gradient artwork variants, with each card led by a distinct dominant color family while still sharing one common visual style
- presents the `Tier 2: Quarterly MACO Reports` dashboard shell entry using the same card size and treatment as the dashboard catalog, with a black/grey dominant hero treatment for the AI-powered Tier 2 MACO reporting template
- returns one payload for the browser dashboard
- reuses the same payload for PDF export

## Current Runtime Surfaces

Primary runtime files:
- `src/pages/DashboardShell.tsx`
- `server/index.ts`
- `server/dashboardService.ts`
- `server/tableauConfig.ts`
- `server/tableauMcpClient.ts`
- `scripts/export_dashboard_pdf.py`

## Current Datasource Position

The app runtime currently points to the V1 FV published datasource through backend config.

That means:
- datasource field semantics matter
- app-side transformations matter
- markdown docs do not execute directly at runtime

## Why This Spec Layer Exists

This spec layer exists so future logic changes can start in documentation rather than in code diffs alone.

The intended operating model is:
1. update the spec
2. translate the spec into code
3. keep the spec and code aligned

## Spec Areas

This folder is divided by behavior area:
- business context
- terminology and metrics
- execution flow
- insights
- QA
- doc-to-code workflow
- runtime code map

## Non-Goals

This overview is not intended to:
- define detailed KPI formulas
- define insight wording patterns
- define QA thresholds
- duplicate code line by line
