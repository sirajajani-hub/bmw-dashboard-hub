# Data Pull and Execution Flow

Doc Type: Spec
Status: Source-of-truth for request flow and payload assembly behavior
Primary Code Owner: `server/dashboardService.ts`, `server/index.ts`, `server/tableauMcpClient.ts`, `src/pages/DashboardShell.tsx`
Last Reviewed: 2026-04-07

## Purpose

This document defines how the quarterly dashboard fetches, filters, assembles, and returns data.

Use this file when you need to:
- understand the end-to-end runtime path from UI to payload
- change filter behavior or default quarter behavior
- change datasource usage assumptions
- preserve payload assembly order during refactors
- align PDF export behavior with the main dashboard response

This file is about execution flow. It is not the place for narrative tone rules or detailed QA policy.

## Applies To

- dashboard UI request flow
- backend API request handling
- Tableau MCP datasource querying
- quarter and comparison-quarter selection
- payload assembly for dashboard rendering
- PDF export behavior that reuses the dashboard API

## Runtime Source of Truth

Implementation touchpoints:
- `src/pages/DashboardShell.tsx`
- `server/index.ts`
- `server/dashboardService.ts`
- `server/tableauConfig.ts`
- `server/tableauMcpClient.ts`
- `scripts/export_dashboard_pdf.py`

## High-Level Flow

1. The frontend dashboard page loads.
2. The frontend requests `/api/dashboard/bmw` with scope parameters.
3. The Express route validates query parameters and checks the in-memory cache.
4. On cache miss, the route calls `buildDashboardResponse(...)`.
5. The backend resolves Tableau MCP configuration and datasource metadata.
6. The backend queries Tableau for filter options, monthly aggregates, and scoped detail rows.
7. The backend resolves current and comparison quarters.
8. The backend derives KPIs, charts, summaries, drivers, insights, and QA checks.
9. The backend returns a single JSON payload.
10. The frontend renders the deck from that payload.
11. The PDF export script, when used, calls the same API and formats the returned payload into a report.

Tableau MCP request behavior:
- Tableau tool calls are serialized through `server/tableauMcpClient.ts`
- if a tool call returns the normalized Tableau MCP 401 authentication error, the client should close and reset the stdio MCP connection, then retry that same tool call once before surfacing the error to the route
- non-auth Tableau errors should not be retried by this layer

## Frontend Request Flow

### Entry Point

The frontend dashboard shell is responsible for initiating the data pull.

Expected behavior:
- initialize default UI state
- construct request parameters from selected Region, MACO, and quarter selectors
- call the backend API on load and when those selectors change
- store the returned payload for rendering

### Request Parameters

Current request parameters:
- `region`
- `maco`
- `currentQuarter`
- `comparisonQuarter`

Rules:
- `region` and `maco` are always sent from current selector state
- quarter parameters are only sent when the UI has explicit selected values
- if quarter values are not provided, the backend resolves defaults

### Frontend Error Handling

The frontend should:
- treat non-OK API responses as dashboard errors
- surface backend error text when available
- avoid partial rendering of stale payloads when a request fails
- clear the last successful payload when a new scoped request starts so scope changes cannot leave stale KPI, appendix, or insight data visible under a failed fetch state

### Frontend State Normalization

After response:
- if returned `availableMacos` does not include the currently selected MACO, reset to `ALL MACOS`
- if the UI has not explicitly chosen a current or comparison quarter yet, render the backend-resolved quarter defaults from the returned payload filters
- once the user explicitly changes a quarter selector, keep subsequent requests driven by that explicit local selection

This makes the backend the final authority for legal filter combinations.

## Backend Route Behavior

### Route

Current route:
- `GET /api/dashboard/bmw`

### Parameter Handling

The route should:
- read `region`, `maco`, `currentQuarter`, and `comparisonQuarter` from query parameters
- treat empty strings as undefined
- pass normalized values into `buildDashboardResponse(...)`

### Cache Behavior

The route currently uses a short-lived in-memory cache.

Cache key shape:
- `region::maco::currentQuarter::comparisonQuarter`

Rules:
- cached payloads are reused only when the full cache key matches
- cache TTL is 5 minutes
- cache is in-process only and resets with server restart
- the API payload includes `fetchedAt`, which records when the current payload instance was built after Tableau queries completed; cached responses reuse that same timestamp until expiry or restart

### Optional Timing Instrumentation

For local latency diagnosis, the server may be started with:
- `DASHBOARD_TIMING=true`

When enabled:
- the API route logs total request duration and whether the response was a cache hit or miss
- dashboard payload assembly logs stage timings for option queries, monthly queries, detail queries, and insight rewrite time
- timing logs are diagnostic only and do not change the payload contract

### Error Behavior

If payload construction fails:
- log the error on the server
- return status `500`
- return an error message suitable for frontend display

