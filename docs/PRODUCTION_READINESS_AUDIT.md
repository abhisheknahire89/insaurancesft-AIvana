# Aivana — Production Readiness Audit

**Date:** 2026-07-21
**Scope:** Full repository, all subsystems, read-only research (no code changed to produce this document)
**Method:** Six parallel deep-read passes (architecture, backend/DB/API, AI pipeline, UI/UX, security/compliance, code quality/testing), each independently verifying claims against actual source, not against README/task.md/docs/architecture — those three are themselves audited below and found to be substantially stale.
**Repo state audited:** branch `main`, HEAD `311d5f0`, plus uncommitted working-tree edits to `components/PreAuthDashboard/CaseList.tsx`, `CaseWorkspace.tsx`, `services/masterPatientRecord.ts`, `services/queryResponseService.ts`.

> Every claim below is backed by a `file:line` citation. Where an agent's finding could not be independently re-verified in this pass, it is marked accordingly.

---

## 0. Executive Summary

Aivana is a genuinely substantial, partially production-grade system wearing a POC's clothes — some of its hardest subsystems (WHO ICD-10 validation, deterministic billing math, the "Fairway" clinical-necessity engine, citation-gated appeal generation) are real, well-designed, and non-trivial engineering. But the product has **two live, unreconciled identities running in the same bundle** — a polished "Command Center" (Case Queue → Wizard → Workspace) and a legacy "Ops Tools" 14-screen simulator — plus a **third, fully dead identity** (an old OPD/chat product, ~4,700 lines, unreachable from anything). Several screens present fabricated data as if it were live analysis, with no visual distinction from real ones. And there is a live, active secret/PHI leak on the public GitHub repo (flagged separately, see §7.0) that needs action independent of everything else in this document.

**Bottom line on the user's stated "Current Truth" claims:** three are confirmed accurate, three needed correction — see §10.

---

## 1. High-Level Architecture

### 1.1 Module inventory

| Dir | Responsibility |
|---|---|
| `components/InsuranceModule.tsx` (~197KB, single file) | Hosts **two** parallel systems: the legacy "Ops Tools" 14-screen shell (`SCREENS` array, `:2934-2949`) and the production `PreAuthDashboard` Command Center. |
| `components/PreAuthWizard/` | 4-step case-creation wizard (Patient/Insurance → Clinical → Admission/Cost → Documents & Generate), autosaves every step. |
| `components/PreAuthDashboard/` | Production shell: `CaseList` (triage queue) → `CaseWorkspace` (single-case view: evidence, billing, readiness, enhancement, query-response). |
| `components/PostSubmission/` | `DenialQueue.tsx` (real, live), `StatusTracker.tsx` (dead, superseded). |
| `components/TpaPlatform/` | `PriorAuthCopilot.tsx`, `DenialHub.tsx`, `BillingCoderView.tsx` (all three **imported but never rendered anywhere** — confirmed dead), `WorkflowOrchestrator.tsx` (reachable, but a fully scripted demo). |
| `hooks/`, `contexts/` | `useICDSuggestion`, `useSubscription` (dead), `AuthContext` (JWT in localStorage). |
| `services/` | Extraction (`documentExtractionService.ts`, `evidenceExtractionService.ts`), AI clients (`apiKeys.ts`, `llmClient.ts`, `geminiService.ts`), domain (`icdService.ts`, `costEstimationService.ts`), persistence (`masterPatientRecord.ts`). |
| `engine/` | `priorAuthWorkflow.ts` (main orchestrator), `evidenceReview.ts` (67KB, "Fairway"), `billingCoder.ts`, `enhancementReview.ts`, `denialAppealGenerator.ts` (real, grounded appeal engine), `appealGenerator.ts` (**dead-end duplicate**, ungrounded, used only by the unreachable `DenialHub.tsx`). |
| `engine/layers/` | Numbered pipeline `02`–`12`, used **only** by the old chat/"Nexus" feature (`engine/workflow.ts::runNexusWorkflow`) — not part of the real pre-auth pipeline at all. |
| `config/` | `modelConfig.ts` (model IDs — see §5), static reference config. |
| `data/` | Static ICD/PMJAY datasets, plus a **12MB `database.sqlite`** committed to git (see §4, §7). |
| `backend/server.ts` | Standalone Express + `better-sqlite3` CRUD server, `localhost:3001` only, run manually via `npm run server` — **not part of any deployed build**. |
| `api/` | Vercel serverless functions — the **only backend that actually runs in production**: `gemini.ts` (proxy), `auth/login.ts`/`signup.ts` (Neon Postgres + bcrypt + JWT), `users/me.ts`. |
| `scripts/` | Offline QA harness (adversarial/regression batteries), not part of the runtime app. |

