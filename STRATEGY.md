# SayFit — Strategy Brief

*Synthesized from a 6-angle research dossier (MFP teardown, competitor landscape, food-data infra, retention design, virality/monetization, AI differentiation), 97 sources. Last updated 2026-06-23.*

---

## 1. The wedge / positioning

**SayFit is the one app that logs your lifts by voice AND your meals by photo, then tells you in plain English whether you're winning — so you cancel both MyFitnessPal and Strong/Hevy and pay for one thing.**

It steals from **two camps at once**: MFP/Cal-AI nutrition users (who have no real strength tracking) and Hevy/Strong lifters (who have no nutrition). Nobody credibly owns the intersection — that three-way gap (voice lifts + photo macros + cross-domain coaching) is structurally hard for legacy apps to close because their data models were never fused.

**Why a user drops MFP + their lifting app for SayFit:**

1. **Voice-log lifts is free here and $80/yr-locked in MFP.** Every MFP free user is a direct acquisition target with a keystone feature they literally cannot get without paying. And it replaces their separate $24–30/yr lifting app entirely.
2. **One subscription replaces two.** MacroFactor ($72/yr) + Hevy ($24/yr) = ~$96/yr of shared-context-zero apps. SayFit does both with shared context for less.
3. **It answers "am I winning?"** — MFP and Cal AI show numbers and stop. SayFit fuses weight trend + macro adherence + lift progression into one readable verdict. Numbers → guidance is the gap every incumbent leaves open.

---

## 2. MyFitnessPal parity checklist (table stakes)

