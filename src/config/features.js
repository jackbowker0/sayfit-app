// ============================================================
// FEATURE FLAGS
// ------------------------------------------------------------
// Build-time toggles. Keep public/App-Store builds conservative;
// flip personal/dogfood-only flags on a local build only.
// ============================================================

// Seed the Protocol pillar with a personal starter protocol (a testosterone
// compound + a supplement stack) on a FRESH install.
//
// MUST be false for any public / App-Store / TestFlight build: an app that
// ships pre-loaded with a testosterone protocol is bad review optics and blurs
// the core guarantee that every dose is user-entered. A real user starts empty
// and adds their own compounds. Flip true only on a personal dogfood build.
//
// Turning this off does NOT remove data from a device that already seeded — the
// seed only ever wrote on a first (null) read.
export const SEED_PERSONAL_PROTOCOL = false;

// Community / social surface (feed, challenges, leaderboard, profiles).
//
// PARKED: the backend tables for this were never recreated after the Supabase
// rebuild — every social query 404s today, so the whole surface is dead. And
// with zero users a public feed has nothing to show. The code all stays; this
// flag just hides the entry points (the Home social icon + accountability
// widget) so users don't hit dead screens. Revisit as friends-only
// accountability once there are real humans, and recreate the schema first.
export const SOCIAL_ENABLED = false;