## Tableau MCP Configuration and Client

### Configuration

The backend resolves Tableau MCP runtime settings from:
- environment variables
- fallback config in `~/.codex/config.toml`

Required runtime values:
- MCP command
- PAT name
- PAT value
- Tableau server
- Tableau site name

### Datasource Ownership

Datasource identity is defined in backend config, not in the frontend.

Current known datasource usage:
- the dashboard app currently points to the V1 FV published datasource
- the configured published datasource name is `[INT] DS_BMW_USA_Media_Unified Platform Data_V1 FV`
- the configured published datasource LUID remains `ad57247f-1dab-4467-9c99-a038ab3e0e3d`
- datasource identity is treated as a runtime contract for payload generation

### MCP Client Behavior

The MCP client should:
- connect lazily
- reuse a single client connection when possible
- serialize tool requests through a request queue
- parse Tableau tool responses as JSON
- surface readable errors when Tableau returns non-JSON or authentication failures

## Tableau Query Sequence

The dashboard does not fetch raw workbook views for the main payload. It queries the datasource through Tableau MCP.

### Query 1: Filter Options

Purpose:
- populate Region and MACO availability
- constrain legal scope selections

### Query 2: Monthly Aggregate Data

Purpose:
- build available quarter list
- build current and prior totals
- build KPI cards
- build monthly chart points
- support benchmark calculations

Expected monthly fields include:
- Spend
- All KBAs
- BYO Starts
- BYO Completes
- Inventory Searches
- Leads
- Impressions

### Query 3: Quarter-Scoped Detail Data

Purpose:
- build channel summaries
- build driver analysis
- build appendix rows
- build narrative insights
- run QA checks on scoped rows

Expected detail shape includes:
- Region
- MACO
- CPO Categorization
- Channel
- Platform
- Campaign
- Month
- Spend
- All KBAs
- Page Visits
- Leads
- Impressions

Media card grouping rule:
- the `platformSpend` bars in media-spend performance cards should group spend by the scoped `Platform` dimension
- raw `Platform` value `Zeta` should be labeled and grouped as `Programmatic` across dashboard output
- the Video card should use a mixed grouping rule for its spend bars: if `Platform` is `YouTube` or `YouTube TV`, use `Platform`; otherwise group by `Channel`
- the Video card should not switch to publisher or video-entity grouping for that chart

Optional detail fields may also be requested when supported:
- Site Name
- Campaign / Placement Type
- Funnel Stage
- OptimizeTo
- VCR
- Video Completes

Current runtime note:
- the dashboard datasource currently rejects `Site Name` and `Rate - Video Completion (VCR)` in the detail-query shape used by `/api/dashboard/bmw`
- the server avoids requesting those two fields in the initial detail pull to prevent repeated Tableau validation retries on every cold request
- downstream insight logic must continue to tolerate missing `Site Name` and `VCR` values and fall back to the remaining scoped fields

For `CTV` / `Connected TV/OTT` and `OLV` / `Online Video`, `Site Name` is required for delivery naming. If `Site Name` contains `DV360`, `Placement Type` is required as the display fallback for delivery entities.
- Video Plays
- Clicks

Optional post-processing:
- after deterministic insight selection, the backend may run an OpenAI rewrite pass across all rendered `Key Observation` bullets
- this rewrite pass may refine phrasing only; it must not change selected entities, metrics, approved numbers, comparison basis, or section membership
- invalid rewrites fall back to the deterministic bullet before the payload is returned

### Validation Fallback for Optional Fields

If Tableau rejects optional detail fields:
- the backend removes unsupported optional fields
- the backend retries the query
- required payload assembly continues with the supported subset

## Scope Resolution

### Scope Inputs

Primary scope dimensions:
- Region
- MACO
- current quarter
- comparison quarter

### Scope Filters

The backend builds scope filters with the following business assumptions:
- Tier is always constrained to `Tier 2`
- `CPO Categorization` is always constrained to `New Car`
- Region is required for scoped reporting
- MACO is optional; `ALL MACOS` means region-wide scope

This means:
- `CPO Categorization` is part of the runtime query contract, not an optional presentation-layer filter
- option discovery, monthly aggregation, quarter-scoped detail pulls, and region rollups all inherit the same `New Car` constraint

## Channel Card Assembly

The channel media performance cards are assembled from quarter-scoped channel aggregates plus comparison-quarter channel aggregates.

Current metric block contract:
- `Total Spend`
- `Total KBAs`
- `Impressions`
- `Cost Per KBA`

Current behavior:
- the right-side channel summary panel is a fixed four-metric block
- `Impressions` is quarter-scoped and compared against the prior quarter comparison basis
- `Cost Per KBA` is derived at the channel level using spend divided by All KBAs for the same scoped rows

