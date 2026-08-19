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
