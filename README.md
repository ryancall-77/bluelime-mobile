# Bluelime Deals — buyer mobile app

Native iOS + Android app (Expo / React Native, SDK 57, Expo Router) for the
**Bluelime Deals** real-estate deal marketplace. Buyers browse verified off-market
deals, get push alerts (60-minute early-access head start), view the verified
report, submit offers with proof-of-funds, and message the seller in-app.

This is the **MVP foundation** — every core screen and flow is wired against the
backend contract. Items marked _[stub]_ below need backend endpoints and/or a
dev build to fully exercise.

---

## Run it

```bash
cd C:\Users\ryan\dev\bluelime-mobile
cp .env.example .env         # fill in Supabase URL + anon key (see below)
npx expo start               # boots Metro; press i / a, or scan in Expo Go*
```

\* **Expo Go caveat:** push notifications and the flows that touch native modules
are best tested in a **dev build**, not Expo Go:

```bash
npx expo run:ios       # or: eas build --profile development --platform ios
```

The project boots and every screen renders with **no env configured** — the
login screen shows a "not configured" notice and screens use loading/empty
states until the backend + Supabase are wired. `npx expo export` bundles all
routes cleanly (verified) and `npx tsc --noEmit` passes.

### Environment (`.env` / EAS)

| Var | Purpose |
|---|---|
| `EXPO_PUBLIC_API_BASE` | Bluelime backend. Default `https://bluelime.ai`. |
| `EXPO_PUBLIC_SUPABASE_URL` | The **same** Supabase project buyers sign up against on the web. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | That project's anon/public key (safe to embed). |

`EXPO_PUBLIC_*` vars are inlined at bundle time. For EAS builds they're set under
`build.<profile>.env` in `eas.json` (API base is already there — add the two
Supabase vars, or use EAS secrets).

---

## Architecture

```
src/
  app/                     Expo Router routes (file-based)
    _layout.tsx            Providers + auth gate + push deep-link routing
    index.tsx              Entry redirect
    (auth)/login,signup    Email/password login; signup has the EULA gate
    (tabs)/index           Deal FEED (matched, numbers up front)
    (tabs)/watchlist       Saved deals
    (tabs)/account         Settings: buy-box, notif prefs, delete, sign out, support
    deal/[id]              Deal DETAIL: verified P&L + gallery + comps + rehab + report/save
    offer/[id]             OFFER flow with proof-of-funds upload
    messages/[id]          In-app messaging thread (report/block)
    buybox                 Buy-box setup/edit
    terms                  In-app EULA summary
  components/  ui.tsx, DealCard.tsx
  lib/
    config.ts              Env + brand constants
    supabase.ts            Supabase RN client (LargeSecureStore, PKCE, AppState refresh)
    secureStore.ts         Encrypted session storage adapter
    auth.tsx               Auth context (shared web account)
    api.ts                 Bearer API layer (matches the backend contract)
    upload.ts              File→bytes for multipart POF upload
    push.ts                expo-notifications register + tap routing
    types.ts, format.ts, theme.ts
```

Patterns reused from `rz-mobile` (the RealtyZoom CRM app): the auth-context shape,
the `api()` Bearer wrapper, and the `push.ts` register/tap module — same Apple
account / EAS approach. The key difference: **auth is Supabase** (one shared
buyer account with the web), not the CRM's custom JWT login.

### Auth (one shared account)

Buyers sign up on the web; the app logs in with the **same** Supabase
email/password account. `supabase.ts` follows the Expo/Supabase best practices:
`LargeSecureStore` (AES-encrypted session, key in Keychain/Keystore),
`detectSessionInUrl:false`, `autoRefreshToken` + `AppState` wiring, and PKCE with
a `bluelimemobile://auth` deep link for email confirmation. Every authenticated
API call sends `Authorization: Bearer <supabase access_token>`.

---

## Backend API contract (what the app calls)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/marketplace/feed` | Deals matching the buyer's buy-box. |
| GET | `/api/marketplace/deal/[id]` | Full detail + `{ report: { comps, rehab_items, condition } }`. |
| PUT | `/api/marketplace/buyer/buybox` | Upsert buy-box (existing route). |
| GET | `/api/marketplace/buyer/profile` | Profile + saved + inquired + offers (existing). |
| PATCH | `/api/marketplace/buyer/profile` | Edit name / phone / strategy (existing). |
| POST | `/api/marketplace/listings/[id]/save` | Toggle watchlist. |
| GET/POST | `/api/marketplace/listings/[id]/thread` | Buyer↔seller messages (existing). |
| POST | `/api/marketplace/listings/[id]/inquire` | Open a thread / message seller (existing). |
| POST | `/api/marketplace/listings/[id]/make-offer` | **multipart** offer + POF file (existing). |
| POST | `/api/marketplace/push/register` | `{ expo_push_token }`. |
| POST | `/api/marketplace/moderation/report` | Report content (Apple UGC). _[stub — endpoint may be pending]_ |
| POST | `/api/marketplace/moderation/block` | Block counterparty. _[stub]_ |
| POST | `/api/marketplace/buyer/delete` | In-app account deletion (Apple 5.1.1(v)). _[stub]_ |

