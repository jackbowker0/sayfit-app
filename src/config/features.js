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
