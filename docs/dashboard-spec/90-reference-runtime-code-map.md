# Runtime Code Map

Doc Type: Reference
Status: Reference Only
Last Reviewed: 2026-04-07

## Purpose

This file maps dashboard spec documents to the current owning runtime code paths.

Use this file to:
- find the implementation behind a spec
- understand where behavior changes must be applied in code
- reduce doc-to-code drift
- onboard future refactors safely

This file is reference-only. It does not define behavior.

## Primary Runtime Files

Core runtime files:
- `server/dashboardService.ts`
- `server/index.ts`
- `server/tableauMcpClient.ts`
- `server/tableauConfig.ts`
- `src/pages/DashboardShell.tsx`
- `scripts/export_dashboard_pdf.py`

## Spec To Code Ownership Map

### `README.md`

Purpose:
- doc-system contract and doc-first workflow orientation

Primary runtime relevance:
- no single behavior owner
- governs how future spec changes should map into code

### `00-product-overview-prd.md`

Primary runtime relevance:
- orientation only

Reference touchpoints:
- `server/dashboardService.ts`
- `src/pages/DashboardShell.tsx`
- `src/pages/DashboardSelection.tsx`

### `01-business-context-prd.md`

Primary implementation relevance:
- informs deck scope, framing, and reporting intent

Primary runtime touchpoints:
- `server/dashboardService.ts -> buildDashboardResponse()`
- `src/pages/DashboardShell.tsx`

### `02-terminology-and-metrics.md`

Primary implementation relevance:
- KPI semantics
- display semantics
- metric directionality
- channel-specific primary metric behavior

Primary runtime touchpoints:
- `server/dashboardService.ts -> KPI_META`
- `server/dashboardService.ts -> buildYoyStatus()`
- `server/dashboardService.ts -> buildDashboardResponse()`
- `src/pages/DashboardShell.tsx -> MediaSpendPerformanceCardView()`

### `03-data-pull-and-execution-flow.md`

Primary implementation relevance:
- request flow
- Tableau pull
- scope and quarter resolution
- payload assembly
- export path

Primary runtime touchpoints:
- `src/pages/DashboardShell.tsx -> loadDashboard()`
- `server/index.ts -> /api/dashboard/bmw`
- `server/dashboardService.ts -> buildDashboardResponse()`
- `server/dashboardService.ts -> buildScopeFilters()`
- `server/dashboardService.ts -> fetchDetailRows()`
- `server/dashboardService.ts -> fetchDetailRowsForQuarters()`
- `server/dashboardService.ts -> optional stage timing logs when DASHBOARD_TIMING=true`
- `server/tableauMcpClient.ts -> callTableauTool()`
- `server/tableauConfig.ts -> resolveTableauMcpConfig()`
- `scripts/export_dashboard_pdf.py -> fetch_dashboard_payload()`

### `04-insights.md`

Primary implementation relevance:
- insight section structure
- bullet selection
- evidence gating
- quarter learnings
- recommendation and action behavior
- narrative helpers
- tone and non-speculative language guidance

Primary runtime touchpoints:
- `server/dashboardService.ts -> buildInsights()`
- `server/dashboardService.ts -> entityLabelForInsight()`
- `server/dashboardService.ts -> campaignLabelForInsight()`
- `server/dashboardService.ts -> primaryMetricForChannel()`
- `server/dashboardService.ts -> chooseObjectiveMetric()`
- `server/dashboardService.ts -> supportingMetricForChannel()`
- `server/dashboardService.ts -> describeShareBalance()`
- `server/dashboardService.ts -> compareInsightMetric()`
- `server/dashboardService.ts -> hasMeaningfulInsightMetricSpread()`

UI consumers:
- `src/pages/DashboardShell.tsx -> insights rendering`

### `05-qa-logic.md`

Primary implementation relevance:
- QA check catalog
- thresholds
- PASS and WARN semantics
- evidence and grounding-driven QA posture

Primary runtime touchpoints:
- `server/dashboardService.ts -> buildQaChecks()`
- `server/dashboardService.ts -> buildInsights()` audit counters used by QA
- `server/dashboardService.ts -> buildDashboardResponse()`
- `src/pages/DashboardShell.tsx -> QA posture summary and QA list rendering`

### `06-doc-to-code-workflow.md`

Primary implementation relevance:
- governs change process, not runtime behavior directly

## Supporting Runtime Responsibilities

### `server/index.ts`

Owns:
- API route entry point
- request parsing
- cache key generation
- 5-minute in-memory caching
- error response shape
- optional request-level timing logs when `DASHBOARD_TIMING=true`

### `server/tableauConfig.ts`

Owns:
- Tableau runtime configuration resolution
- datasource identity used by the app
- current BMW datasource binding: `[INT] DS_BMW_USA_Media_Unified Platform Data_V1 FV` (`ad57247f-1dab-4467-9c99-a038ab3e0e3d`)
- server, site, and PAT configuration expectations

### `server/tableauMcpClient.ts`

Owns:
- MCP client connection
- tool invocation
- request serialization
- response parsing
- plain-text error handling

### `src/pages/DashboardShell.tsx`

Owns:
- dashboard payload fetch from the browser
- selected Region, MACO, currentQuarter, and comparisonQuarter request state
- UI rendering of KPI, QA, insights, filters, and the appendix comparison table

### `src/pages/DashboardSelection.tsx`

Owns:
- dashboard catalog search and tag filtering
- dashboard card ordering and launch navigation
- catalog card hero artwork treatment, including the deterministic per-card gradient variants

### `scripts/browser-smoke.mjs`

Owns:
- browser-level smoke verification of the dashboard shell against a running local frontend and API
- confirming the KPI section renders without dashboard API error banners or browser console/page errors
- the `npm run test:browser` validation path for changes that need live browser verification beyond `npm test`

### `scripts/export_dashboard_pdf.py`

Owns:
- PDF export path that consumes `/api/dashboard/bmw`
- document rendering from the already-built dashboard payload
- not direct Tableau querying

## Current Source Of Truth Boundary

Runtime source of truth for behavior:
- TypeScript code in `server/dashboardService.ts`

Human-facing source of truth for intended future behavior:
- spec docs under `docs/dashboard-spec/`

Reference-only explanatory layer:
- this file and other reference docs

## Known Couplings

Important current couplings:
- insights and QA are coupled through insight audit counters
- recommendation wording depends on channel-specific metric-selection helpers
- quarter comparison behavior depends on monthly query results and quarter resolution logic
- scope behavior depends on `buildScopeFilters()` applying the fixed `CPO Categorization = New Car` constraint
- export behavior depends on the same API payload returned to the dashboard UI

## Change Impact Heuristics

If you change:
- terminology or KPI semantics
  - inspect `KPI_META`, metric formatters, and metric helper functions
- insights behavior
  - inspect `buildInsights()` and its helper functions
- QA behavior
  - inspect `buildQaChecks()` and any insight audit dependencies
- data pull or scope logic
  - inspect `buildDashboardResponse()`, route handling, query builders, and MCP client/config files
