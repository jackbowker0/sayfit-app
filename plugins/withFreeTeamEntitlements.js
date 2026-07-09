// ============================================================
// CONFIG PLUGIN — strip entitlements a free Apple team can't sign
// ------------------------------------------------------------
// The dev build is signed with a free Personal Team, which cannot
// provision Push Notifications (aps-environment) or Sign in with Apple
// (com.apple.developer.applesignin). expo-notifications and
// expo-apple-authentication add those entitlements on every prebuild,
// which then FAILS to sign — forcing a manual "delete the two
// capabilities in Xcode" every time.
//
// This plugin removes both entitlements after those plugins add them,
// so `expo prebuild --clean` produces a project that signs cleanly on a
// free team with no manual Xcode surgery. (Neither feature works on a
// free team anyway.) Remove this plugin if the app moves to a paid team
// that actually provisions push / Sign in with Apple.
// ============================================================

const { withEntitlementsPlist } = require('@expo/config-plugins');

module.exports = function withFreeTeamEntitlements(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    delete cfg.modResults['com.apple.developer.applesignin'];
    return cfg;
  });
};
