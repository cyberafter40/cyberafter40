#!/usr/bin/env bash
#
# End-to-end run: the real bundled app, in a browser, against the real Firebase
# emulator suite.
#
#   ./scripts/e2e.sh          # full run
#   ./scripts/e2e.sh --ui     # Playwright UI mode (local debugging)
#
# Requires a JDK (the Firestore and Auth emulators are Java processes) and a
# Chromium that Playwright can find. Nothing here touches a real Firebase
# project: the `demo-` project id prefix tells the emulator suite to run without
# credentials.
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_ID="demo-mindcode"
EMULATOR_HOST="127.0.0.1"

# EXPO_PUBLIC_* variables are inlined into the bundle at build time, so the
# emulator host has to be set before the export, not before the test run.
export EXPO_PUBLIC_FIREBASE_API_KEY="demo-key"
export EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="${PROJECT_ID}.firebaseapp.com"
export EXPO_PUBLIC_FIREBASE_PROJECT_ID="${PROJECT_ID}"
export EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="${PROJECT_ID}.appspot.com"
export EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="1"
export EXPO_PUBLIC_FIREBASE_APP_ID="1:1:web:demo"
export EXPO_PUBLIC_FIREBASE_EMULATOR_HOST="${EMULATOR_HOST}"

# Prefer a Chromium already present in the image over downloading one whose
# build number must match this Playwright release.
if [[ -z "${CHROMIUM_EXECUTABLE_PATH:-}" ]]; then
  for candidate in /opt/pw-browsers/chromium-*/chrome-linux/chrome; do
    if [[ -x "$candidate" ]]; then
      export CHROMIUM_EXECUTABLE_PATH="$candidate"
      echo "==> Using pre-installed Chromium: $candidate"
      break
    fi
  done
fi

echo "==> Building Cloud Functions"
npm --prefix functions run build >/dev/null

echo "==> Exporting the web bundle"
rm -rf dist
npx expo export --platform web --clear >/dev/null

echo "==> Starting emulators and running the suite"
# emulators:exec takes a single command *string*, so any arguments forwarded to
# Playwright have to be re-quoted or a multi-word --grep silently splits.
COMMAND="npx playwright test"
for arg in "$@"; do
  COMMAND+=" $(printf '%q' "$arg")"
done

# emulators:exec starts Firestore, Auth and Functions, runs the command, then
# tears everything down — including on failure.
npx --prefix functions firebase emulators:exec \
  --only firestore,auth,functions \
  --project "${PROJECT_ID}" \
  "${COMMAND}"
