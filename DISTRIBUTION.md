# Bluelime Deals — how builds & updates reach the phone

**Read this before triggering any EAS build.** It's cheap to get wrong.

## The model (no TestFlight, no App Store — internal distribution + OTA)

Two channels are configured in `eas.json`:

| Profile      | Distribution | Channel      | When you use it |
|--------------|--------------|--------------|-----------------|
| `preview`    | **internal** | `preview`    | **The one we use.** Install straight on-device from the Expo build link/QR. No App Store, no review. |
| `production` | store        | `production` | App Store / TestFlight only. **We are NOT using this** — it costs review overhead and doesn't receive our OTAs. |
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
