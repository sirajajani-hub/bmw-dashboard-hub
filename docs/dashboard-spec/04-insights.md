# Insights

Doc Type: Spec
Status: Source Of Truth
Scope: Quarterly dashboard insight generation and narrative behavior
Primary Code Touchpoint: `server/dashboardService.ts -> buildInsights()`
Related Code Touchpoints:
- `server/dashboardService.ts -> primaryMetricForChannel()`
- `server/dashboardService.ts -> chooseObjectiveMetric()`
- `server/dashboardService.ts -> supportingMetricForChannel()`
- `server/dashboardService.ts -> describeShareBalance()`
- `server/insightRewriteAgent.ts -> rewriteInsightChannels()`

## Purpose

This spec defines how the quarterly dashboard selects, structures, phrases, and suppresses insight content.

Use this file to govern:
- which insight sections are allowed
- how section bullets are selected
- how quarter learnings are formed
- how recommendation verbs are chosen
- what language and tone are allowed
- what evidence is required before a sentence can render

This file is a behavior spec, not a code dump. The dashboard implementation must follow this spec.

## Applies To

This spec applies to:
- channel-level insight sections in the quarterly dashboard payload
- deck-ready narrative statements derived from scoped quarter data
- recommendation and optimization language
- evidence-backed narrative suppression behavior

This spec does not define:
- datasource extraction mechanics
- KPI aggregation formulas outside their narrative use
- frontend layout or styling
- generic QA checks outside insight-grounding behavior

## Business Intent

The insight layer exists to do four things:
1. summarize what happened in the scoped quarter
2. identify material changes versus the comparison period
3. call out strong and pressured areas using evidence-backed language
4. translate performance shape into operational next steps

The insight layer must not:
- speculate about causality without evidence
- use promotional or exaggerated language
- render unsupported metric claims
- overfit to one channel with wording that does not generalize

## Inputs

The insight engine is expected to work from the assembled scoped reporting model, including:
- current-quarter detail rows
- comparison-quarter detail rows
- channel-level groupings
- platform or site-level groupings
- campaign-level groupings
- spend
- KBAs
- impressions
- clicks where available
- video completes and video plays where available
- VCR where available
- taxonomy- or objective-derived context such as funnel stage and optimize-to

The insight engine must operate after quarter scoping is resolved.

## Insight Section Model

### Allowed Sections

The allowed section set is:
- `delivery`
- `variance`
- `campaignDelivery`
- `quarterLearnings`
- `optimizations`
- `recommendations`

No additional section may render unless this spec is updated.

### Section Order

The required section order is:
1. `delivery`
2. `variance`
3. `campaignDelivery`
4. `quarterLearnings`
5. `optimizations`
6. `recommendations`

### Channel Order

The required channel order is:
1. `ctv`
2. `olv`
3. `search`
4. `social`

Social channel rendering note:
- the main Social card in the shell should consume `delivery` bullets so platform takeaways stay grouped under Social
- the embedded `Social Campaigns` subsection should consume `campaignDelivery` bullets so campaign takeaways do not remain in the parent Social `Key Channel Takeaways` block
- Social `delivery` bullets should include every active social platform in scope rather than truncating to only the top two platforms
- Social `delivery` bullets should be ordered from highest current-quarter spend share to lowest spend share
- when Social has current-quarter Meta and TikTok delivery with finite `CPKBA`, and TikTok `CPKBA` is lower than aggregated Meta `CPKBA`, append one platform-performance bullet comparing Meta `CPKBA`, TikTok `CPKBA`, and TikTok's relative efficiency gap
- `delivery` bullets and embedded `campaignDelivery` bullets should append a comparison-quarter follow-on sentence when a comparable prior metric exists
- for `CPKBA`, the appended sentence should describe media-efficiency change versus the comparison quarter and include the current and prior metric values
- for `VCR`, the appended sentence should describe VCR movement versus the comparison quarter and include the current and prior metric values
- Social `campaignDelivery` bullets should include one grounded bullet per allowed in-scope Social campaign, ordered from highest spend to lowest spend
- Social `campaignDelivery` bullets should aggregate matching campaign labels across all social platforms before generating the takeaway text
- Social `campaignDelivery` bullets should not use investment-share narrative such as `outperforming its share of investment` or `in line with its share of investment`
- Social `campaignDelivery` bullets should not include `CTR`; they should stay focused on spend share, KBA share, `CPKBA`, and any comparison-quarter efficiency sentence
- `Military` is an allowed Social campaign label and should render in `campaignDelivery` when present in source rows and spend is greater than `$0`

