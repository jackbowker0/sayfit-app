# SayFit Revival — Build Backlog (v1)

Generated 2026-06-17 from a codebase-mapping workflow (6 readers + planner + adversarial critic).
See [BRIEF.md](BRIEF.md) for thesis/scope. Sequencing rule: **smallest-shippable & solo-valuable first; nothing blocks on the Apple Developer account except T11 (HealthKit).**

## Status — 2026-06-17 (branch `feat/voice-log-lifts`, not pushed)
- ✅ **T1 DONE** (`dbc014d`) — voice-log lifts, stage-and-confirm, units-aware, PR-safe.
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

## Known limitations to document (not blockers, from critic LOW findings)
- `getOverloadSuggestion`/`getSmartRestDuration` hardcode lb plate math (50/135/225, weight≥185) — wrong for kg users. Branch on `profile.units` or document "assumes lbs". Matters since Jack dogfoods.
- BRIEF dashboard lists body **measurements** + cardio/active-energy; measurements has no task yet, and cardio is Apple-gated. Don't run the daily-use kill test against an intentionally incomplete dashboard.
- Base workout/exercise tables are ALTERed but never CREATEd in committed SQL — a clean DB reset would fail. Fix if/when nutrition goes cloud-synced (T6+).
- Privacy manifest (`app.json` → `ios.privacyManifests`): keys were fixed for prebuild (`NSPrivacyDataType*` → `NSPrivacyCollectedDataType*`). Two ship-time cleanups before App Store submission: (1) `NSPrivacyCollectedDataTypeHealthAndFitness` isn't a real Apple constant — split into `…Health`/`…Fitness` AND only declare it once HealthKit (T11) actually collects it; (2) DeviceID/UserID collected for PostHog analytics should arguably use the `…PurposeAnalytics` purpose, not only `…AppFunctionality`. The pre-ship-security/ship gate should audit this.
