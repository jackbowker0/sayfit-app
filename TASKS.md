# SayFit Revival — Build Backlog (v1)

Generated 2026-06-17 from a codebase-mapping workflow (6 readers + planner + adversarial critic).
See [BRIEF.md](BRIEF.md) for thesis/scope and **[STRATEGY.md](STRATEGY.md)** for the market-grounded "best fitness app" plan (97-source research, 2026-06-23). T1–T11 = original revival build; **T12–T18 = the MFP-replacement tier derived from STRATEGY.md**. Sequencing rule: **smallest-shippable & solo-valuable first; nothing blocks on the Apple Developer account except T11 (HealthKit).**

> **Strategic north star (STRATEGY.md):** the shortest path to "credibly replaces MyFitnessPal + my lifting app" is — **food DB + free barcode (parity) → voice lifts polished (the wedge) → adaptive TDEE + "am I winning?" (the edge) → share loop (growth).** The whole thesis rests on logging being genuinely sub-5-seconds; prove the voice keystone *feels* right on a real device before pouring effort into the food-DB build.

## Status — 2026-06-17 (branch `feat/voice-log-lifts`, not pushed)
- ✅ **T1 DONE** (`dbc014d`) — voice-log lifts, stage-and-confirm, units-aware, PR-safe.
  - ➕ **Offline parser hardened 2026-06-23** (uncommitted) — `parseExerciseInput` now handles spoken number-words + gym-colloquial hundreds ("three by eight at one eighty five"=3×8@185, "two twenty five"=225, "three fifteen"=315, "two oh five"=205), the "by"/"times" separator, light-dumbbell weights via `at/with` cue (fixes "3x8 at 15" loss + the "squ**at**"→weight-cue false match), `rpe N` capture, and a `confidence:'low'` flag when reps were defaulted. Verified by an 18-case node suite (`/tmp/sayfit-parser.mjs`) + `node --check`. This is T2's offline fallback; the LLM Edge Function still handles freeform commentary.
- ✅ **T3 DONE** (`267f036`) — nutrition data model (local-first) + macro targets.
- ✅ **T4 DONE** (`2f36f7e`) — NutritionScreen + dashboard NutritionCard (manual meal tracking).
- Verified by ESM/bracket/structure checks only — **not yet run on a device** (`node_modules` not installed). Real proof = a dev build (voice STT needs native, not Expo Go).
- **Blocked / needs Jack:** T2 (confirm `ANTHROPIC_API_KEY` is a live Supabase secret — test: does the in-app AI coach reply?); T5–T9 (need `npm install` + camera deps + a build); T11 (just an `eas init` re-link — account already exists).
- **Next when unblocked:** dev build to dogfood T1+T4 → then T2 (robust voice parse) and T5/T6 (photo→macros).

