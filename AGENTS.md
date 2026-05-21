# BMW Tableau Hub Agent Guide

## Purpose

This repository contains the BMW Tableau Hub application:

- a React + Vite frontend for dashboard discovery and the BMW quarterly dashboard shell
- an Express API server that builds dashboard payloads from Tableau MCP data
- domain logic for KPI calculation, insight generation, QA checks, and manual insight overrides

Agents working in this repo should optimize for correctness of reporting logic and stability of the `/api/dashboard/bmw` payload contract.

## Stack

- Frontend: React 19, Vite 6, TypeScript, Zustand, React Router
- Server: Express, TypeScript, `tsx`
- Data access: Tableau MCP via stdio client in `server/tableauMcpClient.ts`
- Tests: Node test runner executed through `tsx --test`

## Primary Workflows

### Local development

Run the frontend and API in separate terminals:

```bash
npm install
npm run dev
npm run server
```

Frontend default URL:

- `http://localhost:3000`

API health check:

- `http://localhost:8787/api/health`

### Validation

Use these before finishing changes:

```bash
npm run lint
npm test
```

### Production build

```bash
npm run build
npm run preview
```

## Required Configuration

The server depends on Tableau MCP runtime configuration. Provide these either in the shell environment or in `~/.codex/config.toml`:

- `TABLEAU_MCP_COMMAND`
- `TABLEAU_PAT_NAME`
- `TABLEAU_PAT_VALUE`
- `TABLEAU_SERVER`
- `TABLEAU_SITE_NAME`

Optional insight rewrite settings:

- `OPENAI_API_KEY`
- `OPENAI_INSIGHT_REWRITE_ENABLED=true`
- `OPENAI_INSIGHT_REWRITE_MODEL`
- `OPENAI_INSIGHT_REWRITE_LOGGING`

If Tableau configuration is missing, the server will fail in `server/tableauConfig.ts`.

## Repository Map

### Frontend

- `src/App.tsx`: route registration
- `src/pages/BrandSelection.tsx`: brand entry flow
- `src/pages/DashboardSelection.tsx`: dashboard catalog and navigation
- `src/pages/DashboardShell.tsx`: quarterly dashboard shell UI
- `src/pages/AdminScreen.tsx`: config/admin surface
- `src/store.ts`: persisted UI and dashboard config state
- `src/types.ts`: shared app types

### Server

- `server/index.ts`: Express entrypoint and cache wrapper
- `server/dashboardService.ts`: Tableau queries, KPI aggregation, insight generation, QA logic, and API payload assembly
- `server/tableauConfig.ts`: Tableau MCP config resolution
- `server/tableauMcpClient.ts`: stdio MCP client wrapper
- `server/insightRewriteAgent.ts`: optional AI rewrite pass with validation
- `server/userInsights.ts`: manual insight override loading and versioning

### Specs and content

- `docs/dashboard-spec/`: business and implementation specs
- `docs/dashboard-spec/README.md`: dashboard spec index
- `docs/dashboard-spec/00-product-overview-prd.md`: product overview and high-level behavior
- `docs/dashboard-spec/01-business-context-prd.md`: business framing and dashboard purpose
- `docs/dashboard-spec/02-terminology-and-metrics.md`: approved terminology, KPI definitions, and metric meaning
- `docs/dashboard-spec/03-data-pull-and-execution-flow.md`: end-to-end data pull and runtime flow
- `docs/dashboard-spec/04-insights.md`: insight-generation behavior and narrative expectations
- `docs/dashboard-spec/05-qa-logic.md`: QA guardrails and validation logic
- `docs/dashboard-spec/06-doc-to-code-workflow.md`: documentation-to-code workflow guidance
- `docs/dashboard-spec/90-reference-runtime-code-map.md`: code-to-spec mapping for major runtime areas
- `docs/user-insights.json`: manual insight content source
- `docs/user-insights.md`: human-readable guidance for manual insight content

### Tests

- `server/dashboardService.test.ts`
- `server/userInsights.test.ts`

## Architecture Rules

### Keep Tableau access on the server

Do not add direct Tableau calls in the client. Tableau access should stay behind the Express API and `server/tableauMcpClient.ts`.

### Preserve the dashboard payload contract

`/api/dashboard/bmw` is the shared contract consumed by the dashboard shell. Avoid ad hoc payload changes. If you change the response shape, update:

- server types and builders
- frontend consumers
- tests
- the relevant dashboard spec files in `docs/dashboard-spec/`

### Prefer domain logic in `dashboardService.ts`

KPI math, channel grouping, insight generation, QA checks, and reporting period logic belong in `server/dashboardService.ts` unless there is a strong reason to factor them out.

