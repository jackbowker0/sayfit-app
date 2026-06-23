# Running SayFit on a real iPhone (the voice test)

The iOS **Simulator can't do speech recognition** — the voice-log keystone only works on a
physical device. This is the 5-minute path to get it on your phone. Everything below the
prereqs is a one-time setup; after that it's just **⌘R**.

## Prereqs — already done ✅
- `node_modules` installed
- `ios/Pods` installed (incl. `expo-speech-recognition` native module — the permission prompt
  firing on the sim already proved it's linked)
- `ios/SayFit.xcworkspace` generated

> Toolchain note: **do NOT use `npx expo run:ios`** — the bundled `@expo/cli` is incompatible
> with Xcode 26's `devicectl` ("Unexpected devicectl JSON version") and mis-routes to a signing
> path that fails. Build from **Xcode** (⌘R) instead, which handles signing + install + launch.

---

## Step 1 — start Metro (your own Terminal, leave it open)
```
cd /Users/jackbowker/archive/sayfit-app
npx expo start
```
Metro serves the JS bundle. Keep this tab running the whole time.

## Step 2 — plug in the iPhone + trust
USB cable → on the phone, **Trust This Computer** → enter passcode. (First wired connect is
required even if you later want wireless debugging.)

## Step 3 — open the workspace
```
open /Users/jackbowker/archive/sayfit-app/ios/SayFit.xcworkspace
```
**The `.xcworkspace`, not `.xcodeproj`** (CocoaPods project).

## Step 4 — signing (pick ONE account path)

The app's real bundle id is **`com.sayfit.app`**, already registered to your brother's paid
developer account. That matters for which path you choose:

### Path A — your brother's team (keeps `com.sayfit.app`, can go to TestFlight later)
1. Have your brother add your Apple ID as a team member: **App Store Connect → Users and Access
   → invite your Apple ID** (Developer role is enough).
2. Xcode → **Settings (⌘,) → Accounts → "+" → Apple ID** → sign in as *you*.
3. Blue **SayFit** project → target **SayFit** → **Signing & Capabilities** → ✅ Automatically
   manage signing → **Team = your brother's team**. Keep bundle id `com.sayfit.app`.

### Path B — your own free Apple ID (self-sufficient, no brother needed, 7-day cert)
A free Apple ID can sign dev builds to *your own* device. But it can't claim `com.sayfit.app`
(your brother's account owns it), so you **must change the bundle id**:
1. Xcode → **Settings → Accounts → "+" → Apple ID** → sign in as *you*.
2. **SayFit** target → **Signing & Capabilities** → ✅ Automatically manage signing → **Team =
   (Personal Team)**.
3. Change **Bundle Identifier** to something unique, e.g. **`com.jackbowker.sayfitdev`**.
4. This installs as a *separate* app from the TestFlight one (fresh data — fine for a feel-test).
   The free cert expires after 7 days; just ⌘R again to refresh.

**Recommendation:** if your brother's around, Path A (cleaner). If not, Path B gets you testing
voice right now with zero coordination.

## Step 5 — select your phone + run
Top toolbar device dropdown → **your iPhone** (under "iOS Device", not a simulator) → **⌘R**.

## Step 6 — first launch only: trust the dev cert
If iOS blocks it ("Untrusted Developer"): phone **Settings → General → VPN & Device Management
→ [your Apple ID] → Trust**. Then tap the SayFit icon.

---

## The actual test
**Log Workout → Voice tab → tap the mic → speak a set**, e.g.
*"bench press three by eight at one eighty five."*

The hardened offline parser (see `src/services/exerciseLog.js`, validated by
`scripts/verify-parser.mjs`) turns that into **Bench Press · 3×8 · 185**. It also handles
"two twenty five" (225), "three fifteen" (315), "3 by 8", light weights via "at 15", and "rpe 8".

**The two things to report back:**
1. Did it build/install (or what error stopped you)?
2. How did voice *feel* — faster and more natural than typing? That single data point is the bet.

## Quick troubleshooting
- **"Failed to register bundle identifier" / "not available"** → you're on Path B with the
  original id. Change the bundle id (Step 4B.3).
- **Voice says "unavailable"** → pods out of sync; from `ios/`:
  `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install`, then ⌘R.
- **Mic does nothing / flickers** → you're on the *simulator*. It can't. Use a real device.
- **Metro "no bundle"** → make sure `npx expo start` (Step 1) is still running.