### Region and MACO Resolution

Rules:
- if the requested Region is invalid, fall back to the first valid Region
- if the requested MACO is invalid for the selected Region, fall back to `ALL MACOS`

## Quarter Selection Logic

### Quarter Discovery

Available quarters are derived from returned monthly aggregate rows.

Rules:
- quarter labels are generated from month dates
- available quarters are sorted newest-first
- the backend, not the frontend, decides valid quarter options

### Default Current Quarter

If no valid explicit current quarter is supplied:
- use the latest complete quarter when available
- otherwise fall back to the newest available quarter

### Default Comparison Quarter

If no valid explicit comparison quarter is supplied:
- prefer the same quarter from the prior year
- otherwise fall back to another available quarter that is not the current quarter
- otherwise reuse the current quarter only as a final fallback

### Quarter Windows

Quarter windows are resolved into date ranges and used to filter detail rows.

## Payload Assembly Order

After datasource queries succeed, the backend assembles the response in this order:
1. datasource metadata
2. scope metadata
3. period metadata
4. available filters
5. KPI totals and deltas
6. combo chart points and benchmark
7. media spend and performance cards
8. channel summary
9. positive and negative drivers
10. efficiency drivers
11. appendix rows
12. insights
13. QA checks
14. fetch timestamp

This order matters because later layers depend on earlier derived outputs:
- insights depend on scoped detail rows
- optional insight rewrite depends on deterministic insight bullets
- QA depends on totals, chart points, and insight audit metadata
- frontend assumes one assembled payload instead of multiple incremental fragments

Combo chart window:
- the monthly Spend / All KBAs and Cost Per KBA chart series should include fixed monthly points from January 2025 through June 2026
- the fixed chart range is presentation-oriented and independent from the selected current/comparison quarter filters used for KPI, media-card, appendix, and insight calculations

Current insight rewrite behavior:
- the backend must run a post-processing rewrite stage after `buildInsights()`
- current implementation scope includes all rendered insight bullets, including `variance`, `quarterLearnings`, `delivery`, `campaignDelivery`, `optimizations`, and `recommendations`
- rewrite validation must preserve deterministic metric labels, approved numbers, and comparison basis
- when a deterministic bullet includes both `KBAs` and `CPKBA`, rewrite validation must preserve both metric references before the payload is returned
- rewrite failure must fail the request; the backend must not silently fall back to deterministic bullets
- rewrite requires `OPENAI_API_KEY`; if it is missing, `/api/dashboard/bmw` is considered misconfigured and should return an error

Frontend quarterly-summary assembly:
- after the payload is returned, the dashboard UI builds the top `Key Quarterly Takeaways` list from channel `quarterLearnings` bullets
- the summary order is presentation-only and does not change backend insight section membership

## Master vs Split Deck Behavior

The payload supports two reporting modes:
- master deck view when `selectedMaco = ALL MACOS`
- split deck view when a specific MACO is selected

Behavior difference:
- when a specific MACO is selected, some comparison structures may use both scoped detail and broader Region detail
- scope titles and subtitles should reflect whether the view is master or split

## PDF Export Path

The PDF export flow is not an independent Tableau extraction path.

Rules:
- the PDF export script calls the same dashboard API endpoint
- it reuses the assembled backend payload
- it formats the payload into a PDF report

This means:
- dashboard API behavior changes can affect PDF export behavior
- the API payload is the shared reporting contract for both browser view and PDF output

## Output Expectations

The dashboard backend should return one coherent JSON payload that is sufficient to render:
- filters
- KPI scorecard
- charts
- summaries
- insights
- QA posture
- appendix content

The frontend should not need to make additional datasource requests to complete the quarter deck view.

## Media Spend Card Assembly

The Media Spend and Performance block is assembled as a deterministic ordered list of cards.

Current required order:
1. `Social`
2. `Campaign`
3. `Search`
4. `Video`

The `Campaign` card is a custom card inserted into the media card list during payload assembly.
Rules:
- the `Campaign` card must only include rows where normalized `Channel = social`
- the intended filter dimension is `Campaign Sub-Category (T2 Reporting Only)`
- runtime normalization may fall back through `Campaign Sub-Category (T2 Reporting Only)`, `Campaign (T2 Reporting Only)`, then `Campaign`
- the current required campaign members are `Military`, `Tesla Conquesting`, and `Lexus Conquesting`
- `Consideration` must be excluded from this card
- synthetic grouped labels such as `Conquesting` must not be rendered
- the card must display bar chart values by campaign member plus `Total Spend`, `Impressions`, and `Cost Per KBA`
- takeaway bullets may summarize active campaign buckets, but chart labels must remain exact Tableau member names

