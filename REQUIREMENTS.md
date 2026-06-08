# Trip Planner Requirements

## Purpose

This document defines:
- The current implemented baseline of the Trip Planner app.
- Mandatory requirements for future development to remain compatible with Cloudflare Pages free-tier style hosting.

## Current Baseline (Implemented)

### Product scope
- Family convoy trip dashboard for a two-family road trip.
- Static web app built with plain HTML, CSS, and JavaScript.
- Data source from a local JSON file.

### Implemented features
- Trip overview header from trip metadata.
- Convoy status controls per vehicle (Departed, Stopping, Need break, Arrived).
- Shared checklist with browser local persistence.
- Day planner with:
  - Day selector
  - Route and drive summary
  - Stop options
  - Activity list
  - Food plan
  - Per-day checklist
- Map links:
  - Route deep link
  - Stop deep links
- Expense tracker:
  - Category-based entries
  - Family split modes (equal, single-family payer, custom percent split)
  - Family split summary
  - Remove expense entries
- Data export:
  - CSV export of expense entries
  - Updated trip JSON export that merges local expenses into budget entries
- Booking reminders:
  - Ferry reminders
  - Stay transition reminders
  - Day badges and reminder badges
- Print mode for day briefing.
- PWA support:
  - Manifest
  - Service worker caching
  - Installable app behavior (browser dependent)
- Optional Firebase sync module for live convoy and expense sharing.

### Current files
- index.html
- styles.css
- app.js
- norway_tripinfo.json
- manifest.webmanifest
- sw.js
- icon.svg
- firebase-sync.js
- netlify.toml
- _headers

## Cloudflare Free-Model Compliance Requirements

## 1) Hosting and runtime model
- MUST remain deployable as a static site on Cloudflare Pages.
- MUST function fully for core features without any required server-side runtime.
- MUST NOT require Cloudflare paid plans to run core functionality.

## 2) Architecture constraints
- Core app MUST be static-first.
- Core app data operations MUST work with local state and static JSON.
- Any real-time sync MUST be optional and degradable (app still usable when sync is disabled/unavailable).
- New features MUST include offline-safe fallback behavior.

## 3) Feature gating policy
- Required path:
  - Static UI
  - Local state persistence
  - Export/import backup workflows
- Optional path:
  - Firebase live sync
  - Any third-party integrations
- Any optional feature MUST fail gracefully and show non-blocking status.

## 4) Performance budgets
- Initial app load target: keep total static payload small and practical for mobile travel use.
- Keep JavaScript footprint lean; avoid large framework migration without clear need.
- Minimize JSON bloat; keep only needed trip fields and records.
- Prefer cache-first strategy for static assets and trip JSON.

## 5) Network and offline requirements
- App MUST be usable with intermittent connectivity after first successful load.
- Core read flows (day plans, checklists, expenses already stored locally) MUST work offline.
- Sync-dependent flows MUST clearly indicate offline/degraded status.

## 6) Data and persistence rules
- Local browser storage is the default write layer.
- File-system persistence from browser is done through explicit user export/download.
- Exported JSON MUST include merged budget entries and a sync timestamp.
- Any schema changes MUST be backward-compatible or include migration logic.

## 7) Security and privacy requirements
- No secrets, API keys, or credentials may be hardcoded in repository files.
- Firebase config (if used) MUST be user-provided at runtime or local storage.
- App MUST avoid collecting personal data beyond what trip coordination requires.

## 8) Cost-protection requirements
- Avoid mandatory per-request compute paths.
- Avoid introducing always-on server functions for baseline features.
- Prefer static assets + client logic + optional third-party sync.
- Any new paid-risk feature MUST include a cost impact note before implementation.

## 9) Quality and validation requirements
- Every feature change MUST pass basic syntax and editor diagnostics.
- PWA behavior must continue to work after changes.
- Export workflows (CSV and updated JSON) must remain functional after changes.
- Feature additions MUST NOT break existing baseline behaviors.

## 10) Deployment requirements
- App MUST remain deployable from repository root with no build step requirement.
- Cloudflare Pages deploy path MUST continue to support:
  - index.html as entry
  - static asset serving
  - _headers rules
- Deployment instructions MUST remain documented and updated.

## 11) Documentation requirements
- README must always include:
  - Local run steps
  - Hosting options
  - Offline/PWA usage
  - Optional sync setup
  - Backup/export workflow
- This REQUIREMENTS.md is the source of truth for scope guardrails.

## Future Development Checklist (Mandatory)

Before implementing any new feature, confirm all are true:
- Works on static hosting without paid Cloudflare dependencies.
- Has offline-friendly behavior or graceful fallback.
- Does not force server-side compute for core user path.
- Preserves export backup options.
- Adds no hardcoded secrets.
- Includes updated documentation.
- Keeps mobile usability for travel context.

## Non-Goals (for now)
- Full backend rewrite.
- Mandatory authentication system for basic app usage.
- Heavy analytics/telemetry pipelines.
- Large framework migration unless justified by clear product need.

## Change Control
- Any proposal violating this document must include:
  - Why violation is necessary
  - Cost/traffic impact estimate
  - Rollback plan
  - User impact summary

## Decision Matrix (Feature Risk Scoring)

Use this matrix before approving any new feature.

### Classification
- Free-tier safe
  - Fully static/client-side.
  - No required backend compute.
  - Offline path exists.
  - No paid dependency required.
- Needs optional path
  - Adds network or third-party dependency.
  - Must keep complete fallback path in local/offline mode.
  - Must be disabled by default or gracefully degradable.
- High cost risk
  - Requires frequent server/edge compute.
  - Requires always-on synchronization or high-volume writes.
  - Introduces unavoidable paid usage for core user flow.

### Scoring Rubric (0 to 2 each)
- Compute load
  - 0: None (static/client only)
  - 1: Occasional optional compute
  - 2: Frequent required compute
- Network dependence
  - 0: Works offline after first load
  - 1: Partial online dependence
  - 2: Core path fails offline
- Third-party lock-in
  - 0: No required vendor
  - 1: Optional integration
  - 2: Required vendor dependency for core flow
- Operational complexity
  - 0: No new operational burden
  - 1: Light setup and maintenance
  - 2: Ongoing maintenance or monitoring burden

### Interpretation
- Total 0 to 2: Free-tier safe
- Total 3 to 5: Needs optional path
- Total 6 to 8: High cost risk

### Mandatory Gate Rules
- Any feature scoring 3 or higher must include:
  - A local/offline fallback plan
  - A cost note in PR/feature description
  - A rollback path
- Any feature scoring 6 or higher must be explicitly approved before implementation.

### Examples for this app
- Add local weather card with cached last value
  - Likely score: 3 to 4 (Needs optional path)
- Add mandatory real-time chat with backend persistence
  - Likely score: 6 to 8 (High cost risk)
- Add local checklist templates stored in browser
  - Likely score: 0 to 1 (Free-tier safe)
