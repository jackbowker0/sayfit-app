# SayFit — Feature Ideas

---

## NO Apple Developer Account Required
> Can be built, tested, and shipped via Expo Go / local build today.

### High Impact (do these first)
| Idea | What it is | Why it matters |
|------|-----------|----------------|
| **1RM Calculator** | Epley/Brzycki formula: enter weight + reps, get estimated 1 rep max | Lifters care about this more than volume |
| **Plate Calculator** | Enter target weight → tells you exactly which plates to load each side | Gym QoL, zero effort to build |
| **Body Measurements** | Track waist, chest, arms, hips, etc. alongside weight | Weight stalls but measurements change — keeps people motivated |
| **Readiness Check-in** | Pre-workout: rate sleep/energy/mood (1–5) → stored with session | AI coach can adapt intensity suggestions based on readiness |
| **Progressive Overload Nudge** | If you've done same weight/reps 3+ sessions → suggest adding 5 lbs | The actual mechanism of getting stronger, surfaced in UI |
| **Exercise Swap Suggestions** | "No bench today? Try floor press or dumbbell press" | Equipment availability changes day to day |

### Workout Logging Improvements
| Idea | What it is |
|------|-----------|
| **Superset / Circuit Support** | Tag sets as supersets, log them back-to-back, rest between groups |
| **Drop Sets / AMRAP Sets** | Mark a set as "AMRAP" or "drop set" in the logger |
| **Custom Rep Schemes** | Pyramid sets (12/10/8/6), wave loading, etc. as presets |
| **Drag-to-Reorder Exercises** | Reorder exercises mid-workout with long-press drag |
| **Exercise Notes** | Per-exercise notes per session ("felt left shoulder" / "good depth") |
| **Previous Performance Display** | Show last session's weight+reps inline while logging |
| **Barbell vs Dumbbell Tracking** | Track whether a weight is per-side or total (common source of confusion) |

### Data / Analytics
| Idea | What it is |
|------|-----------|
| **Volume Load Trend** | Chart: sets × reps × weight over time per muscle group |
| **Muscle Group Heat Map** | Body diagram — colour muscles by how often/heavy you trained them this week |
| **Workout Frequency Analysis** | "You train chest 2x/week but legs only 0.5x — consider rebalancing" |
| **Estimated Calories Burned** | Rough MET-based estimate per session (no HealthKit needed, just math) |
| **Deload Week Detector** | After 4+ weeks of increasing volume → flag "consider a deload week" |
| **Personal Volume Records** | Alongside weight PRs, show highest total volume in a single session per exercise |

### Gamification / Retention
| Idea | What it is |
|------|-----------|
| **30-Day Challenges** | Pre-built "30 days of push-ups" style programs with daily checkoffs |
| **XP / Level System** | Earn XP per set logged, level up — purely cosmetic but sticky |
| **Milestone Badges** | "First 100kg lift", "50 workouts", "10-week streak" — beyond current achievements |
| **Coach Unlocks** | Complete X workouts → unlock a new coach persona |
| **Gym Buddy Mode** | Local multiplayer — two people log the same workout session together |

### UX / Polish
| Idea | What it is |
|------|-----------|
| **Voice-Guided Workout** | TTS reads out the next set while you're lifting (hands-free) |
| **Rest Timer in Notification Banner** | Local notification countdown so you can leave the app during rest |
| **Dark/OLED Theme** | True black (#000) for OLED screens — battery and aesthetics |
| **Haptic Feedback Profiles** | Light / Medium / Strong — user preference in settings |
| **Export to CSV / PDF** | Workout history export for nerds and coaches |
| **Share PR Card** | "I just hit a 100kg squat PR" image card for Instagram (can extend CompleteScreen) |
| **Workout Summary Email** | Weekly digest: workouts done, PRs hit, streak — sent via any email API (no Apple needed) |

### AI Coach Enhancements
| Idea | What it is |
|------|-----------|
| **Form Tips by Exercise** | When you log a new exercise → coach gives 2-3 cues (prompt-based, no video) |
| **Adaptive Program Generation** | User says "I have 3 days, want to focus on upper body" → AI builds a week plan |
| **Injury Mode** | "My shoulder hurts" → AI swaps all shoulder exercises for alternatives |
| **Nutrition Lite** | Rough protein target calculator (bodyweight × multiplier) — not calorie tracking |
| **Periodization Planner** | AI suggests a 4-week mesocycle: volume phase → intensity phase → deload |

---

## REQUIRES Apple Developer Account
> These need paid account ($99/yr), provisioning profiles, or special entitlements.

### Entitlement-Gated (need account + Apple approval in some cases)
| Idea | Requirement |
|------|------------|
| **Apple Health / HealthKit** | HealthKit entitlement + provisioning profile. Read steps, heart rate, active calories. Write workouts. This would be the single biggest feature unlock. |
| **Home Screen Widgets** | WidgetKit entitlement. "Today's workout", "current streak", "next training day" widget. |
| **Live Activities** | Dynamic Island / lock screen: rest timer countdown, active set number, workout duration — live while you lift. |
| **Siri Shortcuts** | "Hey Siri, log my workout" / "Hey Siri, start Push Day". Needs SiriKit. |
| **Sign in with Apple** | Required if you offer any other social login. Needed if you ever add Google/Facebook login. |

### Distribution / Monetisation
| Idea | Requirement |
|------|------------|
| **In-App Purchases / Subscriptions** | StoreKit — premium tier (e.g. advanced analytics, AI coach, unlimited templates). Biggest revenue lever. |
| **TestFlight Beta** | Already in progress — just needs the account and an .ipa upload. |
| **App Store Listing** | The end goal. Screenshots, ASO, review management. |
| **App Clips** | Micro-version of the app launched from a QR code at a gym — no install required. |

### Hardware
| Idea | Requirement |
|------|------------|
| **Apple Watch App** | watchOS target — log sets from your wrist, rest timer on watch, heart rate during workout. Needs dev account + Watch simulator. |
| **CarPlay** | Almost certainly not relevant for a fitness app. Skip. |

---

## Priority Shortlist (no account needed, highest ROI)

1. **Previous performance inline** — show last session's numbers while logging. #1 quality-of-life missing feature.
2. **1RM Calculator** — one screen, pure math, lifters love it.
3. **Body Measurements** — weight alone lies. Measurements tell the real story.
4. **Muscle Group Heat Map** — visual, shareable, impressive in screenshots.
5. **Progressive Overload Nudge** — makes the AI actually useful for strength, not just chat.
6. **30-Day Challenges** — retention mechanism that resets every month.
7. **Rest Timer in notification** — hands-free rest timing without keeping screen on.
