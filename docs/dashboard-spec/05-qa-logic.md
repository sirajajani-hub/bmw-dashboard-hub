# QA Logic

Doc Type: Spec
Status: Source of Truth
Primary Code Owner: `server/dashboardService.ts`
Primary Runtime Touchpoint: `buildQaChecks()`
Last Reviewed: 2026-04-07

## Purpose

This file defines the QA behavior for the quarterly dashboard response.

It exists to document:
- what the dashboard validates before presenting a quarter payload
- what each QA check means in business terms
- what thresholds and warning rules currently apply
- how narrative evidence and grounding affect QA posture

This file is source-of-truth for QA behavior changes. If the desired QA behavior changes, update this file first, then update code.

## Applies To

- API payload returned by `/api/dashboard/bmw`
- quarterly deck view in the dashboard UI
- export workflows that consume the same payload
- insight rendering quality gates tied to evidence and finite metric values

## Non-Goals

This QA layer does not:
- replace upstream datasource QA
- guarantee business causality
- validate every raw Tableau field independently
- act as a full testing framework
- persist historical QA runs as a long-term audit log

## Status Model

The current runtime status values are:
- `PASS`
- `WARN`

The current TypeScript implementation does not expose a separate `FAIL` state in the dashboard payload.

Interpretation:
- `PASS` means the check condition met the expected threshold or validation rule
- `WARN` means the condition did not meet the expected rule, but the dashboard still returned a payload

## Inputs

The QA layer evaluates the transformed reporting payload, not just raw source pulls.

Primary inputs:
- current-quarter scoped detail rows
- comparison-quarter scoped detail rows
- selected Region
- selected MACO
- scoped `CPO Categorization` values from detail rows
- current quarter metadata
- comparison quarter metadata
- quarter totals
- channel rollup totals
- KPI cards
- chart points
- channel summary
- insight audit counters

## Check Catalog

### `required-fields`

Purpose:
- confirm required scoped dimensions and measures are present and usable

Checks:
- required dimensions present: `Region`, `MACO`, `Channel`, `Platform`, `Campaign`, `Month`
- required measures finite: `Spend`, `All KBAs`, `Inventory Searches`, `Leads`, `Impressions`

PASS when:
- at least one detail row exists
- every scoped row satisfies required-field completeness and finite metric checks

WARN when:
- one or more required dimensions are missing
- one or more required measures are non-finite
- no scoped rows are available

### `quarter-window`

Purpose:
- confirm scoped rows fall into the requested current or comparison quarter windows

PASS when:
- every current-quarter row maps to the selected current quarter
- every comparison-quarter row maps to the selected comparison quarter

WARN when:
- any scoped row falls outside the intended reporting window

### `strict-tier`

Purpose:
- enforce exact scope alignment for Region and optional MACO

PASS when:
- every scoped row matches the selected Region
- if a specific MACO is selected, every scoped row also matches that MACO exactly

WARN when:
- any row leaks outside the selected Region or selected MACO scope

### `cpo-categorization`

Purpose:
- enforce exact scope alignment for the hard runtime `CPO Categorization` constraint

PASS when:
- every scoped row matches `CPO Categorization == New Car`

WARN when:
- any scoped row falls outside `CPO Categorization == New Car`
- scoped detail rows do not carry the expected categorization value

### `reconciliation`

Purpose:
- compare channel rollup totals against quarter totals

Measures checked:
- `Spend`
- `KBAs`

Current tolerance:
- `0.5%`

PASS when:
- absolute variance for both Spend and KBAs is less than or equal to `0.5%`

WARN when:
- either measure exceeds `0.5%` variance

### `null-audit`

Purpose:
- detect blank business dimensions in the scoped current-quarter detail

Current dimensions audited:
- `Channel`
- `Campaign`

PASS when:
- no scoped current-quarter rows have blank `Channel` or blank `Campaign`

WARN when:
- one or more scoped current-quarter rows have blank `Channel` or `Campaign`

### `divide-by-zero`

Purpose:
- confirm safe math behavior for efficiency-style calculations

Checks:
- zero-KBA detail rows do not produce non-finite values
- zero-KBA Search and Social rows do not produce non-finite values
- current-quarter quarter-level `CP KBA` remains finite using Search and Social totals
- comparison-quarter quarter-level `CP KBA` remains finite using Search and Social totals

