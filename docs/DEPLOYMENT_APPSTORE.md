# Deployment — Firebase to App Store

Everything from an empty Firebase console to a build in review. Budget roughly
half a day for the first run, most of it waiting on Apple.

---

## 1. Firebase project

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add
   project** → `mindcode-app`. Enable Google Analytics (this is what backs
   Firebase Analytics).
2. **Build → Authentication → Get started**, enable:
   - **Anonymous** — required; the app signs new players in silently
   - **Email/Password**
3. **Build → Firestore Database → Create database** → *Production mode* →
   pick the region closest to your players. This is permanent.
4. **Project settings → General → Your apps → Web app** (the JS SDK is what
   Expo uses, even on native). Copy the config object.

```bash
cp .env.example .env       # paste the values in
```

Firebase web API keys are project identifiers, not secrets — they are safe in a
client bundle. Access control lives entirely in `firestore.rules` and the Cloud
Functions.

## 2. Deploy rules, indexes and functions

```bash
npm install -g firebase-tools
firebase login
firebase use --add                 # select mindcode-app, alias "default"

npm run deploy:rules               # firestore.rules + firestore.indexes.json

cd functions && npm install && npm run build && cd ..
npm run deploy:functions           # requires the Blaze plan
```

Blaze is required for Cloud Functions. Realistic cost at launch scale is a few
dollars a month; set a budget alert at **Billing → Budgets** anyway.

Verify:

```bash
firebase functions:list
# submitGameResult · deleteAccount · provisionDailyChallenges
```

Trigger the first challenge documents without waiting for 23:55 UTC:

```bash
gcloud scheduler jobs run firebase-schedule-provisionDailyChallenges-us-central1 \
  --location us-central1
```

Local development against emulators:

```bash
firebase emulators:start           # Auth 9099 · Firestore 8080 · Functions 5001 · UI 4000
```

Before deploying rules, run the suite that checks them. It starts and stops the
Firestore emulator itself, so the only prerequisite is a JDK:

```bash
npm --prefix functions run test:emulator
```

57 tests covering every allow/deny path in `firestore.rules` plus all three
Cloud Functions. Treat a failure here as a release blocker — a permissive rule
is not visible in the app until someone exploits it.

One caveat worth knowing: **the emulator does not enforce index requirements.**
`deleteAccount` sweeps leaderboards with a collection-group query on
`entries.uid`, which needs the explicit `COLLECTION_GROUP` override in
`firestore.indexes.json`; without it the query fails only against a real
project. Deploy indexes before functions, and exercise account deletion once on
staging.

## 3. Native analytics (optional but recommended)

The Firebase JS SDK has no React Native Analytics implementation. The app ships
an analytics façade with a pluggable transport
([`src/services/analytics.ts`](../src/services/analytics.ts)), so wiring the
native SDK is one file and zero call-site changes:

```bash
npx expo install @react-native-firebase/app @react-native-firebase/analytics
```

```ts
// src/services/analyticsNative.ts
import analytics from '@react-native-firebase/analytics';
import type { AnalyticsTransport } from './analytics';

export const nativeTransport: AnalyticsTransport = {
  logEvent: (name, params) => analytics().logEvent(name, params as never),
  setUserId: (uid) => analytics().setUserId(uid),
  setUserProperties: (props) => analytics().setUserProperties(props),
};
```

```ts
// src/App.tsx
registerAnalyticsTransport(__DEV__ ? consoleTransport : nativeTransport);
```

This also requires `GoogleService-Info.plist` / `google-services.json` from the
Firebase console, added to `app.config.ts` under `ios.googleServicesFile` and
`android.googleServicesFile`, plus the `@react-native-firebase/app` config
plugin. Both files are gitignored — supply them through EAS file secrets.

Events already emitted: `app_open`, `sign_up`, `login`, `account_linked`,
`game_start`, `guess_submitted`, `game_complete`, `daily_challenge_complete`,
`level_up`, `badge_unlocked`, `streak_extended`, `streak_broken`,
`leaderboard_viewed`, `share_result`, `screen_view`. User properties are
bucketed (`level_bucket`, `streak_bucket`, `account_type`) to keep cardinality
inside Firebase's limits.

---

## 4. Apple prerequisites

1. **Apple Developer Program** — $99/year, and enrolment can take a day or two.
   Start here.
2. **App Store Connect → My Apps → +** → New App
   - Platform: iOS · Name: `MindCode` · Primary language
   - Bundle ID: `com.mindcode.app` — must match `app.config.ts`
   - SKU: `mindcode-001`
3. Note your **Apple Team ID** (Membership page) and the numeric **App Store
   Connect App ID** (App Information → General).