### 1.2 Request lifecycle — new pre-auth case (verified end-to-end)

`App.tsx:24` → `InsuranceModule` → `PreAuthDashboard` → `CaseList` → "New Pre-Auth" → `PreAuthWizard`:

1. **Step 1–3** (`PatientInsuranceStep`, `ClinicalDetailsStep`, `AdmissionCostStep`) — `updateRecord()` autosaves to IndexedDB on every change (`PreAuthWizard/index.tsx:160-170` → `services/masterPatientRecord.ts:612-651`). A background `useEffect` (`PreAuthWizard/index.tsx:145-158`) fires `priorAuthOrchestrator()` on every diagnosis change to keep the live Claim Readiness sidebar current.
2. **Step 4** (`DocumentsGenerateStep.tsx`, 1,637 lines): document upload → `extractFromDocument()` → native PDF text, or (if scanned) Sarvam OCR with Gemini-vision fallback (`services/documentExtractionService.ts:143-217`) → page classification + structured extraction, **both via Gemini directly** (`:551-716`) → `priorAuthOrchestrator()` runs Extraction / Evidence Review ("Fairway", via MedGemma→Gemini fallback) / ICD Coding (deterministic-first, AI-fallback) / Billing (AI-first via `extractBillingCodesAI`, then deterministic arithmetic) in parallel with SLA timeouts.
3. **Generate/Submit** → status transitions tracked in `PatientCaseRecord.authorizations[]`; **no outbound call to any real insurer/TPA system exists** — `simulatedInsurerService.ts` fakes a decision locally.

### 1.3 Storage reality (three silos, never reconciled)

1. **IndexedDB (Dexie)** — `services/masterPatientRecord.ts:212-225`, tables `patientCases`/`patients`. **Always written, primary store in every real environment.**
2. **Local Express+SQLite** (`backend/server.ts`) — best-effort mirror, hardcoded to `localhost:3001` (`masterPatientRecord.ts:400`), silently no-ops (try/catch + `console.warn`) everywhere except a developer's own machine with `npm run server` running. **Unreachable in production** (not wired into `vercel.json`).
3. **Neon Postgres** — `users` table only (auth). Never touches clinical/case data.

No sync/reconciliation exists between these three. See §4 for schema detail and §7 for the fact that #2 has already captured and committed real-shaped patient data to a public repo.

### 1.4 AI provider map (see §5 for full detail)

Both the "Sarvam-first OCR" and "MedGemma/Qwen-first reasoning" fallback chains **still terminate in Gemini** in the current code, despite three consecutive commit messages (`311d5f0`, `6c44af7`, `cd74e3d`) each claiming Gemini removal — they in fact undo each other. `config/modelConfig.ts:1-2` configures `gemini-3.5-flash`, which does not match any publicly known Gemini model family — **unverified whether this ID is even callable**, flagged as a possible silent production break.

### 1.5 docs/architecture/ is aspirational, not real

`docs/architecture/master_architecture_index.md` describes a ~25-microservice platform (Docling ingestion gateway, Neo4j policy graph, Temporal orchestration, ClickHouse analytics, OpenTelemetry) — **none of this exists in code**. The actual system is a single Vite SPA + a handful of Vercel functions + client-side Dexie storage. Treat `docs/architecture/*` as design fiction until reconciled with reality; this audit document supersedes it as ground truth.

---

## 2. UI/UX Audit

### 2.1 The real product is good; one screen regressed

`CaseList.tsx`, `CaseWorkspace.tsx` (1,413 lines, live engine calls throughout — orchestrator, billing, enhancement, query-response), Wizard Steps 1–3, `ClaimReadinessRail.tsx` are all **fully light-mode, polished, with real empty/loading states**. The Enhancement Request flow (3-step panel inside `CaseWorkspace.tsx:269-678`) is real and complete.

**`DocumentsGenerateStep.tsx` (Wizard Step 4, 1,637 lines) is still on the old dark theme** — `bg-[#0D121F]`, `bg-black`, 37 instances of `text-white` concentrated in the `docs`, `declarations`, `tpa-review`, `partc-review` tabs (`:752-904, 953-1033, 1033-1547, 1547-1637`). This is one click past an otherwise fully-redesigned wizard — the single highest-visibility visual inconsistency a coordinator will actually hit every time they create a case.

### 2.2 Two parallel product identities, overlapping and diverging