Search channel rendering note:
- the main Search card in the shell should consume the Search channel `delivery` bullets first
- Search `delivery` bullets should include every in-scope Search platform instead of truncating to only the top two platforms
- after the Search platform bullets, the shell should continue with the Search `campaignDelivery` bullets so the campaign-takeaway narrative remains visible

Video card rendering note:
- the main Video card in the shell should consume only the `delivery` bullets from `CTV` / `Connected TV/OTT` and `OLV` / `Online Video`
- the Video card should not append `campaignDelivery`, `quarterLearnings`, `recommendations`, or `optimizations` bullets into its `Key Channel Takeaways` block
- Video-card takeaway commentary such as `remained stable`, `decreased`, or `improved` must come from the platform-level `VCR` comparison versus the selected comparison quarter
- Video-card `delivery` bullets must use the same grouping as the Video bar chart: if `Platform` is `YouTube` or `YouTube TV`, use `Platform`; otherwise use `Channel`
- Video-card `delivery` bullets should follow this shape: `% spend`, current-quarter `VCR`, comparison-quarter `VCR`, and `% diff`
- example: `Connected TV / OTT delivered 74.3% of spend; Q1 2026 VCR was 99.2% vs 98.8% in Q1 2025 (+0.4%).`

Display channel rendering note:
- `digital-display` is omitted from rendered insight channels

If a channel has no valid rendered sections, it may be omitted.

### Section Rendering Rule

A section may render only when it contains at least one grounded bullet.

A section must be suppressed when:
- all candidate bullets are empty
- all candidate bullets fail grounding rules
- required metrics for section meaning are unavailable
- the content would be redundant or misleading under the current scoped evidence

## Bullet Model

### General Bullet Rules

Every rendered bullet must:
- be evidence-backed
- use finite metric values where metrics are present
- remain specific to the scoped quarter or comparison window
- stay operational and concise
- avoid causal claims unless the input data explicitly supports them

Every candidate bullet may include:
- text
- evidence count
- supporting metric values

A bullet must be blocked when:
- text is empty
- evidence count is zero
- any required metric value is non-finite
- the claim depends on unavailable comparison context

### Bullet Count Guidance

Per section:
- `delivery`: up to 2 bullets
- `variance`: up to 2 bullets
- `campaignDelivery`: up to 3 bullets
- `quarterLearnings`: up to 3 bullets
- `optimizations`: up to 1 bullet
- `recommendations`: up to 2 bullets

The implementation may render fewer bullets if the evidence does not justify the maximum.

Social exception:
- the embedded `Social Campaigns` `campaignDelivery` section may exceed the default `3` bullet guidance so every allowed in-scope campaign receives a grounded takeaway bullet

### Manual Authoring Override

The dashboard also supports manual overrides for:
- `optimizations`
- `recommendations`

Authoring source:
- `docs/user-insights.json`

Rules:
- manual copy matches on `Region`, `MACO`, `Quarter`, and `Channel`
- matching manual sections replace generated copy
- omitted manual sections fall back to generated copy
- empty manual sections suppress render for that section

## Evidence Gating

### Grounding Requirements

A bullet is considered grounded only when:
- it maps to one or more supporting scoped rows
- every attached metric required for the sentence is finite
- the underlying claim is materially represented in the scoped data

Grounding must be applied before render.

### Materiality Expectations

