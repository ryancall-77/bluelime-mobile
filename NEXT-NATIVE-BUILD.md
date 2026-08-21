# Next native build — apply these, then cut the build

Everything here is **deliberately not committed to the shipping app**, because each item
is a **fingerprint input**: changing any of them means build 2 (in App Store review as of
2026-08-19) can no longer receive OTA hotfixes. Apply them only when you are cutting a
native build anyway. Ryan's call, 2026-08-19.

## 1. Photo rotation (Ryan's ask, 2026-08-19)

The photo viewer is **already rotation-ready** — `src/components/PhotoViewer.tsx` sizes
everything from `useWindowDimensions()` and re-anchors the pager on any window resize, so
it follows whatever the OS reports the instant the lock comes off. Nothing in the viewer
needs to change.

**a. Install the orientation module**
```
npx expo install expo-screen-orientation
```

**b. `app.json` — allow landscape at the native level**
```diff
-    "orientation": "portrait",
+    "orientation": "default",
```
This is what generates iOS `UISupportedInterfaceOrientations`. No JS can override it,
which is why the ⟳ button exists today as the portrait-locked substitute.

**c. Lock portrait app-wide, unlock only inside the viewer**

`"default"` alone lets the WHOLE app rotate — forms, tabs, the report WebView — which is
not what was asked for and looks wrong on a submit form. So re-lock globally at startup
and open the gate only while the viewer is mounted.

In `src/app/_layout.tsx`, once on mount:
```ts
import * as ScreenOrientation from 'expo-screen-orientation';
useEffect(() => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {}); }, []);
```

In `src/components/PhotoViewer.tsx`, while a photo is open:
```ts
useEffect(() => {
  if (!state) return;
  ScreenOrientation.unlockAsync().catch(() => {});
  return () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {}); };
}, [state]);
```

**d. Keep the ⟳ button.** It is still useful for a landscape photo the user does not want
to physically turn the phone for, and it costs nothing.

## 1b. RESTORE `ascAppId` to eas.json — REMOVED ON PURPOSE, PUT IT BACK

```json
  "submit": { "production": { "ios": { … , "ascAppId": "6801364590" } } }
```

Removed 2026-08-21 so build 2 could receive OTA updates again, and it MUST come back
when this build is cut — without it `eas submit` has no App Store Connect app to
target.

**Why it had to go.** expo-updates hashes the WHOLE of `eas.json` as a fingerprint
source (`reasons: ["easBuild"]`). Adding a submit-time setting that has nothing to do
with the native runtime moved the fingerprint from `4f563724…` to `805d3d44…`, which
silently severed the OTA channel to build 2 — the only binary anyone has installed.
Every `eas update` between that commit and 2026-08-21 published to a runtime version
no device was on. Verified by recomputing the fingerprint with and without the line:
reverting it reproduces build 2's runtime exactly.

**The trap for next time:** any edit to eas.json — even one the native build could not
possibly care about — invalidates OTA delivery to every existing install. Batch such
edits into the commit that cuts a build, never between builds.

## 4. Universal Links (funnel deep-linking, 2026-08-20)

`ios.associatedDomains: ['applinks:realtyzoom.com']` + an AASA route handler serving
`application/json` with no redirect. The root catch-all already excludes
`/.well-known/`; only the middleware matcher needs an exclusion.

Needed by the buyer funnel: without it a tapped deal link cannot open the app, and an
install arriving from the App Store has no memory of which deal or which buyer sent
them. Note what it does NOT do — it solves re-engagement for people who already have
the app, and gives nothing on a cold launch after an install. That still needs the
claim code.

## 2. Renormalise line endings — do this FIRST, in the same commit

⚠️ `.gitignore` is still CRLF locally while CI checks out LF, so local and CI compute
different fingerprints and CI-published OTAs can never reach a locally-built app. Run
`git add --renormalize .` **immediately before** cutting the build — never while a build
is live in review, because it changes the local fingerprint and kills OTA hotfixes for it.
From that build onward local and CI agree and either can publish.

## 3. After the build

- The new build supersedes build 2 in App Store review — expect to resubmit and restart
  the review clock.
- Re-verify the OTA path against the NEW fingerprint before relying on it:
  `npx eas-cli@latest fingerprint:generate --platform ios --non-interactive`
  and confirm it matches what `eas build:view` reports for the new build.