Fill these into `eas.json` under `submit.production.ios`.

## 5. Build

```bash
npm install -g eas-cli
eas login
eas init                      # writes EAS_PROJECT_ID
```

Push the Firebase config to EAS so builds are reproducible:

```bash
eas env:create --name EXPO_PUBLIC_FIREBASE_API_KEY --value "…" --environment production
# …repeat for each EXPO_PUBLIC_FIREBASE_* variable
```

```bash
eas build --platform ios --profile preview      # internal TestFlight-style build
eas build --platform ios --profile production   # App Store build
```

EAS will offer to generate the distribution certificate and provisioning profile
— let it; managing them by hand is not worth the time.

```bash
eas submit --platform ios --profile production
```

---

## 6. Before you submit — the checklist that actually causes rejections

**Replace the placeholder artwork.** `assets/` currently holds generated
geometric placeholders (see `scripts/generate-assets.py`). Apple rejects
placeholder-looking icons. You need a 1024×1024 icon with no alpha channel and
no rounded corners (iOS applies the mask).

**Account deletion — Guideline 5.1.1(v).** Any app offering account creation
must offer in-app deletion. Implemented: Settings → Delete account → the
`deleteAccount` callable, which removes leaderboard entries, public profile,
sessions, daily entries, the profile and the auth record. Test it end to end;
reviewers do.

**Privacy nutrition label.** App Store Connect → App Privacy. What MindCode
collects, given the schema in this repo:

| Data | Linked to user | Purpose |
| --- | --- | --- |
| Email address | Yes | Account authentication |
| User ID | Yes | App functionality |
| Product interaction | Yes | Analytics, App functionality |
| Crash/performance data | No | App functionality |

No tracking across other companies' apps, so **App Tracking Transparency is not
required** — do not add the prompt, and answer "No" to the tracking question.

**Privacy policy and terms URLs.** Required fields, and the app links to
`https://mindcode.app/privacy` and `/terms` in Settings
([`SettingsScreen.tsx`](../src/screens/SettingsScreen.tsx)). Replace those
constants with real, live URLs — a 404 is a rejection.

**Support URL and contact email.** `support@mindcode.app` in Settings; make it
real.

**Age rating.** MindCode is 4+ — no violence, gambling, chat or UGC. Display
names are the only user-authored content; they are validated to 2–20 printable
characters. If you later add profile text or chat, the rating and moderation
story both change.

**Export compliance.** `usesNonExemptEncryption: false` is already set in
`app.config.ts` (HTTPS only). This skips the export questionnaire on every
upload.

**Guideline 4.2 — minimum functionality.** Puzzle games get scrutinised for
being "too simple". Point at the depth in the review notes: two distinct
training modules with six difficulty variants between them, a global daily
challenge, 50 levels, 21 badges, three leaderboards.

**Review notes.** Reviewers must be able to see everything without a barrier.
Anonymous sign-in means they can, but say so explicitly:

> No account is required — the app signs you in automatically and the Daily
> Challenge is playable immediately. Account creation is optional and only syncs
> progress across devices. Account deletion is at Settings → Delete account.

**Screenshots.** 6.7" (1290×2796) and 6.5" (1242×2688) are mandatory. Use the
Home, Game, Result, Profile and Leaderboard screens, in that order.

---

## 7. After submission

- **Phased release** — App Store Connect → Version → Phased Release for
  Automatic Updates. Roll out over 7 days so a bad build reaches 1% first.
- **Watch:** Crashlytics or Xcode Organizer, Cloud Functions error rate
  (`firebase functions:log --only submitGameResult`), Firestore read volume, and
  D1/D7 retention in Analytics.
- **Enable App Check** before any meaningful traffic:
  console → App Check → register the iOS app with DeviceCheck or App Attest,
  then set `enforceAppCheck: true` in `functions/src/submit.ts` and redeploy.
  Do this *after* launch traffic confirms attestation works, not during review.

## Android

The same build already targets Android:

```bash
eas build --platform android --profile production
eas submit --platform android --profile production
```

Play requires a service account JSON at `credentials/play-service-account.json`
(gitignored) and a Data Safety form mirroring the privacy table above.

---

## Version bumps

`eas.json` sets `appVersionSource: "remote"` with `autoIncrement`, so build
numbers manage themselves. Bump the marketing version in `app.config.ts`
(`version`) for a release users should notice.

If a release changes game rules in a way that invalidates stored sessions, bump
`numberLogicEngine.version` as well. The backend rejects results whose engine
version does not match, which is what prevents an old client from submitting
scores under new rules.