Money is integer **cents** everywhere.

### Proof-of-funds upload (important)

RN's `FormData({ uri })` produces **0-byte files on iOS**. `lib/upload.ts` instead
reads the picked file's actual **bytes** via expo-file-system's new `File` API
(`new File(uri).bytes()`, SDK 54+) and `api.ts` attaches a real `Blob`. Do **not**
revert to `{ uri, type, name }` attachments. If a future SDK moves the File API,
switch the import in `upload.ts` to `expo-file-system/next` or `/legacy`.

---

## What's built vs. stubbed

**Built & wired:** onboarding/login/signup with EULA gate; buy-box setup (markets,
price band, property types, min-profit, strategy, alert mode); matched deal feed
with numbers up front; deal detail with verified P&L, photo gallery, comps, rehab
breakdown, "verified by Bluelime" badge; save/watchlist; offer flow with POF
document/photo upload; in-app messaging with optimistic send, report, and block;
push registration + tap→deal deep-link; account/settings with edit buy-box,
notification toggle, in-app account deletion, sign out, and support/legal links.

**Stubbed / needs backend or config:**
- `moderation/report`, `moderation/block`, and `buyer/delete` endpoints (a parallel
  backend agent is adding feed/deal/push; these moderation + delete routes may
  still need building). The app calls them and handles success/error gracefully.
- The feed's `pnl_lines` / `net_profit_cents` render if the `deal/[id]` response
  includes them (the backend profit engine computes these — see
  `src/lib/marketplace/profit.ts` in the main repo). If absent, the headline
  numbers still show.
- Notification **prefs toggle** on Account is local UX; the authoritative switch is
  the buy-box `alert_mode` (instant/digest/off) persisted server-side.
- Push requires a **dev build** + real device (no push in Expo Go / simulators)
  and a valid `extra.eas.projectId` in `app.json`.
- App icons/splash are the Expo template placeholders — replace with Bluelime art.
- EAS `projectId` (`app.json`) and `ascAppId` (`eas.json`) are placeholders — fill
  in after `eas init` / App Store Connect app creation.

---

## App Store review path & moderation requirements

This is a **UGC app** (buyers message sellers), so Apple requires (Guideline 1.2 /
5.1.1) — all present in this build:

- **EULA / terms agreement at signup** — enforced checkbox on the signup screen;
  account can't be created without it.
- **Report control** on user content — long-press a received message, plus a
  "Report this listing" control on the deal detail.
- **Block control** — "Block" in the messages screen header.
- **In-app account deletion** — Account → Delete account (Guideline 5.1.1(v)).
- **Support/contact link** — Account → Contact support (`mailto:`).
- A published **Terms/EULA + Privacy Policy** URL (`lib/config.ts`) — ensure these
  pages are live before submission.

Also: the iOS photo/camera usage strings are set in `app.json`,
`ITSAppUsesNonExemptEncryption:false` is set, and you should provide a demo account
for review since content is behind login.

### Build / submit (do NOT run without Ryan's per-time go — costs money)

```bash
eas init                                         # sets extra.eas.projectId
eas build --profile development --platform ios   # dev client for push testing
eas build --profile preview     --platform ios   # internal distribution
eas build --profile production  --platform all
eas submit --profile production  --platform ios
```

`eas.json` uses `appVersionSource: remote` with dev/preview/production profiles;
production auto-increments the build number.

---

## Remaining work to ship

1. Land the backend `feed`, `deal/[id]`, `push/register`, `save`, `moderation/*`,
   and `buyer/delete` routes and verify shapes against `lib/types.ts`.
2. Fill EAS `projectId`, ASC `ascAppId`, Supabase env, and real app icons/splash.
3. Dev build on device → verify push token registration + tap deep-link, and the
   POF multipart upload end-to-end (confirm a non-zero file lands in storage).
4. Replace emoji tab icons with vector/SF Symbols.
5. Confirm the PKCE email-confirm deep link resolves (`bluelimemobile://auth`).
6. Legal: publish Terms/EULA + Privacy pages; prepare an App Store review demo login.