PASS when:
- all relevant derived values remain finite under zero-denominator conditions

WARN when:
- any derived value becomes non-finite

### `insight-evidence`

Purpose:
- ensure rendered narrative bullets are supported by scoped evidence

PASS when:
- `groundedBulletCount == renderedBulletCount`
- at least one rendered bullet exists

WARN when:
- one or more rendered bullets lack evidence coverage
- no grounded rendered bullet set exists

### `claim-reconciliation`

Purpose:
- ensure metric-bearing narrative statements reconcile to finite computed values

PASS when:
- `metricClaimCount == reconciledMetricClaimCount`
- at least one metric-bearing narrative claim exists

WARN when:
- any metric-bearing bullet contains a non-reconciled metric value
- no reconciled metric-bearing narrative exists

### `derived-value-audit`

Purpose:
- verify visible derived values reconcile to source totals

Current derived values audited:
- KPI `CP KBA`
- chart benchmark value derived from the 2025 Search and Social chart window

PASS when:
- displayed derived values reconcile exactly within current runtime tolerance

WARN when:
- one or more displayed derived values does not reconcile to Search and Social source totals

UI tone parity rule:
- rendered quarter-learning and insight-summary highlighting must respect metric semantics, not only generic direction words
- `CP KBA` / `CPKBA` increases are unfavorable and should not render with positive green emphasis
- mixed bullets that contain both positive volume movement and negative `CPKBA` movement must preserve those distinct tones at render time
- the synthetic `Spend Trend` summary bullet must inherit the same direction-aware numeric emphasis used by other summary bullets

### `empty-evidence-blocking`

Purpose:
- confirm unsupported narrative content was blocked before render
- Social campaign evidence checks must use the same approved campaign label source as Social insight aggregation so supported bullets are not blocked due to raw-campaign label mismatches

PASS when:
- rendered bullets equal grounded bullets
- unsupported bullets and empty sections were suppressed correctly

WARN when:
- unsupported bullets or empty sections were not blocked as expected

### `deck-completeness`

Purpose:
- confirm major reporting sections populated

Current proxy:
- `channelSummary.length > 0`

PASS when:
- channel summary is populated and the deck can assemble its major sections

WARN when:
- one or more major sections appear effectively empty

## Thresholds

Current thresholds and strictness:
- reconciliation tolerance: `0.5%`
- blank-dimension tolerance for audited fields: `0`
- out-of-window row tolerance: `0`
- Region/MACO scope leakage tolerance: `0`
- `CPO Categorization` scope leakage tolerance: `0`
- divide-by-zero non-finite tolerance: `0`

## Evidence And Grounding Rules

Narrative QA depends on the insight grounding layer.

A candidate bullet is considered grounded only if:
- the bullet text exists
- the bullet has supporting evidence rows
- every attached metric value is either null-allowed or finite

A bullet is blocked if:
- text is empty
- evidence count is `0`
- any required metric value is non-finite

A section may be blocked if:
- all candidate bullets were suppressed
- no grounded bullets remain after evidence filtering

## Output Expectations

The dashboard payload should expose:
- a flat list of QA checks
- `id`
- `label`
- `status`
- `detail`

The UI may summarize QA as:
- total checks
- warning count
- pass count
- grounding-specific warning count

## Current Limitations

Known limitations of the current runtime QA model:
- no separate `FAIL` status
- deck completeness uses a narrow proxy
- null audit is limited to selected dimensions
- QA results are request-time only, not historically persisted
- QA evaluates transformed output, not every upstream field independently

## Change Rules

If a QA behavior change is desired:
1. update this spec first
2. update `server/dashboardService.ts`
3. verify the UI still reflects the intended semantics
4. update the runtime code map if code ownership changes

## Code Touchpoints

Primary runtime implementation:
- `server/dashboardService.ts -> buildQaChecks()`
- `server/dashboardService.ts -> buildDashboardResponse()`
- `src/pages/DashboardShell.tsx -> QA posture and QA section rendering`

Related supporting behavior:
- insight grounding and audit counters inside `server/dashboardService.ts -> buildInsights()`