Insight candidates should prefer materially meaningful entities. Materiality may be established through one or more of:
- meaningful spend share
- meaningful KBA share
- sufficient row count
- meaningful impression volume for video channels
- meaningful metric spread between best and weakest candidates

Low-signal entities should not produce standalone bullets unless they are the only valid scoped evidence for the section.

### Comparison Integrity

Any claim phrased as change, improvement, worsening, increase, or decrease must rely on a valid comparison basis:
- last month when that basis is explicitly chosen and available
- last year or prior-quarter window when that basis is explicitly chosen and available

If no valid comparison exists, the bullet must not imply directional change.

## Section-Specific Rules

### Delivery

Purpose:
- summarize where current-quarter delivery came from
- identify leading platforms, sites, or entities within a channel

Include when:
- current-quarter scoped data exists for the channel
- one or more entity groupings have meaningful share or meaningful primary metric values

Selection priority:
1. spend share
2. KBA share
3. better primary metric when tied or near-tied

Entity naming rules:
- use the most meaningful platform or site-level entity for the channel
- label raw `Platform` value `Zeta` as `Programmatic`
- for `CTV` / `Connected TV/OTT` and `OLV` / `Online Video`, use `Site Name` instead of ad-server labels such as `DV360` or `CM360`
- if the resolved `Site Name` contains `DV360`, use `Placement Type` instead
- do not output `DV360` or `CM360` as the named delivery entity for `CTV` / `Connected TV/OTT` and `OLV` / `Online Video`

Allowed output shape:
- `X delivered Y% of KBAs with a Z of N.`
- `X delivered 25% of KBAs with a CPKBA of $3.25`
- `For CTV / Connected TV/OTT and OLV / Online Video: use Site Name as X; if Site Name contains DV360, use Placement Type as X.`

### Variance

Purpose:
- summarize year-over-year movement for outcomes and efficiency with explicit current and prior values

Include when:
- a valid comparison-quarter basis exists
- the comparison metric is finite
- the movement is meaningful enough to report
- for `CTV` / `Connected TV/OTT` and `OLV` / `Online Video`, if current-period `VCR` is valid but prior-period `VCR` is unavailable, render a current-period fallback bullet instead of suppressing the section

Basis selection rule:
- use the comparison-quarter basis only
- do not render month-over-month variance bullets

Allowed output shape:
- `Overall Search KBAs increased 14.0% YoY to 240 from 210.`
- `CPKBA efficiency increased by 12.0% YoY to $45.10 from $51.25.`
- `VCR remained stable YoY at 84.0% vs 83.4%.`
- `Connected TV / OTT delivered a current-year VCR of 99.9%; Connected TV / OTT did not run in the comparison period.`

Direction rules:
- use `increased`, `flat` and `declined` for output totals and activity volumes
- use `efficiency increased`, `stable` and `efficiency decreased` for `CPKBA`
- for `CPKBA`, a lower value is favorable:
  `efficiency increased` means `CPKBA` decreased
  `efficiency decreased` means `CPKBA` increased
- use `improved`, `stable` and `decreased` for rate metrics

### Campaign Delivery

Purpose:
- describe campaign-level scale, strength, and pressure within the channel

Include when:
- campaign identity is present
- current-quarter spend or KBAs are present
- campaign-level performance is materially representative
- required primary metric is finite when referenced

Candidate types:
- one scale leader
- one strongest-performing campaign if spread is meaningful
- one pressured campaign if spread is meaningful

Selection rules:
- scale leader: prefer highest spend, then highest KBAs
- strongest campaign: prefer best primary metric under channel and objective logic
- pressured campaign: prefer weakest primary metric under channel and objective logic
- for `CTV` / `Connected TV/OTT` and `OLV` / `Online Video`, campaign delivery language must use `VCR` only; do not compare against `KBAs`, `total KBAs`, or `CPKBA`
- do not render funnel stage / optimize-to context like `(Awareness / Video Views)` inside key-observation bullets

