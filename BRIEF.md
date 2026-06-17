# SayFit (revival) — Project Brief

date: 2026-06-17
status: scoped — brief done, NOT yet building (revives the parked Expo app)

## One-liner
The fitness app you never have to "log" in: **talk your lifts, snap your meals, watch yourself (and your friends) win.** Effortless solo, addictive with your crew.

## Founder fit (why this one)
Jack is the target user — trains seriously (lifting + cardio + nutrition, goal = body composition), built and used sayfit, then drifted off. Chosen on **enjoyment**, not money (the "mountain" bet). Dogfood IS the retention test: build the thing he'd open daily, and it works for the millions exactly like him.

## Diagnosis — why sayfit v1 died
Jack quit for ALL FOUR reasons: logging was tedious · nothing pulled him back · didn't do anything special · life got busy. Root cause collapses to **friction + no payoff** (when logging is work, it's the first thing dropped when life gets busy). The kicker: the existing codebase already shipped a social feed, following, leaderboards, challenges, share cards, achievements, and an AI coach — **and he still quit.** So features were never the problem. The old `IDEAS.md` is a backlog of incremental *lifting* features (1RM calc, plate calc, supersets, volume charts) — none of which attack the root. The breakthrough is the thing his past self never tried.

## Thesis
Kill logging friction with AI (**voice for lifts, photo for meals**), make **"am I winning?"** visceral on one dashboard, and let the **existing social layer** create the return loop *and* the organic, no-founder-content distribution. AI = invisible plumbing + an *optional* coach — deliberately NOT another "AI coach" app (Jack explicitly demoted the coach).

## Already built — REUSE, don't rebuild
Social: feed, follow, leaderboards, challenges, comments, accountability widget · Sharing: ShareCard + customizer + templates · Gamification: achievements, badges · Workout: exercise search/guide, rest timer, WorkoutContext, progressive overload · Weight tracking · AI coach personas · Premium UI (GlassCard/theme) · Backend: Supabase · Analytics: PostHog · Build: EAS, TestFlight-prepped, remote pushed.

## v1 scope — the keystone (reuse the Expo base)
**IN:**
- **Voice-log lifts** — say *"3×8 bench at 185"* → parsed → logged → progression/PR shown inline. (Kills the #1 friction.)
- **Photo-log meals → macros** (Cal-AI mechanic). NOTE: nutrition appears **absent** in current code → biggest net-new surface (data model + vision pipeline).
- **Unified "am I winning?" body-comp dashboard** — weight trend + protein/calories vs target + lifts trending + measurements, all tied to the body-comp goal.
- **HealthKit import** for cardio/steps/active energy (IDEAS.md flags this as the biggest unlock; needs Apple Dev account — Jack was TestFlight-prepping, so likely has/near it).
- **Fuel the existing social/share/winning layer** with the new effortless logging.
- AI coach stays an **optional quiet button**, not the core.

**OUT (defer):** the incremental lifting backlog (1RM calc, plate calc, supersets, heat map, etc.) — don't move retention · net-new social features (existing ones suffice).

## Design rule
**Single-player great, multiplayer addictive.** v1 must be fully valuable SOLO (Jack uses it daily with zero friends → dodges the social cold-start). Social is the multiplier, not a gate. Consistent with rejecting invite-to-unlock.

## Hit signal / kill rule (portfolio bet)
**Does Jack use it daily for 3–4 weeks without forcing himself?** That's the exact test v1 failed. Yes → social/sharing becomes the growth engine. Can't sustain even as the builder-user → kill or rethink.

## Monetization (later — retention first)
Freemium; premium tier (advanced analytics, full AI coach, unlimited) via StoreKit — IDEAS.md flags IAP as the biggest revenue lever. Not a v1 concern.

## Open flags
- Confirm nutrition/food logging is truly absent in current code (sets photo-meal build size).
- Apple Developer account status (HealthKit / TestFlight / IAP all gated on it).
- Voice-parse approach (on-device vs LLM) + photo→macros vision model + per-log AI cost.

## Build model/effort (for /start)
Opus 4.8 medium for data-integrity bits (nutrition math, HealthKit sync, voice parsing); Sonnet 4.6 low–med for UI iteration; one `/code-review high` before any health-data or payment code ships.

## Next step
Scoping stops here — NOT building. Respect WIP (missed-call-demo building, claude-os ship-ready). Clean play: **ship claude-os to free a slot → `/start sayfit-app`** to move it into building.
