# Bluelime Deals — how builds & updates reach the phone

**Read this before triggering any EAS build.** It's cheap to get wrong.

**Corrected 2026-08-12** — this file used to say "no TestFlight, no App Store,"
written before either existed. That's now wrong: the app reached TestFlight
2026-07-13 (ASC app 6790447988, "Bluelime Deals"), and `.github/workflows/
eas-submit.yml` submits new builds there headlessly. The core guidance below —
use `preview` + OTA for day-to-day iteration, and don't reach for a
`production` build casually — is still correct and still the right default.
The distinction that matters: `preview` is Ryan's own iteration loop;
`production` is what actually ships to TestFlight/App Store users, so it
needs a real reason (see "When to run a native build" below) and his go-ahead
every time.

## The model — `preview` for iteration, `production` for TestFlight/App Store

Two channels are configured in `eas.json`:

| Profile      | Distribution | Channel      | When you use it |
|--------------|--------------|--------------|-----------------|
| `preview`    | **internal** | `preview`    | **Day-to-day iteration.** Install straight on-device from the Expo build link/QR — Ryan's normal loop, no App Store, no review. |
| `production` | store        | `production` | **What TestFlight/App Store users actually get.** Submitted via `eas-submit.yml`. Costs review overhead (TestFlight itself needs none; public App Store release does) — don't use it for routine iteration, but it IS the real ship path, not something to avoid. |
| `development`| internal     | (dev client) | Local dev client only. |

## Two ways a change reaches the phone

1. **OTA (free, automatic)** — `.github/workflows/eas-update.yml` runs on every push to `main`
   and publishes `eas update --branch preview` (iOS). Testers get it on the next app relaunch.
   **This covers ALL JS-only changes** — screens, logic, API calls, styling.

2. **Native build (costs an EAS build, manual)** — `.github/workflows/eas-build.yml`,
   run with **profile `preview`**. Needed ONLY when the native layer changes.

## The three things that must line up for an OTA to actually apply

1. **Channel** — the installed build must be a **`preview`** build (channel `preview`).
   A `production` build will NEVER receive our OTAs.
2. **runtimeVersion** — `app.json` uses `policy: "fingerprint"`. An OTA only applies to a
   build with the **identical native fingerprint**. Any native-dep add/upgrade changes the
   fingerprint → older builds stop receiving new OTAs until they're rebuilt.
3. **The build is actually installed on the device.**

## When (and only when) to run a native `preview` build

- A native module is **added or upgraded** (e.g. `react-native-maps` on 2026-07-28) — the
  fingerprint changed, so a fresh build is required before its OTAs will apply.
- The phone has **no preview build** yet, or a **stale/wrong-channel** one.

If the change is JS-only and the phone already has a current preview build → **do nothing**,
the OTA delivers it. Do not build.

## Commands (run locally, needs `eas login`)

```
cd <repo>
eas build --platform ios --profile preview     # NOT production
# → open the finished build's page, install on-device via QR/link
```

Never run `eas submit` / the `production` profile unless we've explicitly decided to ship to
the App Store. That's the path that costs money/review and doesn't feed our OTA channel.