| Capability | Real, reachable implementation | Fake/unreachable duplicate |
|---|---|---|
| Denial handling / appeals | `PostSubmission/DenialQueue.tsx` (Ops Tools Screen 13) — real, wired, polished | `TpaPlatform/DenialHub.tsx` — seeded from hardcoded `MOCK_DENIALS`, fake guaranteed-win `setTimeout`, **never rendered anywhere** (imported at `InsuranceModule.tsx:12`, zero JSX usage) |
| Prior-auth cockpit | Live `priorAuthOrchestrator()` calls in `CaseWorkspace.tsx`/`PreAuthWizard` | `TpaPlatform/PriorAuthCopilot.tsx` — same engine, fed only `DEMO_CHARTS` fixtures, never rendered |
| Billing/coding | `runBillingCodingWorkflow()` live in `CaseWorkspace.tsx:864-869` | `TpaPlatform/BillingCoderView.tsx` — same engine, hardcoded note, never rendered |
| Evidence/citation grounding | Real `HighlightCard` in `CaseWorkspace.tsx` | Ops Tools Screen 7 `EvidenceExplorerView` — **100% hardcoded**, same fake excerpt regardless of diagnosis |
| Workflow timeline | Real `caseRecord.timeline` in `CaseWorkspace.tsx:1270-1299` | Ops Tools Screen 10 → `WorkflowOrchestrator` — fully scripted fictional patient "Asha Devi," fabricated "+18% with AI Scrubbing" stat |

**Critical UX gap:** `CaseWorkspace.tsx` — the coordinator's actual daily screen — has **no appeal-generation action of its own**. A denied case shows only inline text: *"Use the Ops Tools → Denial Queue to generate a citation-backed appeal letter"* (`CaseWorkspace.tsx:1261-1265`). The coordinator must abandon the polished product and manually navigate a legacy shell to do one of the three headline product functions ("Aegis").

**Query prediction** (`TpaQueryPredictionView`, genuinely well-built, rule+AI hybrid, see §5) is likewise **only reachable via Ops Tools Screen 9** — no panel for it exists in the real Workspace.

**QR self-registration and bulk document ingestion** write to a different data model (`PatientCaseRecord`) than the Case Queue reads (`PreAuthRecord`) — bridged only by a manual "Launch Pre-Auth Scribe" button-press (`InsuranceModule.tsx:3118-3131`, `masterPatientRecord.ts:229-397`). These cases do not appear in the polished Case Queue automatically.

### 2.3 Fabricated content shown with no "this is a demo" signal

- `InsuranceModule.tsx:1518-1536` — "Source Provenance" panel claims *"Aivana grounds all extracted data to source page snippets. No hallucinations"* directly above a **hardcoded fake excerpt that never changes per case**.
- `InsuranceModule.tsx:2146-2174` — Evidence Explorer (Screen 7): fixed fake excerpt regardless of actual diagnosis.
- `InsuranceModule.tsx:2211-2218` / `:2674` — "Audit KPI" block and "Avg Readiness: 88%" are hardcoded constants, not computed.
- `WorkflowOrchestrator.tsx:6-62` — entire scripted demo theater with a fictional patient and stat.

Contrast: the Analytics screen honestly labels itself "Session Local Stats Only," and Hindi translation is honestly flagged "machine-translated only" — so the pattern of disclosure exists in the codebase, it's just inconsistently applied.

### 2.4 Internal jargon leaked into coordinator-facing copy

`ICDPicker.tsx:199` "🤖 Ask MedGemma Fallback"; `VoiceDictationMode.tsx:351` "Gemini AI is extracting clinical data..."; `PatientInsuranceStep.tsx:357,371` "Gemini Field Extraction"/"Gemini LLM Parser"; `InsuranceModule.tsx:477,1032,1041` "sent to Gemini Vision for extraction." These are also **factually stale** given the Sarvam/custom-endpoint migration — the UI tells the coordinator "Gemini" is doing work that (per commit history) was supposed to have moved elsewhere.

### 2.5 Confirmed fully dead code (~4,700 lines, zero importers from `App.tsx`)