## Resolved open flags (from the code, not assumptions)
- **Nutrition: CONFIRMED ABSENT.** Only trace is an orphaned `food_logs` RLS block in `supabase/migrations/20260225000000_*.sql` (ALTERs a table never CREATEd — would fail on a clean DB). No food/meal/macro code anywhere. "calorie" everywhere = calories *burned*.
- **Voice STT: ALREADY INSTALLED & PROVEN.** `expo-speech-recognition` is a dep, plugin-configured, mic-permissioned, and working in `src/screens/JustTalkScreen.js`. `src/services/voice.js` is a TTS-only mock — do NOT build on it.
- **AI client: EXISTS & well-architected.** RN never holds a key; it POSTs to Supabase Edge Functions (`functions/coach`, `functions/workout-gen`) that read `ANTHROPIC_API_KEY` from Deno env. New AI features clone that shape. `workout-gen` is text-only; vision needs an image content block + vision model.
- **Camera/photo: ABSENT.** No `expo-image-picker`/`expo-camera`/`expo-image-manipulator`. `app.json` camera/photo permission strings are "does not use…" placeholders that MUST be rewritten before photo features ship.
- **Apple Developer account: EXISTS (corrected 2026-06-17 by Jack).** The app already shipped to TestFlight and lives on his phone, so enrollment is done — the empty `eas.json` submit creds + `extra.eas.projectId` are just stale committed config (git shows projectId was always `""`; the real build used EAS's linked state / uncommitted config). T11 is therefore NOT enrollment-blocked — it only needs a mechanical re-link (`eas init` to repopulate projectId + fill submit creds), which Jack has done before. Everything in T1–T10 still ships without any of that.

## Model/effort per task (Jack's rule)
Opus 4.8 medium → T1, T2, T4, T7, T8 (units, PR, macro math, vision/RLS). Sonnet 4.6 low–med → T5, T6, T9 (UI screens). **Run `/code-review high` before T7/T8 ship** (health data + private storage).

---

## T1 — Voice-log lifts: stage-and-confirm, units-aware, PR-safe  ·  M  ·  solo  ·  blockedBy: none
**MERGES original T1+T2 per the critic's HIGH finding.** Voice must NOT be a one-shot save — it feeds the existing editable staging array (`exercises`) exactly like `handleParse`, so the user reviews before any PR write.
- [ ] Extract `addParsedExercises(parsed)` helper from `handleParse` (LogWorkoutScreen.js ~547: `setExercises` append + `loadOverloadForExercises` + `loadNotesForExercises`); call it from both the Type button and the new mic handler.
- [ ] Add a **Voice** mode tab (screen currently has only `text`/`form`, line ~769). Reuse the STT pattern from `JustTalkScreen.js` (lazy-require `expo-speech-recognition`, `useSpeechRecognitionEvent`, `requestPermissionsAsync`, `.start({lang,interimResults,continuous})`). Show the live transcript in an **editable** field before staging (lets the user fix mishears).
- [ ] **Units resolution:** make `parseExerciseInput(text, defaultUnit)` capture an explicit spoken unit ("kilos"/"pounds") and convert to `profile.units`; default to `profile.units` when no token. Backward-compatible (optional param). Store weight always in the user's unit.
- [ ] **Validation + sanity gate:** before `saveExerciseSession`, validate `{reps>0, weight>=0, name non-empty}`; flag outlier weights (absolute ceiling, or >2.5× the existing PR for that lift) and require a confirm so a mis-heard "825" can't silently write a permanent PR.
- [ ] **PR self-heal:** add `recomputePRs()` to `exerciseLog.js` (rebuild PR map from the full log) + a sanity ceiling guard in `checkAndUpdatePRs`, since the PR store is never lowered and has no undo today.
- [ ] **Fix source tagging** (real bug): `handleSave` tags typed input as `source:'voice'` (line ~604). Tag voice→`'voice'`, typed→`'text'`, form→`'manual'`; add a distinct PostHog event so the BRIEF's daily-use retention signal is measurable. Keep the `sayfit_exercise_log` + `sayfit_history` double-write (never bypass `saveWorkout`).
- files: `src/screens/LogWorkoutScreen.js`, `src/services/exerciseLog.js`, `src/services/userProfile.js`, `src/screens/JustTalkScreen.js` (pattern ref)

## T2 — Lift-parse Edge Function (robust spoken phrasing)  ·  M  ·  solo  ·  blockedBy: T1; ANTHROPIC_API_KEY secret
On-device regex mis-parses verbal numbers ("three by eight", "one eighty five") and defaults reps to 10. Clone `functions/workout-gen` → `functions/lift-parse` (model `claude-haiku-4-5`, ~$0.001/parse, output ONLY JSON, snap names to `ALL_EXERCISE_NAMES`). Register `[functions.lift-parse]` in `config.toml` + `scripts/setup-supabase.sh`. Client path mirrors `workoutGenerator.js` brace-extraction. **Keep on-device parse as offline fallback.**
- files: `supabase/functions/workout-gen/index.ts`, `supabase/config.toml`, `scripts/setup-supabase.sh`, `src/services/workoutGenerator.js`, `src/screens/LogWorkoutScreen.js`

## T3 — Nutrition data model (local-first)  ·  M  ·  solo  ·  blockedBy: none
Clone `src/services/bodyWeight.js` → `src/services/nutrition.js` (key `sayfit_nutrition_log`) with CRUD + daily aggregation (`getNutritionStats` ~ `getWeightStats`). Entry: `{id, date, mealType, source, photoUri, items:[{name,qty}], macros:{kcal,protein,carbs,fat}, confidence, editState}`. Use **`kcal`** NOT `calories` (codebase overloads "calories" = burned). Per-user macro targets via `userProfile.js`. Pure data layer, fully testable, no AI/camera.
- files: `src/services/bodyWeight.js` (template), `src/services/userProfile.js`, `src/constants/icons.js`

## T4 — NutritionScreen + manual entry + dashboard card  ·  L  ·  solo  ·  blockedBy: T3
Mirror `WeightScreen`/`WeightCard`. Register a `Nutrition` Stack.Screen in `App.js` (after Weight, ~line 124). NutritionCard shows today's protein/kcal vs target. Manual entry first = smallest shippable nutrition value, no camera/AI.
- files: `src/screens/WeightScreen.js` (template), `src/components/WeightCard.js`, `src/screens/DashboardScreen.js`, `App.js`

## T5 — Camera/photo capture plumbing  ·  M  ·  solo  ·  blockedBy: T4
Add `expo-image-picker` **and `expo-image-manipulator`** (critic: resize is mandatory or photo cost ~3×). Plugin in `app.config.js`. **Rewrite** the placeholder `NSCameraUsageDescription`/`NSPhotoLibraryUsageDescription` in `app.json` (App Store rejects the mismatch). Capture/pick → downsample to ~1080px (hard requirement) → base64 via `expo-file-system`.
- files: `package.json`, `app.config.js`, `app.json`, nutrition capture UI

## T6 — estimate-macros vision Edge Function  ·  L  ·  blockedBy: T3, T5
Clone `workout-gen` → `functions/estimate-macros`, add image content block, model `claude-sonnet-4-6` (~$0.011/photo; opus-4-8 optional high-accuracy retry). **Add explicit `[functions.estimate-macros] verify_jwt=true` to `config.toml`** (critic: workout-gen has no config block, so a naive clone deploys world-callable). Returns `{items,kcal,protein,carbs,fat,confidence}`.
- files: `supabase/functions/workout-gen/index.ts`, `supabase/config.toml`, `scripts/setup-supabase.sh`, `src/services/nutrition.js`

## T7 — Private meal-photos bucket + storage RLS  ·  M  ·  blockedBy: T6  ·  /code-review high
SPLIT from T6 per critic (HIGH privacy). PRIVATE `meal-photos` bucket (NOT public like share-cards), owner-only RLS + signed URLs. Explicit test: unauthenticated/other-user fetch is denied. Add `ENABLE ROW LEVEL SECURITY`. **Mask nutrition/photo screens in PostHog session replay** (`enableSessionReplay:true` is on).
- files: `supabase/config.toml`, `scripts/setup-supabase.sh`, `src/services/shareCards.js` (upload template), `src/services/nutrition.js`, posthog config

## T8 — Per-user quota on the vision endpoint  ·  M  ·  blockedBy: T6  ·  /code-review high
NEW task (critic: rate-limiting was prose, not a task). Zero rate limiting exists today and the anon key ships in the bundle. Add a per-user daily quota on `estimate-macros` before it's reachable from any build others can install.
- files: `supabase/functions/estimate-macros/index.ts`, a counter table or `nutrition_logs/today` check

## T9 — Editable AI-estimate confirm flow + vision-failure UX  ·  M  ·  blockedBy: T6  ·  /code-review high
AI macro estimate must be clearly editable and must NOT count toward daily totals until `editState==='confirmed'`. Specify failure UX (critic): on timeout/parse-fail keep the photo, fall back to manual entry, never persist an unconfirmed entry; timeout + single retry budget.
- files: nutrition entry/confirm UI, `src/services/nutrition.js`

## T10 — Fuel share/feed/leaderboard with new artifacts  ·  L  ·  multiplayer  ·  blockedBy: T1, T9
Reuse ShareCard/customizer/feed verbatim (upload path already accepts any local image URI). Voice PRs route through the existing CompleteScreen ceremony. Add a meal stat schema to ShareCardCustomizer + a FeedPostCard meal branch. **Document limits:** leaderboard write/rank path doesn't exist (read-only client); meals don't feed challenges/leaderboard. Multiplier, not a solo gate.
- files: `src/services/shareCards.js`, `src/components/ShareCardCustomizer.js`, `src/components/FeedPostCard.js`, `src/screens/CompleteScreen.js`

## T11 — EAS re-link + HealthKit import  ·  L  ·  blockedBy: `eas init` re-link (Apple account already exists)
Account enrollment is DONE (app already on TestFlight). Re-link the EAS project: `eas init` (projectId empty; `appVersionSource=remote` fails builds until linked) + fill `eas.json` submit creds. Then add a HealthKit lib + config plugin, read-import cardio/steps/active-energy into the dashboard (active energy = BURNED, keep distinct from nutrition kcal CONSUMED). Needs an iOS device build to test. Sequenced last so it blocks nothing — but no longer hard-gated, so it can move up if cardio matters for the dogfood test.
- files: `eas.json`, `app.json`, `app.config.js`, `package.json`, `src/screens/DashboardScreen.js`

---

# Tier 2 — MFP-replacement backlog (T12–T18, from STRATEGY.md)

These turn SayFit from "voice-log + nutrition app" into a credible all-in-one MFP/Hevy replacement. **Gating insight:** the food database + free barcode scanner (T12) is the single biggest parity gap *and* one of the cheapest to stand up — but it's downstream of proving voice feels right (the hit-signal test). Sequence accordingly.

## Model/effort per task (Tier 2)
Opus 4.8 medium → T12 (food-data integrity + dedup), T15 (adaptive TDEE math — back-calculation is data-integrity-critical), T17 (paywall/billing). Sonnet 4.6 low–med → T13, T14, T16, T18 (UI/onboarding/share, behind a test gate). **Run `/code-review high` before T17 (billing) and any photo/body-image storage ships.**

## T12 — Food database + FREE barcode scanner (the parity keystone)  ·  L  ·  solo  ·  blockedBy: T5 (camera plumbing); voice hit-signal validated first
The single biggest gap between SayFit and "credible MFP replacement." Stack (near-$0): **Open Food Facts** primary barcode lookup (4M products, ODbL, offline-cacheable) → **FatSecret Platform Basic** silent fallback on OFF 404 (free tier) → **USDA FoodData Central** for generic staples. Scanner via **`react-native-vision-camera` + `…-barcode-scanner`** — ONE camera instance also serves T5/T6 photo-macros, so reconcile with the `expo-image-picker` choice in T5 (vision-camera likely supersedes it). Cache every lookup in **`expo-sqlite`** for offline scanning (a real edge over MFP). **Barcode scanning MUST stay permanently free** — it's MFP's most-hated paywall and our #1 refugee magnet. Add OFF attribution on the About screen (ODbL compliance). Defer Nutritionix ($1,850/mo, US chains) to post-revenue.
- files: `package.json`, `app.config.js`, `app.json` (camera strings), new `src/services/foodDatabase.js`, `src/services/nutrition.js`, new SQLite cache layer
- risk: **ODbL licensing edge case** (don't redistribute a merged OFF+proprietary dataset) — confirm at legal.openfoodfacts.org before App Store submission. OFF restaurant/generic coverage is thin; FatSecret fallback is load-bearing.

## T13 — Food diary + manual entry + macro totals (one-tap surfaced)  ·  M  ·  solo  ·  blockedBy: T12 (or ships partial on T3 data)
The everyday MFP loop. Surface the diary at ONE tap (MFP's 2026 redesign buried it — direct counter). Hero metric = **progress-toward-goal**, never a raw deficit number (shame trigger). Add **copy-yesterday / save-meal** shortcut (MFP removed copy-meal in 2026 — cheap refugee win). Builds on the T3 `nutrition.js` data model + T4 NutritionScreen.
- files: `src/services/nutrition.js`, `src/screens/NutritionScreen.js`, `src/components/NutritionCard.js`

## T14 — 30-second personalized onboarding → TDEE/macro target  ·  M  ·  solo  ·  blockedBy: none
Deliver a personal number in <30s of first launch: 4–5 questions (goal, weight, height, activity, **"what made you quit tracking before?"**) → show estimated TDEE + macro target + projected outcome BEFORE asking for any work. AI personalization → up to 50% higher retention. This is also where the T17 paywall lands (end of onboarding, once they've seen their plan).
- files: new onboarding flow, `src/services/userProfile.js`, `src/services/exerciseLog.js` (TDEE calc)

## T15 — Adaptive TDEE engine (MacroFactor-style)  ·  L  ·  solo  ·  blockedBy: T13 (needs intake data) + body-weight log  ·  /code-review high
The signature edge no all-in-one has. Back-calculate true expenditure weekly from **logged intake vs. weight trend**, then recalibrate macro targets. Must be **adherence-neutral** — partial logging can't corrupt the estimate (graceful degradation). MacroFactor owns this but has no workout tracker; SayFit + this = a genuine first. **Data-integrity critical — Opus medium, not a Sonnet one-shot.**
- files: new `src/services/adaptiveTargets.js`, `src/services/bodyWeight.js`, `src/services/nutrition.js`, `src/services/userProfile.js`
- risk: degrades on sparse data (needs near-daily weigh-ins + complete logs) — design for missing days, never show a wild target swing.

## T16 — "Am I winning?" narrative dashboard + streaks-with-forgiveness  ·  M  ·  solo  ·  blockedBy: T15 (verdict needs adaptive targets) + lift/macro data
WHOOP-style 3-tier progressive disclosure: tier-1 plain-English one-liner ("On track — 0.4 lb/week toward goal"), tier-2 trend chart, tier-3 raw breakdown. Fuses weight trend + macro adherence % + lift progression. **Doesn't exist as a polished product anywhere** — and it's the most shareable artifact (feeds T18). Add **streaks with a forgiveness layer** (shield = one free miss/week + comeback bonus; rigid streaks trigger the abandonment spiral). Never show shame-framing.
- files: `src/screens/DashboardScreen.js`, new `src/services/winningVerdict.js`, streak logic in `userProfile.js`/`nutrition.js`

## T17 — Hard paywall + 7-day trial + billing/security gate  ·  M  ·  blockedBy: T14 (paywall lands at onboarding end)  ·  /code-review high
Hard paywall, 7-day free trial, shown at the END of personalized onboarding (86% of conversions happen Day 0). **$9.99/mo or $69.99/yr**, annual default + "Best Value" badge. One tier, no Premium/Premium+ split. Wire via RevenueCat or StoreKit2. **Billing must be airtight + run the security gate** before any growth push (Cal AI got pulled for deceptive billing + had a 3.2M-user breach — viral distribution amplifies trust failures). Audit the privacy manifest here (see Known limitations).
- files: new paywall screen, IAP service, `app.json` entitlements
- risk: App Store billing-clarity rules are strict; get the trial→charge disclosure exactly right.

## T18 — Shareable PR/receipt cards + read-only friends feed  ·  M  ·  multiplayer  ·  blockedBy: T1, T16  ·  builds on existing share layer
Product-led growth loop (Jack won't grind content). **Own the share template** — auto-generate: (1) **voice-logged PR card** on a new 1RM ("First 225 bench — logged by voice. SayFit"), (2) **Sunday "receipt"** (PRs, macro hit-rate, weight arrow, streak), (3) **"am I winning?" weekly card**. Add a **read-only friends feed** ("friends' recent lifts") + consented "your friend hit a PR" pull-notification — social-embedded users churn ~30% less. Reuses the existing ShareCard/customizer/feed (T10 overlaps — merge). ASO: own long-tail terms ("voice workout logger", "speak your sets", "snap meal macros"), keyword-rich screenshot captions, per-cluster Custom Product Pages; seed one community (r/weightroom, r/leangains) at launch.
- files: `src/services/shareCards.js`, `src/components/ShareCardCustomizer.js`, `src/components/FeedPostCard.js`, `src/screens/CompleteScreen.js`, App Store Connect (ASO, CPPs)

---

# Tier 3 — "Everything app" pillars (T19–T23, from STRATEGY.md Addendum)

These turn SayFit from an MFP+lifting replacement into the all-in-one **self-directed health protocol** app. **HARD GATE: none of these is built until the core loop (voice lifts + photo macros + adaptive TDEE + "am I winning?" dashboard) is proven sticky.** The moat pair (T21 biomarker fusion + T19 protocol) is the ONE thing worth pulling early once the core retains — it's the defensible core no incumbent can copy (they lack the training/nutrition half) and its window is ~12–18 months. T22/T23 are LATER.

**App Store gate:** CONDITIONAL-GO — public build = generic "medication & protocol tracker" (user-typed doses only, clinical copy, disclaimers, first-run acknowledgment gate); PED-cycle vocabulary (on/off-cycle, PCT, blast-and-cruise) stays behind a **config flag in the personal/TestFlight build only**. Never ship an auto-calculated dose or market a "dosage calculator" (guideline 1.4.2). Track-don't-prescribe is a permanent design constraint.

## Model/effort per task (Tier 3)
Opus 4.8 medium → T19 (protocol/dose data-integrity), T21 (biomarker OCR ingest + overlay correctness). Sonnet 4.6 low–med → T20, T22, T23 (reminders/meal-plan/mobility UI behind a test gate). **Run `/code-review high` + the security gate before T19/T21 ship (health PII + HealthKit surface 5.1.3).**

## T19 — Hormone/peptide protocol tracker  ·  M  ·  [MOAT]  ·  blockedBy: core loop proven; pairs with T21  ·  /code-review high
Generic compound tracker: user defines ANY compound (name, dose, unit, schedule), logs dose/site/timing, injection-site rotation map. Public-build framing = "medication & protocol tracker" with first-run acknowledgment gate + disclaimers ("informational only, not medical advice"; "only track substances legally prescribed/obtained"). **Dose entry always user-typed + user-confirmed — no auto-calc.** PED-cycle vocab (on/off-cycle, PCT) behind a personal-build config flag. Seed default = Jack's own protocol (200mg/wk test + retatrutide) for dogfood. Skip: PK ester-curve modeling.
- files: new `src/services/protocol.js`, protocol screen, config-flag plumbing, `app.json` (store copy audit)

## T20 — Supplement/med AM-PM reminder stack  ·  S  ·  [RETENTION]  ·  blockedBy: T19 (shares reminder infra)
AM/PM "stack" checklist anchored onto the existing weigh-in/workout-log moment (prompt where motivation already is). Streak **with a grace mechanic** (freeze/partial decay, never hard-reset — shame-inducing for medical stakes). Tiered notifications: gentle nudge for supplements, alarm-style for TRT-injection/peptide days. Seed default = Jack's real stack (creatine, electrolytes, fish oil, citrus bergamot, boron, multi). Skip: drug-interaction checks, refill tracking, caregiver escalation.
- files: `src/services/protocol.js`, notification service, dashboard checklist component

## T21 — Biomarker/bloodwork trend ingest + fused overlay  ·  M→L  ·  [MOAT — the fusion half]  ·  blockedBy: core loop proven; pairs with T19  ·  /code-review high
The defensible core. OCR/PDF/manual ingest of lab panels from **any** provider (Quest, LabCorp, Function, Marek). Overlay chart plots T / E2 / hematocrit / lipids / A1C **on the same timeline as lift PRs, body-comp, and macro adherence** — the "am I winning on my health markers?" view no incumbent ships. LATER (L): AI-coach causal insight ("hematocrit up 3 panels as volume climbed"; "E2 spike tracks refeed carbs"). Jack's own two panels (Jan/May, lipids+E2+T trend) are the test fixtures. Skip: running blood draws; supplement-upsell funnel. HealthKit surface → verify guideline 5.1.3.
- files: new `src/services/biomarkers.js`, OCR/ingest (vision Edge Function clone of estimate-macros), overlay chart on `DashboardScreen.js`

## T22 — Meal-plan / anchor-meals + grocery + prep  ·  M  ·  [PARITY, differentiated]  ·  LATER (after moat)
Productizes Jack's manual cut workflow. Anchor-meal library (repetition as a feature — "cut mode" deliberately boring/cheap/locked), auto-schedule anchors to close the day's remaining macro gap, batch-scaled consolidated grocery list, templated prep steps, **manual per-staple price field** → "this week ≈ $X" (cost+macro combo no competitor ships). Generate from macros + logged history SayFit already owns. Skip: recipe-discovery/variety engine, live retailer price APIs. (Jack already has a working prototype — the claude.ai "Cut Dashboard" artifact — to port the UX from.)
- files: new `src/services/mealPlan.js`, meal-plan + grocery screens

## T23 — Mobility/prehab screen + desk-break flow  ·  M  ·  [NICE-TO-HAVE]  ·  LATER (after moat)
Periodic **mobility screen** (10-part assessment, à la GOWOD) → a mobility score over time that plugs into the "am I winning?" framing (more defensible IP than video). Short daily desk-break routine driven from a small (10–20) GIF/static exercise library, targeting desk-posture back/neck (the underserved niche). Skip: produced-video instructor library, 30-day programs (that's a content business — license or link out).
- files: new `src/services/mobility.js`, mobility screen + routine player, small asset library

---

## Known limitations to document (not blockers, from critic LOW findings)
- `getOverloadSuggestion`/`getSmartRestDuration` hardcode lb plate math (50/135/225, weight≥185) — wrong for kg users. Branch on `profile.units` or document "assumes lbs". Matters since Jack dogfoods.
- BRIEF dashboard lists body **measurements** + cardio/active-energy; measurements has no task yet, and cardio is Apple-gated. Don't run the daily-use kill test against an intentionally incomplete dashboard.
- Base workout/exercise tables are ALTERed but never CREATEd in committed SQL — a clean DB reset would fail. Fix if/when nutrition goes cloud-synced (T6+).
- Privacy manifest (`app.json` → `ios.privacyManifests`): keys were fixed for prebuild (`NSPrivacyDataType*` → `NSPrivacyCollectedDataType*`). Two ship-time cleanups before App Store submission: (1) `NSPrivacyCollectedDataTypeHealthAndFitness` isn't a real Apple constant — split into `…Health`/`…Fitness` AND only declare it once HealthKit (T11) actually collects it; (2) DeviceID/UserID collected for PostHog analytics should arguably use the `…PurposeAnalytics` purpose, not only `…AppFunctionality`. The pre-ship-security/ship gate should audit this.

---

# ═══ RED PILL BACKLOG — 2026-07-08 ═══

Derived from the full competitive pass (11 research briefs, ~60 sources), a 3-dimension code review (data-integrity + backend/security + crash-paths), and a code inventory. Full write-up: the "SayFit — Red Pill Report" artifact. Jack's decision: **"get everything mentioned in the works."** These are RP-numbered to sit alongside T1–T23; the market rationale for each lives in the report. Sequencing rule unchanged: protect the daily log path, ship data-safety before features.

## Model/effort (Jack's rule)
Fable/Opus **medium** → all RP-P0 data-integrity + RP-SEC (medical-log + auth/money). Sonnet **low–med** → RP food-DB UI, modularity onboarding, Coach UI. Reserve a `/code-review high` before RP-SEC and the food-DB tier ship.

## RP-P0 — Data-safety cluster (verified bugs; DONE 2026-07-08, commit `5d3e11b`)
- [x] **Weight split-brain** — WeightScreen wrote `sayfit_weight_log`; service/dashboard read `sayfit_body_weight`. Unified on the service + one-time `migrateLegacyWeightLog()` (never overwrites canonical). 
- [x] **WeightScreen one-tap wipe** — persisted from possibly-empty React state after a failed load. Now writes through the service + reads back.
- [x] **UTC day keys** — `nutrition.js` + `bodyWeight.js` used UTC (evening entries tagged tomorrow / overwrote prior day). Now local, matching `protocol.js`. Behaviorally verified (9:30pm ET stays same day).
- [x] **Health data → analytics** — dropped compound name/amount/unit/route from `protocol_dose_logged`, macro values from `meal_logged`; **session replay OFF** (was capturing dose/site/macros on-screen).
- [x] **Notification/deep-link crash** — PostDetail expected `post`, push sends `postId`. Guarded both entry points.
- [x] **Coach identity reset** — `coachId` never rehydrated from profile; Settings Save then clobbered the real pick. Rehydrate on launch (WorkoutContext).
- [x] **Open `workout-gen` edge fn** — no config block (no JWT). Added `verify_jwt=true`. ⚠ needs `supabase functions deploy workout-gen` to take effect.
- [x] **No backup** — added Settings → **Export My Data** (JSON of every `sayfit_*` key to the share sheet). New `src/services/dataExport.js`.

## RP-P1 — Data-integrity, next tier (before anyone else uses it)
- [x] **Corrupt-parse → erase pattern** (`c179eb1`) — new `src/services/safeStore.js` (safeReadArray quarantines a corrupt blob to `<key>__corrupt__<ts>`; safeWriteArray refuses to overwrite an unpreserved key). Adopted in the append-only logs: storage(history), bodyWeight, nutrition, protocol(dose log + stack log), exerciseLog(`ffa9115`). Verified. **Remaining:** seeded stores (compounds/stack) + exerciseNotes + achievements still use plain try/catch — lower stakes (re-derivable), adopt when touched.
- [x] **Atomic dose logging** (`c179eb1`) — single `logDose({editState:'manual'})` write; dropped the second confirmDose write.
- [x] **Read-modify-write races** (`cb955a7`) — synchronous `savingRef` guard on Save Workout; `safeStore.serialize()` per-key mutex on `toggleStackTaken`. Both verified.
- [ ] **Edit/delete for logged lifts.** DEFERRED (feature-sized; wants device testing). Add `deleteExerciseSession(id)` (remove from `sayfit_exercise_log` + call the now-unit-aware `recomputePRs`) and a delete/edit affordance (Calendar's WorkoutDetailSheet or Progress). Durable fix for a mis-parsed permanent PR. files: `exerciseLog.js`, a detail sheet.
- [x] **Unit-switch safety — ceiling half** (`ffa9115`) — sessions stamp their unit; `checkAndUpdatePRs`/`recomputePRs` use `ceilingForUnit()` (kg ceiling ~680kg). **DEFERRED (part a):** converting EXISTING stored weights across ALL stores on a units switch — needs one idempotent, schema-versioned migration; a partial conversion is worse than none. Best with device testing.
- [x] **Ship Protocol empty** (`31e7b74`) — `src/config/features.js` `SEED_PERSONAL_PROTOCOL=false` gates both seeds; public builds start empty. Dogfood device keeps its data (seed only wrote on first null read).
- [x] **Streak math** (`5fb4bca`) — DST-safe calendar-day stepping in `storage.js`; `CalendarScreen` map + streak on local day keys. Verified (Oct31/Nov1/Nov2 ET → 3, was 1).

**RP-P1 status: 5 of 7 done + committed; 2 deferred (lift edit/delete UI, full unit-conversion migration) — both want device verification.**

## RP-SEC — Backend / security (before ANY external user)
- [ ] **Rate-limit + real auth on AI edge fns.** Anon key ships in the bundle and is not an auth boundary; no per-user throttle or input-length cap on `coach`/`workout-gen` → anyone can loop them and drain the Anthropic budget. Require an end-user JWT (not anon), derive `user_id`, add a per-user counter + max prompt length. (config parity already done in RP-P0.)
- [ ] **Prompt-injection hardening.** Move prompt assembly server-side; pass user text (name, raw workout request) as clearly-delimited untrusted data; validate `workout-gen` JSON defensively.
- [ ] **Secure service-role fns.** `push-notification` + `refresh-leaderboard` run service-role with `verify_jwt=false` and no caller secret, and echo raw `error.message`. Add a webhook/cron shared secret; stop leaking internals. (Moot while parked, fix before social returns.)

## RP-COMMUNITY — Park it (recommended)
- [ ] **Feature-flag the social entry points OFF.** The Home-header Users icon + any nav into SocialFeed/Challenges/Leaderboard/PostDetail/UserProfile. Leave the code + the `feed_posts`/`challenges`/etc. tables dead (all 404 today anyway). Keep the share-card generator (the viral artifact works without a feed). Revisit only as **friends-only accountability** when real humans use the app (public feeds don't retain; small-circle does). files: `App.js` (drop the Users icon), a `FEATURES.social` flag.
- [ ] (Deferred) If/when social returns: recreate base `workouts`/`exercises`/`food_logs` migrations (schema unrecoverable from repo — hand-made in the old dashboard) + the `push-notification` DB webhook (never versioned).

## RP-COACH — Rebuild as a data-grounded narrator
- [ ] **Kill the mocked pattern.** Remove "Motivate me"/generic-motivation pills (the exact interaction reviewers mock — Apple Workout Buddy, Strava AI). 
- [ ] **Build the "specific · falsifiable · new" coach.** Coach reads lifts + macros + weight trend + protocol adherence (+ later labs) and every reply CITES the numbers ("volume down 18% vs last week, so I moved leg day") — this attacks the one weakness Fitbod/Juggernaut never solved (repetitive, can't-explain, ignores-corrections). Must take corrections. Route anything medical-adjacent to "flag for your doctor," never confident advice (WHOOP-Coach failure mode). files: `ai.js`, `coach` edge fn (real reasoning w/ the fused context), `CoachScreen.js`.
- [ ] **Explainable workout gen.** When it generates a plan, anchor to recognizable templates (PPL, 5/3/1) with transparent progression rules, not a black box; surface AI-vs-local-fallback honestly in the UI.

## RP-FUEL — The MFP-replacement gap (largest feature debt; see also T5/T6/T12)
- [ ] **Food database + free barcode scan.** Open Food Facts + USDA FoodData Central (both free/CC0) as the base layer, SQLite cache, barcode via the camera. **Barcode is table stakes and must stay free forever** (MFP's 2022 paywall is the category's defining own-goal). files: new `src/services/foodDb.js`, barcode screen, cache.
- [ ] **Voice food logging.** Reuse the lift-parse pattern ("I ate 3 eggs and toast") → DB match → structured log. Route the QuickAddMic to Fuel too (today it only hits workout logging). Fail gracefully to search/manual.
- [ ] **Adaptive TDEE (the MacroFactor magic, cheap version).** Weekly intake-trend vs weight-trend → auto-adjust the macro target. ~80% of the value of MacroFactor's model; nobody else bothers. files: `nutrition.js`, `userProfile.getMacroTargets`.
- [ ] **Fast-log floor.** Whatever else, keep every log ≤2-3 taps (previous entry ghosted in). Friction — not feature count — is what kills all-in-one apps.

## RP-MODULARITY — Pick-your-pillars (recommended: actually remove tabs)
- [ ] **Onboarding "What do you want to track?"** — Lifts / Food / Protocol (multi-select); Home + Coach always present. Unchosen pillars get **no tab** (a lifts-only user sees Home · Train · Coach). Disabled pillars live as a one-tap "Add tracking" row on Home/Settings — never deleted, no re-onboarding. Inside pillars, Samsung-style card show/hide. (Buildable + low-risk with 5 tabs; industry norm is fixed tabs + hidden cards, but our shape supports the stronger version.) files: `App.js` (conditional tab registration), onboarding, a `pillars` profile field + `FEATURES`.

## RP-EXERCISE-CONTENT — Media = table stakes, not a differentiator
- [ ] **License, don't film, don't skip.** 86 exercises already have text steps/tips/breathing (good). When media is wanted: a white-label video library (~$19/mo, e.g. Your Move) or MuscleWiki API (7,500+ clips) — NEVER film, never AI-generate imagery (a loyal Alpha Progression user: AI images "souring me on the whole experience"). Spend effort on **database breadth + free custom exercises** (missing exercises draw complaints even in 5-star reviews). files: `exercises.js` (media field), `ExerciseGuide.js`.

## RP-MONETIZATION — Rules to lock before pricing (from the graveyard)
- Never paywall barcode scanning. · Never move the paywall line back (Strong's lifetime removal → the Hevy exodus). · Free CSV export from day one + **import Strong/Hevy CSV** (switcher funnel; RP already ships JSON export — add CSV). · Never hold data hostage on lapse (Juggernaut's most-resented policy). · No ads/upsell nag in the log path (Cronometer/Lose It paywall analytics instead). · No AI-slop imagery anywhere.

## RP cleanup (mechanical)
- [ ] Delete dead code: orphaned `src/screens/workoutGenerator.js` (440 LOC, unused dup) + `src/screens/HomeScreen.js`.
- [ ] `ProfileBadges` reads `earned_badges` (not a real column) — wire to local `achievements.js` or drop.
- [ ] Reconcile `supabase/.temp/project-ref` (old `dwsvhrxjyfbdkbjcygel`) with the live `.env` project (`xqlpojfuptmrwyfadpnz`) so deploys land in the right place.