To be a *credible* MFP replacement, SayFit must not lose on the basics. Ordered by importance:

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | **Food database + barcode scanner** | **[MISSING — HARD DEPENDENCY]** | The single biggest build. See stack below. Barcode scanning must be **permanently free** — it's MFP's most-hated paywall. |
| 2 | Manual food entry + food diary | [MISSING / BUILDING] | The diary must be surfaced at one tap (MFP's 2026 redesign buried it — direct counter). |
| 3 | Daily calorie + macro totals | [MISSING / BUILDING] | Hero metric must be *progress-toward-goal*, never a raw deficit number (shame trigger). |
| 4 | Photo-to-macros meal logging | **[BUILDING]** | In flight. MFP just paywalled this in May 2026 — ship it **free** for ASO/word-of-mouth. |
| 5 | Voice-log lifts (set/rep/weight) | **[BUILDING]** | The keystone. MFP has zero strength depth. |
| 6 | Set-by-set strength tracking + progressive overload / PRs | [MISSING / BUILDING] | MFP's biggest void. Tonnage, 1RM trend, PR detection. |
| 7 | Custom macro goals | [MISSING] | MFP paywalls this. Free here. |
| 8 | HealthKit sync (steps, weight, HR, sleep) — incl. **nutrition write-back** | [PLANNED] | MFP does *not* write nutrition back in free tier. Differentiator + lock-in. |
| 9 | AI coach personas / social-share layer | **[HAVE]** | Existing. Repoint toward lifts/PRs/body-comp (see §5). |
| 10 | Recipe / meal save + copy-yesterday shortcut | [MISSING] | MFP removed copy-meal in 2026 — cheap win, direct refugee magnet. |
| 11 | Ad-free, always | [HAVE by design] | "Ads every time I log" is a top MFP churn quote. Never put ads in the logging loop. |

### Recommended food-data + scanning stack (ship-fast, near-zero cost)

- **Barcode / packaged foods → Open Food Facts** (4M+ products, free, ODbL, no rate limit on per-user scans). Primary lookup. **$0.**
- **Fallback + US restaurant/auto-complete → FatSecret Platform "Basic"** (2.3M foods, 5,000 calls/day free; Premier-Free is unlimited for startups). Silent fallback on OFF 404. **$0** until revenue.
- **Generic staples (chicken, rice, oats) → USDA FoodData Central** (free, no key, no quota, deep micronutrients). **$0.**
- **Camera primitive → `react-native-vision-camera` v5 + `react-native-vision-camera-barcode-scanner`.** One prebuild, one camera instance serves **both** barcode scanning and photo-to-macros. SayFit already needs the camera for meals, so the prebuild cost is already paid. Debounce the ~30/sec callback; pin explicit `barcodeFormats`.
- **Cache every lookup locally** (`expo-sqlite`) — OFF's ODbL permits storing for the end user; this gives **offline scanning**, a real edge over MFP.
- **Defer Nutritionix** ($1,850/mo) until post-revenue — it's the only gap (US chain restaurants). Optionally use its natural-language endpoint later for voice food-logging.
- **Skip Spoonacular + Edamam** — no barcode / no-caching terms.
- **Licensing:** ODbL share-alike applies to the *database*, not your app code. Add OFF attribution on the About screen and you're compliant. Don't redistribute a merged OFF+proprietary dataset.

**Bottom line: the food DB is the gating item between SayFit and "credible MFP replacement." It's also the cheapest to stand up. Build it first.**

---

## 3. The signature edge (where SayFit *wins*, not matches)

AI photo-calorie is now commoditized (Cal AI proved it, then got absorbed by MFP). Matching it is table stakes. Winning requires these:

1. **Voice-log lifts done defensibly great.** The STT is commodity; the moat is the **gym-syntax parser** ("3x8 at 185, last set was a grinder" → exercise/sets/reps/weight/RPE) and the **downstream data model** (volume, tonnage, 1RM trend, PR detection). The voice button must be the *first tap* on the workout screen with zero navigation — it competes with doing nothing. Sub-5-second logging is the bar.

2. **Adaptive TDEE engine (MacroFactor-style) — the thing no all-in-one has.** Back-calculate true expenditure weekly from *logged intake vs. weight trend*, then recalibrate macro targets. Make it adherence-neutral so partial logging doesn't corrupt it. MacroFactor owns this but has **no workout tracker**; SayFit + this engine is a genuine first.

3. **The "am I winning?" narrative dashboard.** A daily/weekly **plain-English verdict** fusing weight trend + macro adherence % + lift progression (+ optional Apple Watch recovery). WHOOP-style progressive disclosure: tier-1 one-liner ("On track — 0.4 lb/week toward goal"), tier-2 trend chart, tier-3 raw breakdown. **This does not exist as a polished product anywhere.** It's also the most shareable artifact you have.

4. **Cross-domain coaching loop (the real moat).** Connect lifts ↔ food: *"You hit a squat PR but were 40g under protein three days that week — your recovery ceiling is higher than you're feeding it."* No app connects training data to nutrition data this way. This is what justifies fusing the two domains in one product.

5. **Trust-first photo logging (correction UX).** Show a **confidence band per dish** ("520–680 kcal"), flag hidden-fat warnings (dressings/sauces = +200 kcal invisible to camera), and make **one-tap / voice portion correction** frictionless ("actually it was bigger"). Cal AI's confidently-wrong estimates (grapes: 60 vs 260 kcal) erode trust faster than honest uncertainty. Transparency *is* the feature — pair photo AI with a verified-DB confirm path for frequent meals so accuracy compounds.

---

## 4. Design / UX principles (frictionless logging is the north star)

1. **Sub-5-second logging or it doesn't ship.** Max 3 steps to complete any primary action. Voice/photo exist to kill the 15–20 min/day manual-entry tax that abandons ~70% of trackers in two weeks.
2. **Deliver a personal number in <30 seconds of first launch.** Onboarding asks 4–5 questions (goal, weight, height, activity, *"what made you quit tracking before?"*) and shows estimated TDEE + macro target + projected outcome *before* asking for any work. AI personalization → up to 50% higher retention.
3. **Never show shame.** No "you went over," no "you missed your workout." UCL research: shame-framing makes users abandon the *goal*, not just the app. Use progress-framing: "5 of 7 days — your best week yet." Treat misses as data.
4. **Progress, not deficit, is the hero metric.** Two-tone semantic color (green = toward goal, amber = stalled, red = regression only). One verdict per check-in. Never make a raw calorie deficit the big number.
5. **Streaks with a forgiveness layer.** Streak shield (one free miss/week) + comeback bonus. Streaks cut 30-day churn ~35%, but rigid streaks trigger the abandonment spiral on the first inevitable miss.
6. **WHOOP-style progressive disclosure.** 90% of daily use is the tier-1 one-liner; depth is there when wanted, invisible otherwise. Consolidate to one screen (MacroFactor's premium signal) — never Cal AI's scattered tabs.
7. **A daily ritual that pulls from HealthKit passively.** Morning: "How'd you sleep? Here's today's target." Mirror the Apple Watch "close your rings" completion psychology. Passive import = less manual logging.
8. **No ads in the logging loop, ever.** This is MFP's #1 churn quote. The loop is sacred.
9. **Own the share template.** Don't let users screenshot raw output — generate the branded card yourself (see §5).
10. **Security/billing airtight before any growth push.** Cal AI's cautionary tale: 3.2M-user breach (unauthenticated Firebase) + App Store removal for deceptive billing. Viral distribution amplifies trust failures catastrophically. Run the security gate before shipping anything that stores food/body images.

---

## 5. Growth & share loop (Jack won't do content marketing)

Jack needs **product-led growth**, not a TikTok grind. Cal AI's virality was creator-bought ($1M+/mo ads, 150 influencers) — *not* replicable. **The replicable model is MacroFactor/Hevy: product quality + community seeding + intrinsic share loops.** MacroFactor hit 400K paying users in 4 years with ~zero paid ads.

**Build these shareable artifacts (the share IS the marketing):**

1. **Voice-logged PR card** — auto-generated Instagram-Story graphic on a new 1RM: *"First 225 bench — logged by voice. SayFit."* Visually distinct enough to function as brand advertising (Strava's orange maps, Hevy's PR cards). This is the highest-leverage one.
2. **Weekly "receipt" / wrap** — auto-generated every Sunday: PRs hit, macro hit-rate, body-weight trend arrow, streak. Recurring reason to share, recurring content flywheel, zero founder effort.
3. **"Am I winning?" weekly card** — the §3 narrative dashboard, formatted to screenshot. Plain-English progress is more shareable than a deficit number.

**Product loop:** add a **lightweight friends feed** ("friends' recent lifts"), even read-only at first. Social-embedded users churn far less than solo trackers (~30% better retention; Strava group activity gets 95–121% more engagement). A "your friend hit a deadlift PR" notification (with consent) is a *pull*; a generic "invite friends" prompt is noise.

**ASO notes (59% of installs come from search):**

- **Don't fight head terms.** "Calorie counter" / "workout tracker" are locked (KD 70+).
- **Own 10–20 long-tail terms** competition ignores: *"voice workout logger," "speak your sets," "AI meal photo tracker," "macro tracker no typing," "snap meal macros."*
- **Keyword-rich screenshot captions** — Apple indexes caption text since June 2025. "Log lifts by speaking — no typing required" is both a ranking signal and conversion copy.
- **Custom Product Pages** (70 allowed now, +5.9–8.6% CVR): one CPP per keyword cluster — a "voice workout tracker" page leading with the voice demo, a separate "AI meal scanner" page leading with photo-to-macros.
- **Seed one high-signal community** pre-launch (r/MacroFactor, r/weightroom, r/leangains, a gym Discord). Both MacroFactor and Hevy bootstrapped their first 10K from community seeding before any loop could operate.

---

## 6. Monetization

**Model: hard paywall, 7-day free trial, shown at the END of personalized onboarding.**

- **Price: $9.99/mo or $69.99/yr.** Annual is the default option, "Best Value" badged, charm-priced.
- **Position visibly below MFP** ($19.99/mo) and MacroFactor ($14.99/mo) — the price gap itself is a word-of-mouth driver (Hevy's "it's a steal" dynamic). One tier, no confusing Premium/Premium+ split.
- **Avoid weekly plans** — they attract higher-churn users despite short-term LTV bumps.

**Why these numbers (benchmarks):**

- Hard paywall Day-35 download→paid median **2.9%** (top quartile 6.2%) vs. freemium **0.58%** — freemium converts ~5x worse and depresses LTV.
- Trial→paid median **37.7%** (top quartile 51%+). **86%** of conversions happen Day 0 — hence paywall-after-onboarding, once the user has seen their tailored plan + logged one set/meal.
- Hard paywalls = **+21% LTV** vs. soft.
- Health & Fitness has the **highest install LTV of any category ($1.21)**; premium-tier annual plans generate **4.5x** the LTV of budget plans. Apple's cut drops 30%→15% after year one — retention compounds.
- **Math check:** 1,000 paying subs × $70/yr ≈ **$70K ARR**. At 11.2% install→trial × 37.7% trial→paid, that's ~**23,700 installs** — reachable with strong ASO + one community seeding event.

---

## 7. Prioritized roadmap (sequenced onto T1–T11)

**Sequencing principle: the SHORTEST path to "credibly replaces MFP + my lifting app" is — food DB + barcode (parity) → voice lifts polished (the wedge) → adaptive TDEE + "am I winning?" (the edge) → share loop (growth). Don't build the social layer or HealthKit recovery fusion before the core loop is sub-5-second.**

### NOW — the credible-replacement core (ship this and you can market it)
| Item | User value | Effort |
|---|---|---|
| Food DB + free barcode scanner (OFF + FatSecret fallback, vision-camera, local cache) | "Scan anything, free, even offline" | **L** |
| Food diary + manual entry + macro totals (surfaced at one tap, copy-yesterday) | "Log and see my day instantly" | **M** |
| Voice-log lifts: gym-syntax parser + set/rep/weight/RPE + PR detection | "Speak your set, never type in the gym" | **L** |
| Photo-to-macros with confidence band + one-tap correction | "Snap a meal, fix it if it's off" | **M** (in flight) |
| 30-second onboarding → personal TDEE/macro target + paywall at the end | "I know my number before I do any work" | **M** |
| Custom macro goals (free) | "Set my own targets, no paywall" | **S** |

### NEXT — the signature edge + monetization hardening
| Item | User value | Effort |
|---|---|---|
| Adaptive TDEE engine (weight trend + intake → weekly recalibration) | "Targets that self-correct to my real body" | **L** |
| "Am I winning?" narrative dashboard (WHOOP-style 3-tier) | "One line tells me if I'm on track" | **M** |
| HealthKit sync (weight, steps, HR, sleep) + **nutrition write-back** | "It's the hub; my data lives here" | **M** |
| Streaks with forgiveness layer (shield + comeback) | "I don't get punished for one off day" | **S** |
| Hard paywall + 7-day trial wiring, billing airtight, security gate | trust + revenue | **M** |

### LATER — growth flywheel + cross-domain coaching
| Item | User value | Effort |
|---|---|---|
| Shareable PR card + weekly "receipt" (own the template) | "My PRs look good enough to post" | **M** |
| Friends feed (read-only first) | "See what my friends are lifting" | **M** |
| Cross-domain coaching insights (lift PR ↔ protein/recovery) | "It tells me *why*, not just *what*" | **M** |
| CPPs + long-tail ASO captions | discovery | **S** |
| Fasting timer w/ macro visibility (poach Zero's 10M users) | "One app for fasting + food" | **S** |
| Apple Watch recovery fusion (HRV/sleep → adjust targets) | "It adapts to how recovered I am" | **L** |
| Nutritionix chain-restaurant data (post-revenue) | "Chipotle/McD logged accurately" | **S** + $$ |

---

## 8. Honest risks / what could kill it

1. **Food-DB licensing & quality (medium-confidence).** OFF's ODbL is *probably* fine for runtime queries + local cache + attribution, but the edge case (redistributing a merged proprietary dataset) is a real legal line — confirm at legal.openfoodfacts.org before App Store submission. OFF data quality is uneven and restaurant/generic foods are thin; if gaps cause churn, you're forced into FatSecret Premier or Nutritionix ($1,850/mo) sooner than revenue supports. **This is the single biggest execution risk.**
2. **AI-calorie accuracy/trust (high-confidence problem).** Photo-only AI is 14–20% off; mixed dishes 25–35%; portion estimation as low as 39% accurate. Hidden fats add 200+ kcal of invisible error. If SayFit is confidently wrong, trust collapses (Cal AI's lesson). **Mitigation:** confidence bands, hidden-fat warnings, frictionless correction, verified-DB confirm path — but this is permanent surface-area to defend, not a solved problem.
3. **Voice-parser quality is the whole moat — and it's hard.** STT is commodity; the gym-syntax NLU + clean data model is where it lives or dies. A parser that mangles "3x8 at 185, last was a grinder" is worse than typing. Budget real effort here; this is Fable/Opus-medium work, not a Sonnet one-shot.
4. **Adaptive TDEE needs data density.** MacroFactor's engine degrades badly on partial logging and requires near-daily weigh-ins + complete food logs. If SayFit's frictionless logging *reduces* logging completeness, the engine gets less reliable — a tension to design around (adherence-neutral math, graceful degradation).
5. **Retention reality is brutal.** Category Day-30 retention is 8–15%; even optimized apps hit 20–35%. 77% of daily users gone within 3 days. Manual logging abandoned by 70% in two weeks. The whole thesis rests on voice/photo *actually* delivering the friction reduction that lifts AI-assisted adherence to ~64% — if logging isn't genuinely sub-5-second, none of the rest matters.
6. **Incumbents are buying the gap (medium-confidence on timeline).** MFP bought Cal AI; Strava bought Runna + Breakaway. Voice/photo AI is becoming must-have, not differentiator. SayFit's defensible ground is the **fusion + coaching layer** legacy apps can't easily bolt on — not the individual inputs. Compete on what they structurally can't copy fast (cross-domain context), not on photo-calorie quality alone.
7. **Solo-builder bandwidth vs. surface area.** This is a wide product (two domains + AI + social + payments). The roadmap is ruthlessly sequenced for a reason — resist building the social layer or recovery fusion before the NOW tier is genuinely sub-5-second and trustworthy. Shipping the core loop *well* beats shipping all of it *thinly*.

---

# Addendum: The "Everything App" — Five New Pillars

*Added 2026-07-07 from a 130-source research pass (hormone/peptide trackers, App Store policy, biomarker-trend apps, supplement+mobility apps, meal-plan+grocery apps). Extends — does not replace — the MFP-parity plan above.*

## A1. The expanded thesis

"All the fitness apps in one" does **not** mean matching Function Health on biomarker breadth, Pliability on video depth, or Medisafe on clinical med-management — those are capital/content races a solo builder loses. It means SayFit becomes the only app that holds a serious lifter's **whole self-directed health protocol in one correlated timeline**: lifts, macros, body-comp, hormone/peptide doses, supplement adherence, bloodwork trends, and mobility. The single deepest moat is the **fused view — bloodwork + protocol (TRT/peptide) + training + nutrition, correlated into one "am-I-winning-on-my-health" signal.** Research validates this as unclaimed whitespace: across ~15 hormone/peptide trackers (Dosafy, TRT Plus, PeptIQ, Shotsy, Regimen) and ~10 labs platforms (Function, Superpower, InsideTracker, Whoop Advanced Labs), **not one** fuses lab-trend data with a real set/rep lift log and daily macro log. It's defensible because SayFit already owns the two hardest halves (voice lifts + photo macros) that every hormone/labs incumbent lacks. **Caveat: it's a time-bound moat** — Whoop Advanced Labs and Regimen are each ~one release from encroaching. Ship the fusion inside ~12–18 months or a funded player closes it.

## A2. App Store viability verdict — **CONDITIONAL-GO**

Including TRT + peptide (incl. retatrutide) protocol tracking in the **public** App Store build is viable. Live, non-sideloaded precedent exists today (checked 2026-07): *Anabolic Steroid & TRT Tracker*, *Shotsy*, *PeptIQ* (both name retatrutide + BPC-157), *Peptide Tracker & Calculator*. The category is approved.

Guardrails, by guideline:
- **1.4.3 (controlled substances)** — bans *facilitating sale / encouraging consumption*, NOT private logging of what a user already has. TRT (Schedule III, prescribable) and legal peptides don't trip it. Keep store-facing copy/keywords/icons clinical; **no slang** ("gear", "juice", "blast and cruise"). The one enforcement case (*Amphetamine*, 2021) was branding, was appealed, and was reinstated unchanged.
- **1.4.2 (dosage calculators)** — the biggest live risk. Calculators must come from a manufacturer/pharmacy/FDA entity; SayFit isn't. **Dose entry is always user-typed and user-confirmed.** Any reconstitution/concentration aid ships behind a first-use disclaimer ("unit-conversion aid based on numbers you enter, not a dosing recommendation") and is **never** marketed as a "dosage calculator."
- **1.4.1 (medical apps)** — disclose methodology behind any accuracy claim; remind users to consult a doctor.
- **5.1.3 (HealthKit)** — separate review surface for the bloodwork pillar; no false HealthKit writes, no health PII in iCloud against terms.

**Required framing (the template every approved comp uses):** a **generic "medication & protocol tracker"** — a passive log/calendar for data the user already has (prescriber, vial label, lab PDF), where users define ANY compound (name/dose/unit/schedule) rather than a curated PED picklist. Include the standard disclaimers ("informational only, not medical advice, consult your provider" + "only track substances legally prescribed or obtained in your jurisdiction") and a **first-run acknowledgment gate** on the hormone/peptide module.

**Stays personal/TestFlight-only (config flag):** explicit bodybuilding PED-cycle vocabulary — on/off-cycle planning, PCT, blast-and-cruise. Same architecture, two configs, risk cleanly split: public build = prescribed-hormone + peptide/GLP-1 tracking; personal build = the full cycle vocabulary.

## A3. The five new pillars

| Pillar | Tag | Native build (thin) | Skip / don't | Effort |
|---|---|---|---|---|
| **(a) Hormone/peptide protocol** | **MOAT** | Compound defs, dose/site/timing log, injection-site rotation map, dose reminders | PK ester-curve modeling, any auto-calculated dose | **M** |
| **(b) Supplement/med reminders** | RETENTION | AM/PM "stack" checklist anchored to the existing weigh-in/workout moment; streak **with grace mechanic** (never hard-reset); tiered notifications (gentle for supps, alarm-style for injection days) | Drug-interaction checks, refill tracking, caregiver escalation, compliance reports | **S** |
| **(c) Biomarker/bloodwork trends** | **MOAT** (fusion half) | OCR/PDF/manual ingest from **any** lab (Quest/LabCorp/Function/Marek), overlay chart plotting labs on the same timeline as PRs + body-comp + macro adherence | Running your own blood draws; Superpower-style supplement-upsell funnel | **M** → **L** (causal insight) |
| **(d) Mobility/prehab** | NICE-TO-HAVE | Periodic **mobility screen** → a score over time (plugs into "am I winning?"); short daily desk-break routine from a small GIF/static library | Produced-video instructor library, 30-day programs (that's a content business) | **M** |
| **(e) Meal-plan + grocery + prep** | PARITY (differentiated) | **Anchor-meal library** (repetition as a feature — "cut mode" deliberately boring/cheap), batch-scaled grocery list, templated prep steps, **manual per-staple price field** → "this week ≈ $X", all generated from macros + logged history SayFit already owns | Recipe-discovery/variety engine, live retailer price APIs | **M** |

**Why (c)+(a) are the moat, not just features:** the dose-tracker alone is crowded; the lab-tracker alone is crowded. **Plotting doses against labs against training/nutrition is the unclaimed seam** — and only SayFit can build it, because only SayFit already has the training + nutrition half.

## A4. Founder-as-user — the fastest dogfood path

Jack **is** the archetype, so every pillar has a zero-recruiting validation loop already running in his life: (a) his 200mg/wk TRT + retatrutide cut is the exact primary use case; (b) his real stack (creatine, electrolytes, fish oil, citrus bergamot, boron, multi) *is* the seed AM/PM template; (c) he **already compared two lab panels by hand** — the ingest+overlay is literally productizing that, and his panels are the test fixtures; (d) desk job + PPL 5–6×/wk is the precise mobility persona; (e) he **already runs a repeating anchor-meal cut + grocery list by hand**. The thesis in one line: the target user is **already doing the multi-app stitching**, so a v1 that removes two apps from his stack is validated before launch.

## A5. Sequencing (folds into NOW/NEXT/LATER above — core rule unchanged)

- **NOW (unchanged):** voice lifts, photo macros, adaptive TDEE, body-comp dashboard, growth, monetization. **No new pillar competes for this slot.** Nothing below is built until the core loop is demonstrably sticky.
- **NEXT — pull the moat pair early:** **biomarker ingest + fused overlay (c)** and **protocol log (a)**, shipped *together* (the protocol log is low-value alone, defensible the instant its doses plot against the labs+training overlay). Bundle the thin **AM/PM reminder (b, effort S)** here since it directly drives protocol adherence. These are the **only** new pillars justified the moment the core loop proves out — because they're the moat and the window is finite.
- **LATER (after the moat lands and retains):** meal-plan/anchor-meals + grocery (e), mobility screen + desk-break (d), and the AI-coach **causal** insight layer on the fusion data ("hematocrit up 3 panels as volume climbed"; "E2 spike tracks your refeed carb bump").

## A6. Added risks

- **App Store rejection (medium, mitigable):** 1.4.2 if any auto-dose ships; 1.4.3 if branding reads PED-promotional. Mitigation = user-typed doses only, generic "protocol tracker" framing, clinical copy, disclaimers, first-run gate, PED-cycle vocab confined to TestFlight.
- **Medical liability — track, don't prescribe (permanent design constraint):** never diagnose, recommend, or calculate a dose. Passive log for data the user already has. Crossing this spikes both store risk and real liability.
- **Scope explosion (the #1 solo-builder killer):** every pillar has a trap that turns a feature into a business (recipe engines, video libraries, PK modeling, clinical med-management, running blood draws). Ship the **thin, fused** version; refuse the deep standalone the incumbents already own.
- **Time-bound moat:** ship c+a inside ~12–18 months or Whoop/Regimen close it.
- **Low-confidence flags to verify before betting:** Reddit demand (r/trt, r/PEDs, r/Peptides) was blocked/unverified — 15+ existing apps are indirect proof, but run an authenticated pass before quoting sentiment; retatrutide's investigational status is the least-tested store-policy edge (live apps track it by name, but treat as moderate-confidence); don't repeat unverified marketing stats (e.g. StretchIt's "93% relief").