Allowed output shape:
- `Campaign X accounted for A% of spend and B% of total KBAs...`
- `For CTV / Connected TV/OTT and OLV / Online Video: Campaign X accounted for A% of spend and delivered a VCR of N%.`
- `Campaign Y delivered the strongest efficiency at $N.`
- `Campaign Z delivered a higher cost per action at $N.`
- `For CTV / Connected TV/OTT and OLV / Online Video: Campaign Y delivered the strongest VCR at N%.`
- `For CTV / Connected TV/OTT and OLV / Online Video: Campaign Z delivered a low VCR of N%.`

### Quarter Learnings

Purpose:
- summarize channel performance against the selected comparison quarter in reusable deck-ready learnings without becoming speculative
- support the top-of-dashboard `Key Quarterly Takeaways` summary block

Include when:
- the channel has current-quarter delivery
- a comparison-quarter baseline exists for the reported metric, or the absence of that baseline is itself material
- there is enough evidence to support a channel-level comparison statement

Exclude when:
- the channel has insufficient scoped data
- the comparison is not meaningful and no baseline-absence statement is justified
- the sentence introduces campaign, platform, placement, or campaign-type detail
- the sentence is not clearly channel-level

Selection priority:
1. one channel-level summary sentence that leads with the channel KPI movement
2. for Search and Social, include both volume and `CPKBA` in the same bullet when both are available
3. the `KBAs` clause and the `CPKBA` clause must both preserve their original direction terms during any rewrite stage

Maximum:
- 1 bullet

Required content characteristics:
- summarize quarter-level channel movement, not entity-level detail
- stay tied to evidence
- avoid unsupported future promises
- support reuse in a client-facing quarterly deck

Allowed output shape:
- `Search KBAs increased 132.0% year over year, reaching 290 in Q1 2026 vs 125 in Q1 2025. CPKBA remained stable year over year at $57.59 in Q1 2026 vs $58.40 in Q1 2025.`
- `Social KBAs increased 21.1% quarter over quarter, reaching 378,383 in Q1 2026 vs 312,561 in Q4 2025. CPKBA efficiency decreased 39.8% quarter over quarter to $3.62 in Q1 2026 from $2.59 in Q4 2025.`
- `Social KBAs increased 17.6% year over year, reaching 694,938 in Q1 2026 vs 591,111 in Q1 2025. CPKBA efficiency decreased 32.9% year over year to $4.07 in Q1 2026 from $3.06 in Q1 2025.`
- `Connected TV / OTT VCR remained stable year over year at 76.5% in Q1 2026 vs 73.5% in Q1 2025.`

Forbidden output shape:
- promise business outcomes
- claim causal reasons without explicit evidence
- suggest strategic action directly unless the sentence is intentionally recommendation-form
- overstate weak or marginal differences
- mention campaign, platform, placement, publisher, or campaign-type entities

### Key Quarterly Summary Block

Purpose:
- assemble the top-of-dashboard `Key Quarterly Takeaways` list from channel-level quarter learnings plus one cross-channel spend-trend summary

Inputs:
- rendered channel `quarterLearnings` bullets
- channel summary spend totals, spend-share fields, and their comparison labels

Current runtime behavior:
- prefer the first `quarterLearnings` bullet from each rendered channel, ordered by highest current-quarter spend to lowest
- if the summary is short, backfill with additional `quarterLearnings` bullets before using lower-priority highlight sections
- when channel summary data is available, append a second sentence to each channel summary item that states the current-quarter share of total spend and the channel spend change versus the comparison quarter

Allowed output shape:
- `Connected TV / OTT: Connected TV / OTT VCR remained stable year over year at 99.2% in Q1 2026 vs 98.8% in Q1 2025. This represented 14.1% of total spend, with spend up 33% vs Q1 2025.`

Rules:
- derive spend movement from structured channel card spend metrics, not by parsing insight prose
- keep the bullet channel-level; do not introduce campaign, platform, or publisher detail
- preserve metric-direction color semantics for numeric emphasis inside the bullet
- derive channel spend commentary from structured `channelSummary` fields rather than from formatted display strings
- express spend movement as the same spend delta shown in the data table, not the change in spend share or percentage points

