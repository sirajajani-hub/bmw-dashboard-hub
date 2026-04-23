# Doc-to-Code Workflow

Doc Type: Spec

## Purpose

This file defines the working process for making dashboard behavior changes through markdown specs first and code second.

## Standard Change Flow

1. Update the relevant markdown document.
2. Identify which document type changed:
   - `PRD`
   - `Spec`
   - `Reference`
3. Mark whether the change is:
   - behavior change
   - clarification only
   - reference update
4. Codex reads the updated markdown.
5. Codex determines whether the change affects:
   - product intent only
   - executable behavior
   - documentation only
6. Codex maps behavior-relevant changes to the implementing code path.
7. Codex updates the code when the intended behavior should change.
8. Codex reports:
   - what changed
   - where it changed
   - whether any ambiguity remained
9. Codex aligns any adjacent docs if implementation exposed missing or conflicting detail.

## Change Classification

### Behavior Change

Use when intended runtime behavior should change.

Examples:
- change quarter learning selection logic
- change recommendation verbs
- change QA thresholds
- change evidence gating

Behavior changes require code updates.

### PRD Change

Use when product intent, audience framing, scope, or success criteria change.

Examples:
- the dashboard should answer a different business question
- Region or MACO should be interpreted differently
- the reporting audience changes
- the deck should prioritize a different kind of takeaway

PRD changes do not always require immediate code changes on their own.

They require code changes when they imply a concrete change in dashboard behavior.

### Clarification Only

Use when the spec becomes clearer but intended behavior does not change.

Examples:
- rewrite wording for clarity
- add examples
- document existing edge cases already present in code

Clarification-only changes may not require code changes.

### Reference Update

Use when documenting runtime state, implementation location, or known limitations.

Examples:
- update code touchpoints
- update datasource wiring notes
- update known gaps

Reference updates do not change behavior by themselves.

## PRD vs Spec Handling

### If A PRD Changes

Codex should:
- read the PRD change as an intent change
- determine whether the intent change implies a behavior change
- identify which `Spec` file should also change if behavior is affected
- implement code only when the PRD change clearly requires executable behavior to change

If the PRD change is too high-level to implement safely, Codex should ask a narrow follow-up question or recommend the corresponding spec update first.

### If A Spec Changes

Codex should:
- treat the spec as the direct behavior contract
- map it to the implementing code path
- implement the behavior change unless ambiguity is material

### If A Reference Doc Changes

Codex should:
- treat it as documentation-only unless it reveals a real doc/code mismatch
- avoid changing runtime behavior solely because a reference file was updated

## Implementation Rules

When Codex interprets a spec:
- implement the smallest code change that satisfies the spec
- preserve behavior outside the spec's stated scope
- do not infer broad policy changes from narrow wording edits
- keep the spec and code aligned after the change

When Codex interprets a PRD:
- preserve the PRD as the source of product intent
- avoid guessing detailed behavior that the PRD does not define
- derive implementation changes only when the intended behavioral impact is clear

## Ambiguity Handling

If a spec is clear enough to implement safely, Codex should proceed.

If a spec is ambiguous and the ambiguity would materially affect behavior, Codex should pause and ask one narrow question.

Examples of material ambiguity:
- conflicting inclusion rules
- unclear ranking priority
- unclear metric ownership
- unclear allowed phrasing boundaries
- unclear threshold or tolerance values

Examples of non-material ambiguity:
- minor wording preference
- heading style
- example ordering
- non-normative prose improvements

## Required Spec Shape For Behavior Files

Behavior-driving spec files should be structured enough to translate directly into code.

Preferred sections:
- Purpose
- Applies To
- Inputs
- Rules
- Blocking Conditions
- Output Expectations
- Examples
- Non-Goals
- Code Touchpoints

## Code Touchpoints

Every behavior spec should identify the implementation area when known.

Examples:
- `server/dashboardService.ts -> buildInsights()`
- `server/dashboardService.ts -> buildQaChecks()`

## Alignment Responsibility

After implementation, Codex should ensure:
- the code matches the intended spec
- the spec still accurately describes the code
- any newly discovered edge cases are captured in the right file
- no reference doc is left implying outdated behavior

## Non-Goals

This workflow does not mean:
- markdown is executed directly by the dashboard
- freeform prose should be treated as code
- every small wording edit should trigger a refactor
- reference docs can override source-of-truth specs

It also does not mean:
- every PRD update immediately changes runtime behavior
- PRD language can replace behavior specs when implementation detail is required

## Output Expectation After A Change

After a doc-driven change, Codex should report:
- markdown file updated or used
- document type (`PRD`, `Spec`, or `Reference`)
- code file(s) changed
- behavior changed or unchanged
- any ambiguity resolved during implementation
- any follow-up docs that should also be updated