Current shell rendering behavior:
- the payload still includes separate `Social` and `Campaign` cards in the ordered card list
- the dashboard shell renders the `Campaign` card as an embedded subsection inside the `Social` section
- the embedded subsection title must render as `Social Campaigns`
- the shell must not render a second standalone campaign article beneath the social card
- the main `Social` section should render Social platform takeaways only
- the embedded `Social Campaigns` subsection should render campaign takeaways only, with the takeaways header labeled `Key Campaign Takeaways`
- the embedded `Social Campaigns` subsection should replace the right-side KPI tile area with the `Key Campaign Takeaways` list instead of rendering duplicate campaign KPIs
- Social platform and campaign entries with `$0` spend must be excluded from the Social card and embedded `Social Campaigns` subsection
- after the standalone `Video` card, the shell should render an empty `Learnings & Recommendations` section using the same visual section structure as the top `Key Quarterly Takeaways` block, with only the title populated and three times the top block's minimum height

Card metric rules:
- Search card summary metrics must display `Clicks` instead of `Impressions`
- Search card `Clicks` must use the quarter-scoped summed `Clicks` value from the dashboard payload, not a relabeled impressions total
- Search card `Key Channel Takeaways` must begin with the Search channel `delivery` bullets so the block shows one platform-delivery bullet per in-scope Search platform
- Search and Social platform-delivery takeaway bullets should be ordered by current-quarter spend share, highest to lowest
- after the Search platform bullets, the card should continue rendering the existing Search `campaignDelivery` bullets so the prior campaign-takeaway behavior is preserved
- Social and Campaign summary metrics continue to display `Impressions`
- `Cost Per KBA` delta coloring must treat lower values as favorable
- the embedded `Social Campaigns` chart must include all active social campaign members in scope; do not whitelist only selected campaign names
- active social campaign members means campaign groups with spend greater than `$0`; zero-spend campaigns must not render in the chart or takeaways
- the current allowed Social Campaigns labels are `Sedan Low`, `Sedan High`, `SAV Low`, `SAV High`, `EV`, and `Military`
- social campaign labels outside that allowlist must be excluded from the embedded chart and `Key Campaign Takeaways`
- the embedded `Key Campaign Takeaways` list should render one grounded bullet for each allowed Social campaign that remains in scope after spend filtering, ordered from highest spend to lowest spend
- embedded Social campaign takeaways must aggregate each campaign label across all social platforms; do not emit separate bullets for the same campaign by platform

Operational note:
- the route uses a 5-minute in-memory cache, so campaign-card order, field-source, and member updates may not appear until cache expiry or backend restart

Appendix table behavior:
- appendix rows must expose the same metric set for both the selected current quarter and the selected comparison quarter
- appendix title should render as `Performance by Platform`
- appendix should not render the hierarchy helper label above the table
- appendix rows should label and group raw `Zeta` platform data as `Programmatic`
- appendix platform rows should render only when current-quarter spend for that `channel + platform` row is greater than `$0`
- appendix rows should omit `Display` / `Digital Display` channel rows, including platform rows and channel subtotals
- channel subtotal rows and the grand total row must include both quarter columns and reconcile to their scoped quarter totals
- appendix metric columns should be ordered in side-by-side pairs by metric, so each current-quarter value sits immediately beside the corresponding comparison-quarter value
- the appendix should fit within the desktop deck view without horizontal scrolling; prefer compact paired metric cells over a separate `Campaign Managed By` column
- appendix paired metric cells should present current and comparison values as stacked, labeled lines to avoid truncation and keep the table readable at desktop width
- each appendix paired metric cell should also show the percent difference between current and comparison values

## Blocking Conditions

The flow is blocked when:
- Tableau MCP runtime configuration is missing
- Tableau authentication fails
- datasource queries fail without recoverable fallback
- no usable scope can be resolved
- payload assembly throws an unrecoverable error

## Non-Goals

This file does not define:
- insight tone or sentence templates
- detailed QA check semantics
- KPI formula math in full detail
- datasource field-by-field inventory
- Tableau calc governance policy

## Code Touchpoints

Primary implementation touchpoints:
- `src/pages/DashboardShell.tsx` -> request construction and state sync
- `server/index.ts` -> route, parameter handling, cache, API response
- `server/dashboardService.ts` -> query orchestration, scope resolution, quarter selection, payload assembly
- `server/tableauConfig.ts` -> datasource and MCP runtime config
- `server/tableauMcpClient.ts` -> MCP connection, request queue, auth retry, response parsing
- `scripts/export_dashboard_pdf.py` -> API reuse for PDF generation

## Change Checklist

Before changing this flow, confirm:
- does the change alter request parameters?
- does it change which datasource is authoritative?
- does it change quarter default behavior?
- does it change cache behavior?
- does it alter the API payload contract?
- does it affect PDF export behavior?
- does a corresponding runtime code map update need to be made?