### Optimizations

Purpose:
- point to the most pressured campaign with enough spend or delivery weight to justify operational attention

Include when:
- a pressured campaign exists
- the pressured campaign has meaningful spend share or meaningful presence
- the primary metric indicates real performance pressure

Maximum:
- 1 bullet

Allowed output shape:
- `Optimize Campaign X..., which delivered N on metric Y while representing A% of spend.`

### Recommendations

Purpose:
- translate evidence-backed performance shape into a clear action verb and next-step direction

Allowed recommendation verbs:
- `Scale`
- `Hold`
- `Optimize`

Action selection rules:
- `Scale` when the entity is outperforming its share of investment or demonstrates meaningfully strong primary metric performance
- `Hold` when the entity is broadly in line with its share of investment or when evidence supports stability rather than expansion or correction
- `Optimize` when the entity contributes fewer outcomes than its share of investment or shows pressured primary metric performance

Allowed output shape:
- `Scale Platform / Campaign based on metric X of N and Y% of channel KBAs.`
- `Hold Platform / Campaign while monitoring whether outcome contribution stays aligned with spend share.`
- `Optimize Platform / Campaign based on metric X of N and pressure against spend share.`

## Narrative Helper Rules

### Primary Metric Selection

Search and Social:
- default to `CPKBA`
- may use `CTR` for traffic-, click-, visit-, or landing-oriented objectives

CTV and OLV:
- use `VCR`

If the preferred metric is not finite or not meaningful, the sentence must either:
- fall back to a valid alternative defined in code
- or be suppressed

### Supporting Metrics

Supporting metrics may be used when they add context without diluting the primary claim.

Examples:
- if primary metric is `CTR`, supporting metric may be `CPKBA`
- if primary metric is `CPKBA`, supporting metric may be `CTR`

Supporting metrics must be finite if referenced.

### Share-Balance Framing

The insight layer may use spend-share versus outcome-share framing with only the following semantic interpretations:
- `outperforming its share of investment`
- `performing broadly in line with its share of investment`
- `contributing fewer outcomes than its share of investment`

Alternative share-balance phrasing requires a spec change.

## Tone Rules

### Tone Standard

The required tone is:
- operational
- comparative
- evidence-backed
- restrained
- client-ready
- non-speculative

The tone must not be:
- promotional
- emotional
- vague
- causal without evidence
- inflated by unsupported superlatives

### Allowed Language

Allowed phrase patterns include:
- `the strongest efficiency`
- `a higher cost per action`
- `the strongest click-through rate`
- `a softer click-through rate`
- `the strongest completion rate`
- `a lower completion rate`
- `improved`
- `worsened`
- `increased`
- `decreased`
- `Scale`
- `Hold`
- `Optimize`

### Forbidden Language

Do not use:
- `guaranteed`
- `obviously`
- `clearly` unless evidence thresholds are explicitly defined elsewhere
- `best ever`
- `worst ever`
- `caused by`
- `because users preferred`
- `will definitely`
- `proves`
- `dominates`

### Confidence Rules

The insight layer may describe comparative strength or pressure only when the supporting metric spread is materially meaningful.

If the difference is marginal, the engine should prefer:
- suppression
- neutral framing
- or a more descriptive, less judgmental sentence

## Non-Speculative Guidance

The insight layer must not:
- infer why users behaved a certain way unless the data explicitly supports it
- attribute performance to creative, audience, budget, or external market factors without direct evidence
- promise future gains from scaling
- imply certainty from weak volume or low-signal slices

The only acceptable forward-looking phrasing is cautious and conditional.

Allowed example:
- `...indicating capacity to scale if that performance remains stable.`

Not allowed:
- `...and should scale immediately because it will outperform.`
- `...proving this campaign is the right long-term strategy.`

## Blocking Conditions

