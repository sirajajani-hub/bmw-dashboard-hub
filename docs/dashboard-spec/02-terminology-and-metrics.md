# Terminology and Metrics

Doc Type: Spec
Status: Source Of Truth
Primary Code Owner: `server/dashboardService.ts`

## Purpose

This file defines the business meaning of the dashboard's core terms, dimensions, KPIs, and narrative metric helpers.

Use this file to govern:
- shared reporting vocabulary
- KPI meaning
- comparison semantics
- better-when-higher versus better-when-lower directionality
- display expectations for major metrics

## Applies To

This spec applies to:
- API payload semantics
- KPI scorecard interpretation
- chart and summary labels
- insight metric routing
- QA checks that validate derived values

This spec does not define:
- datasource extraction mechanics
- Tableau calc governance outside the app runtime
- detailed insight sentence templates

## Core Scope Terms

### Region

Region is the primary geographic and reporting scope selector for the deck.

Current examples include values like:
- `T2EAST`
- `T2CENTRAL`
- `T2SOUTH`
- `T2WEST`

### MACO

MACO is a business sub-scope within Region.

Special value:
- `ALL MACOS` means region-wide scope rather than a single MACO slice

### CPO Categorization

`CPO Categorization` is a datasource dimension used as a hard scope constraint in this dashboard runtime.

Current dashboard rule:
- the dashboard always applies `CPO Categorization = New Car`
- this is not currently exposed as a user-selectable filter in the UI
- all returned KPI, chart, channel, appendix, and insight rows are expected to reconcile within that filtered scope

### Current Quarter

The selected reporting quarter treated as the main performance window for:
- KPI totals
- appendix rows
- delivery and recommendation logic

### Comparison Quarter

The selected reference quarter used for:
- deltas
- comparison framing
- variance logic
- efficiency comparison

## Comparison Semantics

The dashboard currently uses two comparison ideas:
- quarter-over-quarter or prior-year quarter comparison for major reporting outputs
- month-over-month comparison for some variance bullets when it is more material than the quarter comparison basis

The backend is authoritative for valid quarter labels and default quarter resolution.

## KPI Definitions

### Spend

Meaning:
- total media cost for the scoped reporting window

Display:
- currency

Directionality:
- not inherently good or bad on its own
- interpretation depends on accompanying outcomes

### All KBAs

Meaning:
- total key buying actions for the scoped reporting window

Display:
- compact number

Directionality:
- higher is generally better

### BYO Starts

Meaning:
- quarter total BYO starts

Display:
- compact number

Directionality:
- higher is better

### BYO Completes

Meaning:
- quarter total BYO completes

Display:
- compact number

Directionality:
- higher is better

### Inventory Searches

Meaning:
- quarter total inventory-search activity used by this reporting model

Display:
- compact number

Directionality:
- higher is generally better

### Leads

Meaning:
- quarter total leads

Display:
- compact number

Directionality:
- higher is better

### Page Visits

Meaning:
- quarter total landing-page loads

Display:
- compact number

Directionality:
- higher is contextual and should be interpreted with channel traffic quality

### CPL

Meaning:
- cost per lead
- computed as `Spend / Leads`

Display:
- currency

Directionality:
- lower is better

### Lead Rate

Meaning:
- lead submission rate from BYO starts
- computed as `Leads / BYO Starts`

Display:
- percentage

Directionality:
- higher is better

### Impressions

Meaning:
- quarter total impressions

Display:
- compact number

Directionality:
- scale metric, not standalone quality metric

### CP KBA

Meaning:
- cost per key buying action
- computed as `Search + Social Spend / Search + Social All KBAs`

Display:
- currency

Directionality:
- lower is better

Special handling:
- zero-denominator paths must resolve safely
- non-Search and non-Social channel rows are excluded from this calculation

## KPI Display Expectations

The KPI scorecard should:
- show current scoped-quarter value
- show a comparison label where applicable
- use compact formatting for counts
- use currency formatting for cost metrics
- abbreviate currency KPIs at the scorecard level once values reach thousands, using compact `K`/`M` suffixes with two decimal places
- show two decimal places for non-compact currency KPIs such as `CP KBA`

The displayed `CP KBA` must reconcile to Search and Social quarter totals.

## Channel Card Metric Expectations

The channel-level media performance cards expose a deterministic summary block by card type.

Required metrics:
- Search and Social cards: `Total Spend`, `Total KBAs`, one scale metric, and `Cost Per KBA`
- Search uses `Clicks` as its scale metric
- Social uses `Impressions` as its scale metric
- Video uses `Total Spend`, `Impressions`, and `VCR`

Current rules:
- all displayed card metrics are quarter-scoped within the active Region/MACO/quarter selection
- `Cost Per KBA` on Search and Social cards is computed as channel spend divided by channel All KBAs
- lower `Cost Per KBA` deltas must render as favorable movement
- the previous two-metric card treatment is no longer the intended contract for current runtime behavior

## Delta and Tone Semantics

The runtime currently classifies KPI movement as:
- `positive`
- `negative`
- `neutral`

Interpretation depends on whether higher or lower is better.

Examples:
- more KBAs is positive
- lower CP KBA is positive
- no activity can be neutral
- new activity without a prior baseline can be treated as `New`

## Channel-Specific Primary Metrics

The insight layer does not use one universal narrative metric.

### Search and Social

Primary metric:
- usually `CPKBA`

Objective-sensitive alternative:
- `CTR` may be used for traffic-, click-, visit-, or landing-oriented objectives

### CTV and OLV

Primary metric:
- `VCR`

## Supporting Metrics

The insight layer may include a supporting metric when it adds context without diluting the primary claim.

Examples:
- if `CTR` is primary, `CPKBA` may be supporting
- if `CPKBA` is primary, `CTR` may be supporting

Supporting metrics must be finite if referenced.

## Share-Based Interpretation Terms

The current narrative model uses spend-share versus outcome-share framing.

Allowed semantic outcomes:
- `outperforming its share of investment`
- `performing broadly in line with its share of investment`
- `contributing fewer outcomes than its share of investment`

These phrases describe relative contribution, not causality.

## Chart Semantics

The combo chart uses month-level points to represent:
- spend
- All KBAs
- monthly CP KBA derived from Search and Social spend and KBAs only

The chart also exposes a benchmark value derived from the 2025 Search and Social chart window.

This benchmark is part of the derived-value audit surface and must reconcile to Search and Social chart-source totals.

## Reconciliation Expectations

The following values are especially important to reconcile:
- KPI `CP KBA`
- chart benchmark
- channel rollup totals versus scoped totals

When metric semantics change, these reconciliation expectations should be revisited.

## Blocking Conditions

Metric-bearing narrative should not render when:
- the metric is non-finite
- the denominator is invalid and no safe fallback exists
- the comparison basis is unavailable for directional language

## Output Expectations

This spec should keep terminology stable across:
- dashboard UI
- narrative insights
- QA messaging
- PDF export output

## Non-Goals

This file does not define:
- exact request flow
- narrative sentence templates
- QA threshold policy in detail
- raw datasource field inventory

## Code Touchpoints

Primary implementation touchpoints:
- `server/dashboardService.ts -> KPI_META`
- `server/dashboardService.ts -> buildYoyStatus()`
- `server/dashboardService.ts -> primaryMetricForChannel()`
- `server/dashboardService.ts -> chooseObjectiveMetric()`
- `server/dashboardService.ts -> supportingMetricForChannel()`
- `server/dashboardService.ts -> describeShareBalance()`
- `server/dashboardService.ts -> buildDashboardResponse()`