`ChatView.tsx` + its subtree (`ChatMessage`, `ChatInput`, `TypingIndicator`, `PromptInsightsPanel`, `PregnancyRiskAssessmentForm`), `VedaSessionView.tsx` + its subtree (`InsurancePreAuthModal`, `InsuranceStepConfirm/Cost/Documents/Policy/Review`, `TestResultCard`), `UsageLimitBanner.tsx`, `CaseSummaryModal.tsx`, `PrintViewModal.tsx`, `LicenseVerificationModal.tsx`, `Dashboard.tsx`, `AboutModal.tsx`, `PostSubmission/StatusTracker.tsx`, **`Sidebar.tsx`** (confirmed dead — task.md incorrectly assumes it's live and needs redesign), and a literal 0-byte `LiveTranscriptView.tsx`. This is leftover from what `DEPLOYMENT_GUIDE.md` reveals was a prior, different product ("opdv3," an OPD/consultation app) that this repo was forked from and never fully pruned.

Native blocking `alert()` popups persist in legacy/unreachable screens (`InsuranceModule.tsx`, `BillingCoderView.tsx`, `DenialHub.tsx`, `DenialQueue.tsx`) even though `CaseWorkspace.tsx` explicitly replaced them with inline toasts — an inconsistent feel across the app.

---

## 3. Backend Audit

### 3.1 Endpoint inventory

| Method/Path | File | Real or stub |
|---|---|---|
| GET/POST/DELETE `/api/patients[/:id]` | `backend/server.ts:39-93` | Real, **zero auth, wildcard CORS**, localhost-only in practice |
| POST `/api/gemini` | `api/gemini.ts:8-44` | Real, server-side key |
| POST `/api/auth/login`, `/signup` | `api/auth/login.ts:5-67`, `signup.ts:5-65` | Real, bcrypt+JWT, Neon-backed |
| GET `/api/users/me` | `api/users/me.ts:4-61` | Real, JWT-verified |

**Client calls endpoints that don't exist anywhere**: `POST /api/auth/refresh`, `PUT /api/users/me`, doctor-profile GET/PUT, `upload-logo`, all `/api/subscriptions/*`, all `/api/cases*` (`utils/api.ts:44-76`) — dead client scaffolding for a billing/case-management backend that was never built.

### 3.2 Dev-mode shadow backend

Without `DATABASE_URL` set, Vite's dev middleware (`vite.config.ts:62-151`) intercepts `/api/auth/*` and returns a **hardcoded fake token/user with zero password verification** (`:113-143`). Confirmed excluded from `vite build` output (checked `dist/assets/*.js`, no trace) — dev-only, but easy to forget is active locally.

### 3.3 Data integrity risks

- No schema/shape validation on write, either storage layer (`backend/server.ts:67-69` only checks `record.id` exists).
- Read-modify-write races: every mutator in `masterPatientRecord.ts` (`saveEncounter`, `recordAuthorization`, `saveAppeal`, `recordEnhancement`, `recordQueryResponse`, `:456-608`) does an unguarded get→mutate→put, no transaction, no version/etag — concurrent edits silently drop one side.
- `generatePreAuthId()` (`masterPatientRecord.ts:759-763`) uses a 4-digit random suffix (9,000 values/day) with `INSERT OR REPLACE`/Dexie `put()` upsert semantics — a collision **silently overwrites a different patient's entire record**, no error.

---

## 4. Database Audit

### 4.1 Neon Postgres — `users` table only

```sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```
(`scripts/migrate.ts:23-33`.) No `role` column (see §7 RBAC gap), no `updated_at`, no migration versioning table — schema changes require hand-editing this script and rerunning manually.

### 4.2 SQLite (`backend/server.ts`) — JSON blob store, not relational

```sql
CREATE TABLE IF NOT EXISTS patients (id TEXT PRIMARY KEY, data TEXT NOT NULL, updatedAt TEXT NOT NULL)
```
No columns for name/insurer/status — can't query/filter/index by anything but `id`. **The file itself, `data/database.sqlite` (12.3MB, 8 rows of real-shaped patient data), is committed to git and live on the public `origin/main`** — see §7.0.

### 4.3 IndexedDB (Dexie) — the de facto production store

`patientCases: 'id, updatedAt'`, `patients: 'id, patientName, mobileNumber'` (`masterPatientRecord.ts:212-223`). No index on searchable fields (policy number, diagnosis), no schema migration path beyond `version(1)`, no encryption (confirmed: no `dexie-encrypted` or similar in `package.json`) — all PHI/PII sits in browser-local plaintext.

---

## 5. AI Pipeline Audit

### 5.1 The "Gemini removal" is not real — three commits that undo each other

`cd74e3d` removed Gemini from OCR/evidence extraction → `6c44af7` deleted the replacement function and reinstated a full Gemini fallback in `queryMedGemma` (`services/llmClient.ts:170-188`) → `311d5f0` reverted `evidenceExtractionService.ts`/`documentExtractionService.ts` back to calling Gemini directly. **Current state: Gemini is primary or fallback in nearly every AI call site.** Only raw OCR text extraction genuinely tries Sarvam first.

### 5.2 Deterministic vs AI, feature by feature

| Feature | Reality |
|---|---|
| ICD-10 lookup (primary path) | **Deterministic** — `icdService.ts:150-311`, synonym/keyword match against static WHO JSON |
| ICD-10 AI-fallback | AI, but gated through `validateCode()` + `isIcdCodePlausible()` (12+ category rules) before trust |
| ICD-10 in billing workflow ("Taiga") | **AI-first, weakly checked** — `extractBillingCodesAI` (Gemini) is *not* run through `icdService`'s validation; `billingCoder.ts`'s own chapter-lock check only covers 4 categories (narrower, inconsistent with the 12+ in `icdService.ts`) |
| Room rent cap / billing math | Deterministic arithmetic, but **seeded by AI-generated billing splits** it only sanity-checks for gross arithmetic error (±0.5%), not policy correctness |
| Clinical necessity ("Fairway") | **Best-designed part of the system** — deterministic pre-check → gated LLM call (explicitly forbidden from emitting ICD codes/probabilities) → ~15 deterministic specialty overlays → deterministic rule layer, with `source: 'rule'` vs `'suggestion'` provenance preserved to the UI |
| Severity scores (PhenoIntensity, Urgency Quotient, Deterioration Velocity) | **Neither AI nor deterministic — hardcoded placeholders.** `masterPatientRecord.ts:361` defaults to 0; `VedaSessionView.tsx:230,458` hardcodes `0.8/0.7/0.6` as literal constants. `engine/layers/08_ddxEngine.ts` — the module whose docstring promises Bayesian updating/evidence scoring — is a 2-line stub whose own comment admits it's "simulated by the LLM Orchestrator," which itself never computes these numbers either. **Displayed to users with 2-decimal precision as if measured** (`InsuranceStepReview.tsx:90-102`). |
| Query prediction | Genuine rule+AI hybrid, well-labeled provenance (`tpaQueryPredictionService.ts`), see §2.2 for reachability gap |
| Appeal generation ("Aegis") | **Two parallel systems, only one grounded** — see §5.3 |

### 5.3 Grounding — real in one path, absent in the other

`engine/denialAppealGenerator.ts` (the live path, used by `DenialQueue.tsx`) — genuinely grounded: builds a pool of only evidence already confirmed `present: true`, runs every cited item through `isEvidenceCitationPlausible()` (exact substring or ≥40% token overlap), routes failures to `stillMissing` rather than asserting them.

`engine/appealGenerator.ts` (used only by the dead `DenialHub.tsx`) — pure free-text Gemini generation, **no citation verification at all**; its hardcoded IRDAI circular citations are never checked against real regulatory text.

**Evidence extraction's `sourceSnippet` claims are never verified anywhere** — the LLM is asked to quote verbatim, but no code checks the quote actually appears in the source document. "Ask the LLM to cite, trust it" — not grounding.

`overturnProbability` (`geminiService.ts:734-782`) is an ungrounded LLM guess (0.0–1.0, no calibration) that **directly drives the denial-queue priority score** (`engine/denialReview.ts:74-82`) — the triage order for real appeal work is substantially steered by an unverified LLM confidence number.

### 5.4 QA/audit harness — real but circular

`scripts/continuousMultiAudit.ts` uses Gemini to **both generate test cases and grade the system's output against them** — an LLM-judges-LLM design, not an independently-authored oracle. See §9 for coverage/freshness gaps.

---

## 6. Product Audit — What's Real vs Fake vs Partial

| Status | Item |
|---|---|
| ✅ **Production-ready** | WHO ICD-10 deterministic lookup + validation (`icdService.ts`) for the primary lookup path; room-rent-cap/proportional-deduction billing arithmetic (`engine/billingCoder.ts`, covered by `testBillingMath.ts`); auth token issuance (bcrypt/JWT, no enumeration); citation-grounded appeal generation (`denialAppealGenerator.ts`) *when reached via `DenialQueue.tsx`*; Fairway's deterministic pre/post-check layers |
| 🟡 **Partial / hybrid, needs hardening** | Fairway LLM-reasoning layer (real, but citation enforcement incomplete per user's own stated truth); AI-fallback ICD coding (gated, but billing-workflow ICD codes bypass the gate); query prediction (deterministic core exists, but unreachable from the real product UI); claim readiness scoring (computed live and consistently, but no KPI/trend rollup exists) |
| ❌ **Fake / mocked / hardcoded in a live production surface** | `DenialHub.tsx` (unreachable, but if ever wired up, is 100% `MOCK_DENIALS`); Ops Tools "Source Provenance" (Screen 5), "Evidence Explorer" (Screen 7), "Audit KPI" (Screen 8), Analytics "Avg Readiness: 88%," `WorkflowOrchestrator.tsx` — all reachable today and indistinguishable from real panels; severity scores (PhenoIntensity/Urgency Quotient/Deterioration Velocity) shown with false precision |
| ⚫ **Dead / unfinished** | `PriorAuthCopilot.tsx`, `BillingCoderView.tsx` (imported, never rendered); `engine/appealGenerator.ts` (ungrounded, orphaned); `engine/layers/08_ddxEngine.ts` (documented, never implemented); ~4,700 lines of the old chat/OPD product; `Sidebar.tsx` |

---

## 7. Security & Compliance Audit

### 7.0 🔴 Live, urgent findings (already surfaced separately — repeated here for completeness)

1. **Sarvam API key committed and live on the public repo** — `docs/architecture/document_ingestion_ocr_classification_guide.md:82-83`, commit `311d5f0`, confirmed an ancestor of `origin/main` (public, HTTP 200 unauthenticated). Same value currently active in `.env`/`.env.local`. **Action needed: rotate now.**
2. **12MB `data/database.sqlite` with real-shaped patient PII/financial data committed and live on the public repo** — commit `a4c1166`, confirmed ancestor of `origin/main`. Whether the 8 rows are synthetic or real patient data is unverified (deliberately not read in depth out of caution) — **this determines whether it's a hygiene issue or a DPDP-reportable incident.**
3. **Client-bundled API keys** — `services/apiKeys.ts`, `services/documentExtractionService.ts:144-146`, and `vite.config.ts:164-166`'s `define` block inline the real Gemini/Sarvam keys directly into the shipped JS (confirmed present in `dist/assets/index-CLCJ6rbW.js:513`). If the same env vars are set in the Vercel build environment, **every visitor's browser ships with extractable real API keys via view-source**, defeating the entire server-proxy design intent.
4. Real Gemini keys also sit in **local, unpushed** git history on branch `feature/claims-intelligence` (commits `fb44f5a`, `af66272`) — not currently on any remote, but would leak permanently if that branch is ever pushed/merged.

### 7.1 Auth & session

Bcrypt (10 rounds) + JWT (7d, no fallback secret, hard-fails without `JWT_SECRET`) is well-implemented (`api/auth/*.ts`). **No RBAC at all** — no `role` column anywhere, every authenticated user (and the fully client-side "guest" mode, `AuthContext.tsx:77-88`, no server round-trip) has identical access to all case data. No brute-force protection/rate-limiting on login.

### 7.2 PHI/PII exposure — README's claim is false

README says "browser-local only, no server, Gemini only." Reality: `masterPatientRecord.ts` always attempts a POST of full patient records to the local backend (§3); Sarvam receives raw document blobs directly from the browser with no server proxy (`documentExtractionService.ts:158-163`); Qwen/MedGemma custom endpoints are also called. **No consent/privacy notice exists anywhere in the patient-facing QR self-registration flow** — the one consent checkbox that exists elsewhere only covers insurer/TPA data sharing, not third-party AI vendor transmission.

### 7.3 Audit trail is not tamper-evident

Both `caseRecord.auditLog[]` (IndexedDB) and `utils/auditLog.ts` (despite a doc-comment claiming "append-only, immutable, never deleted or edited," `:1-11`) are plain mutable `localStorage`/IndexedDB JSON, with **hardcoded actor strings** (`'doctor'`, `'system'`, `'patient_self'`) never tied to the real authenticated user. A coordinator's own DevTools can silently edit or delete case data and audit history with no server-side trail to detect it.

### 7.4 Other findings

No IndexedDB encryption at rest (plaintext PHI in-browser); `backend/server.ts` has wildcard CORS + zero auth (safe only if truly never network-reachable, which nothing enforces); no HSTS/security-headers config in `vercel.json`; QR session tokens sent to a third-party public QR-image service (`api.qrserver.com`) via URL query string.

---

## 8. Performance Audit

This dimension was **not** given a dedicated deep-dive pass in this audit round — flagging as a gap to close next, consistent with the user's own stated truth that "document latency needs long-document benchmarking." What is known from the other passes:

- `engine/priorAuthWorkflow.ts` applies SLA timeouts per pipeline stage (extraction/evidence/coding/billing run with individual time budgets), but no benchmarking suite exercises this against genuinely large (50+ page) scanned documents.
- `scripts/qualityGate.ts` gates on an average-latency threshold (≤15s) and zero SLA breaches (`qualityGate.ts:69-113`), but this is measured against the same 10-of-74-case sample used for accuracy grading — not a dedicated performance/load test.
- No caching layer exists for OCR/extraction results beyond an ad-hoc `scripts/llm_cache.json` (3.9MB) used only by the offline QA scripts, not the running app.
- No queue/worker infrastructure exists at all (confirmed: no `bull`/`node-cron`/`worker_threads` usage anywhere) — every AI call happens synchronously in the request path, meaning a slow OCR/LLM call blocks the coordinator's UI directly with no background processing option.
- **Recommendation:** a dedicated performance audit (large-PDF OCR latency, IndexedDB read/write time at realistic case volumes, LLM call p50/p95) should be run before claiming production readiness on this axis — none of the six passes in this round measured it directly.

---

## 9. Code Quality & Testing Audit

### 9.1 No real test framework

Zero `jest`/`vitest`/`mocha` in `devDependencies`, zero `*.test.ts` files. All "tests" are hand-rolled `tsx` scripts. Only **one** genuine assertion-based test exists: `scripts/testBillingMath.ts` (282 lines, real `assertEqual`, exits non-zero on failure) — and it only covers `engine/billingCoder.ts`, not the other two duplicate billing implementations (`utils/costCalculator.ts`, `services/costEstimationService.ts`).

Everything else (`scripts/plantedErrorCheck.ts`, `scripts/qualityGate.ts`, `scripts/continuousMultiAudit.ts`) is **LLM-as-judge over LLM-generated-or-cached cases** — a materially weaker guarantee than an independent golden set, and the product owner should not read "quality gate passed" as "clinically verified."

### 9.2 Regression suite is stale relative to active development

`scratch/adversarial_registry/` (36 cases + 36 expected files) and `scratch/adversarial_failures/` are all timestamped **Jul 14** — a week before this audit, while `documentExtractionService.ts`, `llmClient.ts`, `evidenceExtractionService.ts` all changed **Jul 20–21**. **This week's OCR/LLM-routing changes have not been re-validated against the regression suite.** The most recent test-battery run (`scripts/test_battery_report.md`, Jul 20) is refreshingly honest that only 8% of its 100 cases exercised a live model call (58% cache replay, 34% fallback) and flags one real **safety-leak**: a case where the system generated a specific drug-dosing recommendation it shouldn't (`test_battery_report.md:36`) — worth triaging regardless of test-infra maturity.

### 9.3 Dead code, duplication, hygiene

~4,700 lines of dead components (§2.5); **triple-redundant billing logic** (only one path tested); duplicate ICD datasets (`icd10Codes.json` vs `icd10Codes_clean.json`, the latter orphaned); `task.md`'s duplicate-cleanup claim is ~95% accurate (3 stray ` 2`-suffixed files remain, one — `.env 2` — not covered by `.gitignore`'s pattern); no CI/CD anywhere (no `.github/workflows`); `DEPLOYMENT_GUIDE.md` documents an entirely different, prior product ("opdv3") with wrong paths — should not be followed as-is.

### 9.4 README.md drift (should be rewritten, not patched)

Claims contradicted by code: "Backend: None," "Auth: None (POC stage)," "Gemini exclusively," "browser-local only, no server" — all false per §1/§3/§5/§7 above.

---

## 10. Verification of Stated "Current Truth" Claims

| Claim as given | Verdict | Evidence |
|---|---|---|
| WHO validation — production ready | **Mostly true, one gap** | True for the primary ICD lookup path (`icdService.ts`) and the AI-fallback path (gated). **False for the billing-workflow's AI-generated codes**, which bypass this validation entirely (§5.2) — recommend routing `extractBillingCodesAI`'s output through `icdService.validateCode`/`isIcdCodePlausible` before calling this "production ready" everywhere it's used. |
| Deterministic billing — production ready | **Mostly true, one gap** | The arithmetic itself (`engine/billingCoder.ts`) is real, deterministic, and tested. But it's fed by an AI-generated billing split that's only sanity-checked for gross arithmetic error, and two other untested implementations of similar logic exist elsewhere in the codebase (§9.3) — "production ready" should be scoped to `billingCoder.ts` specifically, not the concept generally. |
| Fairway leakage prevention — still under validation | **Confirmed accurate** | Real hybrid design with good provenance tagging, but citation/grounding enforcement for the LLM-suggested layer is not independently verified against source text (§5.3) — correctly described as unresolved, don't upgrade this claim yet. |
| Grounded appeals — grounding exists, citation enforcement incomplete | **Confirmed accurate, more nuanced than stated** | `denialAppealGenerator.ts` has real, working citation verification. But there are **two live appeal-generation code paths**, and the other one (`engine/appealGenerator.ts`, feeding the — currently unreachable — `DenialHub.tsx`) has **no** citation enforcement at all. The "incomplete" framing is right, but the real story is "one path is grounded, one isn't, and they need to be unified," not "the one path needs more work." |
| Query prediction — designed but not implemented | **Needs correction — more built than stated** | `services/tpaQueryPredictionService.ts` is a genuinely implemented deterministic-rule + AI-supplement hybrid with explicit provenance tagging (§5.2). The real gap is **reachability**: it only exists in the Ops Tools simulator, with no panel in the actual coordinator-facing `CaseWorkspace.tsx` (§2.2). Recommend re-framing this backlog item as "surface existing query prediction in the real Workspace," not "build query prediction." |
| Claim readiness — needs KPI implementation | **Confirmed accurate** | Per-case readiness scoring is real and live (`ClaimReadinessRail.tsx`, `computeReadiness()`), but there's no aggregation/trend/KPI layer across cases over time — the one place that gestures at this (Analytics screen) hardcodes "Avg Readiness: 88%" rather than computing it (§2.3). |
| Document latency — needs long-document benchmarking | **Confirmed accurate, and broader than stated** | No dedicated performance benchmarking exists at all (§8), not just for long documents specifically — recommend scoping this work item to cover OCR latency, IndexedDB read/write at volume, and LLM p50/p95, not only document length. |

---

## 11. Prioritized Roadmap

### P0 — Do independent of everything else, this week
1. Rotate the Sarvam API key; decide on GitHub repo visibility; assess whether `data/database.sqlite`'s committed rows are real patient data (§7.0).
2. Stop client-bundling API keys (`vite.config.ts:164-166`, `services/apiKeys.ts`) — verify the server-proxy path (`/api/gemini`) is used exclusively in any deployed build; audit whether `VITE_`-prefixed key vars are set in Vercel's build environment (if so, they're leaking today).
3. Triage the one confirmed safety-leak from the last test battery run (drug-dosing recommendation, `test_battery_report.md:36`).