A bullet must be blocked when any of the following is true:
- no text candidate is available
- supporting row count is zero
- required metric values are non-finite
- comparison basis is invalid for a directional sentence
- metric spread is too weak for strength or pressure language
- the sentence would become speculative
- the sentence would duplicate another rendered bullet without adding meaning

A section must be blocked when all of its bullets are blocked.

## Output Expectations

The insight output must:
- be deterministic for the same input dataset
- preserve section and channel ordering
- suppress unsupported content rather than fill space
- remain consistent with KPI and QA expectations
- produce copy that can be reused in deck narratives with minimal editing

Mandatory rewrite stage:
- the dashboard must apply a post-selection rewrite stage after deterministic bullet selection
- the deterministic bullet remains the source of truth for fact selection
- any rewrite stage must not choose entities, metrics, comparison basis, or section membership
- any rewrite stage must validate rewritten output against the deterministic draft and fail the dashboard request on validation or execution failure
- current implementation scope: all rendered insight bullets, including `quarterLearnings`
- current implementation uses an OpenAI agent and requires `OPENAI_API_KEY`
- current implementation emits server-side rewrite logs unless `OPENAI_INSIGHT_REWRITE_LOGGING=false`
- rewritten bullets must preserve approved numbers and metric labels exactly
- when the deterministic draft includes both `KBAs` and `CPKBA`, rewritten output must preserve both terms
- `CPKBA declined` remains forbidden legacy wording, but `KBAs declined` is valid when the volume clause declines
- direction validation may accept clear synonyms such as `rose`, but vague replacements such as `reached` do not satisfy direction requirements
- when the deterministic draft includes direction words for both volume and efficiency clauses, rewritten output must preserve both directional meanings
- rewritten bullets must not introduce new claims, causal language, or forbidden metric substitutions
- rewritten bullets must not add funnel stage / optimize-to parenthetical context when the deterministic draft omits it
- rewritten bullets may convert labels like `Campaign / Publisher` into more natural copy such as `Campaign running on Publisher` when the facts stay unchanged

UI emphasis rules:
- numeric emphasis in rendered bullets is clause-aware, not bullet-wide
- `CPKBA` values should render green only when the surrounding clause indicates favorable efficiency and red when the clause indicates unfavorable efficiency
- mixed quarter-learning bullets may contain both green and red numbers in the same bullet when volume and efficiency move in different directions
- exception: the top `Key Quarterly Takeaways` block and all media-card takeaway blocks, including `Key Channel Takeaways` and `Key Campaign Takeaways`, should render numeric emphasis in neutral black, without semantic red/green highlighting

## Examples

Good examples:
- `YouTube delivered 38.0% of KBAs with a VCR of 72.4%.`
- `Overall Search KBAs increased 14.0% vs last year.`
- `Campaign A carried quarter scale with 31.0% of spend and 42.0% of KBAs.`
- `Campaign B delivered the strongest efficiency at $48.21, indicating capacity to scale if that performance remains stable.`
- `Optimize Campaign C, which delivered $82.10 on CPKBA while representing 24.0% of spend.`

Bad examples:
- `Campaign A clearly won because the creative was stronger.`
- `Campaign B will definitely scale successfully next quarter.`
- `Search was amazing and crushed performance.`
- `Campaign C performed poorly.`

## Non-Goals

This spec does not require the insight layer to:
- explain root cause
- generate human-like stylistic variety
- cover every entity with narrative
- preserve every historical wording pattern if they conflict with this policy
- act as a substitute for deeper analyst commentary

## Code Alignment Rules

When this spec changes:
- update the implementing logic in `buildInsights()`
- update related helpers if metric-routing or phrasing behavior changed
- update `rewriteInsightChannels()` if rewrite-stage policy or scope changed
- keep the doc and code aligned in the same change cycle
- surface ambiguity before implementation if the spec does not determine behavior cleanly

## Open Change Discipline

Any future change to:
- section list
- section order
- recommendation verbs
- share-balance semantics
- tone phrases
- evidence gating
- quarter learnings selection rules

must be treated as a behavior change and updated here before or alongside code changes.
