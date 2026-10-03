# Project-specific R8 rules (release build: isMinifyEnabled = true, isShrinkResources = true).
#
# No extra keep rules are needed today:
# - MainActivity is referenced from the manifest, which AGP keeps automatically.
# - There is no JavaScript bridge (@JavascriptInterface) and no reflection. If a bridge is ever
#   added, the default proguard-android-optimize.txt already keeps @JavascriptInterface methods,
#   but the bridge class itself must stay reachable from code.
# - androidx.webkit / appcompat / material ship their own consumer rules.
# - The web app under src/main/assets/www is an asset, not a resource, so resource shrinking
#   does not touch it.