### P1 — Blocks calling this "production ready" for the primary coordinator workflow
4. Give `CaseWorkspace.tsx` a real appeal-generation action (currently punts to a legacy shell) and a query-prediction panel (currently Ops-Tools-only) — these are two of three headline product capabilities, both real under the hood, both unreachable from the actual daily-use screen.
5. Decide the fate of `DenialHub.tsx`/`PriorAuthCopilot.tsx`/`BillingCoderView.tsx` (imported, never rendered, would show fake data if ever wired up) — delete or genuinely integrate, don't leave them as bundled dead weight with misleading names.
6. Reconcile the `PatientCaseRecord` (QR intake) vs `PreAuthRecord` (Case Queue) data-model split so cases don't require a manual bridging step to appear in the real triage queue.
7. Remove or clearly demo-badge the hardcoded/fabricated panels (Source Provenance, Evidence Explorer, Audit KPI, Analytics avg-readiness, WorkflowOrchestrator) — right now they're indistinguishable from live analysis.
8. Fix `DocumentsGenerateStep.tsx`'s leftover dark theme (highest-visibility visual inconsistency in the reachable app).
9. Route `extractBillingCodesAI`'s ICD output through the existing `icdService.ts` validation gate instead of the narrower, separate check in `billingCoder.ts`.
10. Add real audit-trail attribution (actual authenticated user, not hardcoded `'doctor'`/`'system'` strings) — currently not usable as evidence of anything in a dispute.