### Treat manual insights as an override layer

Generated insight output can be selectively replaced by `docs/user-insights.json` via `server/userInsights.ts`. Do not hardcode one-off copy in the UI when it belongs in the override file.

### Browser state lives in Zustand

Persisted selection and dashboard catalog state should continue to use the existing Zustand stores in `src/store.ts`.

## Editing Guidance

### When changing frontend code

- preserve the existing route structure under `src/App.tsx`
- keep `DashboardShell` focused on rendering and interaction, not raw data shaping
- prefer using existing shared types rather than re-declaring payload fragments

### When changing backend code

- maintain deterministic output for KPI and insight helpers where possible
- favor pure helper functions for business logic so they remain easy to test
- keep cache behavior in `server/index.ts` simple and keyed by request-relevant filters

### When changing insight logic

- preserve channel-specific terminology rules already encoded in tests
- avoid introducing unsupported metrics into CTV or OLV copy
- keep validation in sync with rewrite behavior when AI rewrite logic changes

### When changing documentation

- treat `docs/dashboard-spec/` as supporting documentation, not the only source of truth
- every code edit that changes behavior, data flow, UI, terminology, QA logic, or architecture must be followed by updates to the relevant files in `docs/dashboard-spec/`
- work is not complete until code changes and corresponding dashboard spec updates are both done
- update the nearest matching spec files instead of appending vague notes to unrelated docs

## Repo-Specific Guardrails

- The PDF export workflow has been removed from this repo. Do not reintroduce export-only branches or generated PDF artifacts unless explicitly requested.
- Do not commit generated files under `output/pdf/` or `tmp/pdfs/`.
- Keep secrets out of the repo. PATs and API keys belong in environment config only.
- Avoid changing dashboard copy casually. Narrative text is part of reporting output and should be backed by tests or grounded rules.
- After every code edit, update the relevant dashboard spec files under `docs/dashboard-spec/` in the same workstream.

### Figma capture links

Use browser capture links instead of PDF export when handing dashboard designs to Figma.

Before generating or sending a capture link, ask the user which Figma design file should receive the capture. If they provide a Figma file URL, use that as the destination context. If they do not have one yet, ask whether they want to create a new Figma file or use an existing one before proceeding.

To generate a Figma capture link:

1. Start the API server with Tableau MCP configuration available:

```bash
npm run server
```

2. Start the frontend:

```bash
npm run dev
```

3. Use the dashboard shell URL as the capture target:

```text
http://localhost:3000/dashboards/shell
```

This URL is the capture link for the locally rendered dashboard shell. Open it in the browser, confirm the dashboard has finished loading, set any needed Region, MACO, current quarter, or comparison quarter controls, and then use the active browser page as the source for the Figma capture.

Important constraints:
- the dashboard shell currently stores Region, MACO, current quarter, and comparison quarter in React state, not in URL query parameters
- the URL above is the stable capture target for the default loaded dashboard state
- for a specific Region, MACO, or quarter view, open the shell locally, set the dashboard controls in the browser, wait for the API refresh to finish, then capture the rendered page
- do not recreate a PDF export path to support Figma handoff

## Testing Expectations

For changes to reporting logic, insight text, QA checks, filters, or payload shape:

1. Run `npm run lint`
2. Run `npm test`
3. Update the relevant dashboard spec files in `docs/dashboard-spec/`
4. Add or update tests in `server/dashboardService.test.ts` or `server/userInsights.test.ts` if behavior changed

For UI-only changes in `src/pages/`:

1. Run `npm run lint`
2. Update the relevant dashboard spec files in `docs/dashboard-spec/`
3. Smoke test the affected route locally if possible

## Good Agent Defaults

- Read the existing tests before changing reporting rules.
- Read the relevant dashboard spec files before changing reporting rules.
- Search for existing terminology before renaming channels, KPIs, or QA labels.
- Make the smallest change that preserves the reporting contract.
- Prefer fixing the source logic over patching rendered strings in the UI.
- Call out dirty-worktree conflicts before overwriting user changes.

## References

Useful starting points for orientation:

- `package.json`
- `docs/dashboard-spec/README.md`
- `docs/dashboard-spec/02-terminology-and-metrics.md`
- `docs/dashboard-spec/03-data-pull-and-execution-flow.md`
- `docs/dashboard-spec/04-insights.md`
- `docs/dashboard-spec/05-qa-logic.md`
- `docs/dashboard-spec/90-reference-runtime-code-map.md`
- `src/App.tsx`
- `src/store.ts`
- `server/index.ts`
- `server/dashboardService.ts`
- `server/dashboardService.test.ts`