### P2 — Needed before trusting this at scale
11. Add RBAC (role column + enforcement) — no segregation of duties currently exists.
12. Add a dedicated performance benchmark pass (large-document OCR, IndexedDB at volume, LLM p50/p95) — none exists today.
13. Re-run the adversarial regression suite against this week's OCR/LLM-routing changes before shipping them further; keep it current going forward.
14. Consolidate the three duplicate billing-calculation implementations into one, tested path.
15. Remove ~4,700 lines of confirmed-dead component code; rewrite README.md and retire/replace `DEPLOYMENT_GUIDE.md`, both of which actively mislead right now.
16. Decide whether `engine/layers/08_ddxEngine.ts` and the severity-score fields (PhenoIntensity etc.) are planned work or should be removed — currently they mislead readers and (for severity scores) end users.

### P3 — Hygiene, not urgent
17. Clean up remaining stray root files (`Nexus`, `phase `, `pre-author generaotr cost integration`, `output_*.txt`, `.env 2`, `.gitignore 2`), fix the `.gitignore` gap for space-suffixed filenames, add basic CI (`qualityGate`/`testBillingMath` on push).

---

## 12. Open Questions Requiring Your Input

1. Is the patient data in `data/database.sqlite` synthetic or real? This changes §7.0 finding #2 from a hygiene fix to a possible compliance incident.
2. Should Ops Tools (QR intake, document classification table, query prediction, denial handling) be folded into the Case Queue/Workspace as the single coordinator-facing product, with the simulator retired — or is Ops Tools intentionally a permanent "back office"/QA console? This determines whether §2.2's two-identity split is a bug to fix or a boundary to formalize.
3. Is `gemini-3.5-flash` (`config/modelConfig.ts:1-2`) a real, callable model ID? If not, an unknown number of "Gemini calls" in this audit may currently be failing silently in whatever environment this is deployed to.
4. Do you want the P0 security items handled by you directly (key rotation, repo visibility, history scrubbing) before any implementation work starts, or in parallel with P1 work?

---

*This document was produced by six independent research passes over the actual source code (not the aspirational docs), each citing file:line evidence. No code was changed to produce it.*
