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
  app/                          Expo Router routes (file-based)
    _layout.tsx                 Providers + auth gate + push deep-link routing
    index.tsx                   Entry redirect
    (auth)/login,signup         Email/password login; signup has the EULA gate
    (marketplace)/              Buyer side — bottom tabs: Search (map/list feed),
                                   Favorites (watchlist), Offers (pipeline), Messages (inbox)
    (underwriting)/             Supply side — bottom tabs: Underwrite (submit), Reports
                                   ("My Deals"), Listings (published to Marketplace), Buyers (dispo inbox)
    deal/[id]                   Deal DETAIL: verified P&L + gallery + embedded report + report/save
    offer/[id]                  OFFER flow with proof-of-funds upload
    messages/[id]                Buyer↔seller thread (report message / block seller)
    seller-thread/[id]          Seller side of a thread (reply, accept/counter/decline)
    underwriting/new            New underwriting (modal)
    underwriting/[id]           Owner's full report (WebView) + Push to Marketplace
    underwriting/prepare/[id]   Listing prep — photos + marketing copy + publish
    account                     Settings: profile, buy-box, alerts, delete, support/legal
    buybox                      Buy-box setup/edit
    terms                       In-app EULA summary
  components/  TopBar.tsx, DealCard.tsx, EmbeddedReport.tsx, PhotoViewer.tsx,
                AddressAutocomplete.tsx, SubmitUnderwritingForm.tsx, UnderwritingTabBar.tsx, ui.tsx
  lib/
    config.ts                   Env + brand constants
    supabase.ts                 Supabase RN client (LargeSecureStore, PKCE, AppState refresh)
    secureStore.ts              Encrypted session storage adapter
    auth.tsx                    Auth context (shared web account)
    api.ts                      Bearer API layer (matches the backend contract)
    upload.ts                   File→bytes for multipart POF upload
    push.ts                     expo-notifications register + tap routing
    buildTag.ts                 Human-readable build marker shown on Account (bump on every push)
    types.ts, format.ts, theme.ts, lastTab.ts
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

_Last verified against the actual code 2026-08-12 — this section had drifted
badly stale before that (described an old `(tabs)` route layout that no longer
exists, and called several endpoints "stubs" that had since shipped). If this
section and the code ever disagree again, trust the code and fix this file._

**Built & wired, buyer side:** onboarding/login/signup with EULA gate; buy-box
setup (markets, price band, property types, min-profit, strategy, alert mode);
matched deal feed (map + list) with numbers up front; deal detail with verified
P&L, photo gallery, the full embedded web report (comps/rehab/condition), save/
watchlist, report listing; offer flow with required-terms agreement + POF
document/photo upload; in-app messaging with optimistic send, per-message report,
and block seller; offers pipeline with live status + seller counters; push
registration + tap→deal deep-link; account/settings with editable name/phone,
buy-box edit, alert toggle, in-app account deletion, sign out, support/legal links.

**Built & wired, supply side:** run a new underwriting from the phone (queues if
no RPR agent is live); "My Deals" list with status + search; owner's full report
in-app (WebView) with photo lightbox; publish to Marketplace via a native prepare
screen (photos, listing copy, offer terms, quiet-list vs. alert-buyers toggle);
Listings tab (your own published deals); Buyers tab (dispo inbox — buyer messages
+ live offers across your listings) with accept/counter/decline.

**Real, not stubs — all three Apple-UGC-required moderation endpoints are live
and have each been through a real bug-fix pass** (contract mismatches between
the app and server were caught and fixed 2026-07-26/07-30 — see
`api/marketplace/moderation/{report,block}/route.ts` and `buyer/delete/route.ts`
in the main `bluelime` repo for the specifics):
- `POST /api/marketplace/moderation/report` — writes to `content_reports`.
- `POST /api/marketplace/moderation/block` — writes to `user_blocks`.
- `POST /api/marketplace/buyer/delete` — deletes the Supabase auth user
  (cascades buyer_profiles, buy_boxes, tokens, saves/alerts).

**Remaining real gaps:**
- Notification **prefs toggle** on Account is local UX; the authoritative switch
  is the buy-box `alert_mode` (instant/digest/off) persisted server-side.
- Push requires a **dev build** + real device (no push in Expo Go / simulators).
- Seller "Counter" on `seller-thread/[id]` uses `Alert.prompt`, which is
  **iOS-only** in React Native — Android sellers see "Countering is available on
  iOS for now" instead of a working flow. Not a blocker for the iOS App Store
  submission; worth a real fix before an Android release.
- App icons/splash/EAS `projectId`/`ascAppId` are all **real, not placeholders**
  (contrary to what this file used to say) — see DISTRIBUTION.md for how
  `ascAppId` is deliberately kept OUT of the committed `eas.json` and injected
  at CI time instead.

---

## App Store review path & moderation requirements

This is a **UGC app** (buyers message sellers), so Apple requires (Guideline 1.2 /
5.1.1) — all present in this build, and confirmed present in a code review
2026-08-12 (not just claimed here — read the actual screens):

- **EULA / terms agreement at signup** — enforced checkbox on the signup screen;
  account can't be created without it (`(auth)/signup.tsx`).
- **Report control** on user content — long-press a received message
  (`messages/[id].tsx`), plus a "Report this listing" control on the deal
  detail (`deal/[id].tsx`).
- **Block control** — "Block" in the messages screen header (`messages/[id].tsx`).
- **In-app account deletion** — Account → Delete account, with a confirming
  destructive alert (Guideline 5.1.1(v)).
- **Support/contact link** — Account → Contact support (`mailto:`), and repeated
  on the in-app `terms.tsx` screen.
- **Terms/EULA + Privacy Policy pages** (`lib/config.ts`'s `TERMS_URL`/
  `PRIVACY_URL`, both `bluelime.ai/terms` and `bluelime.ai/privacy`) —
  confirmed live (HTTP 200) 2026-08-12.

Also present: iOS photo/camera usage strings in `app.json`,
`ITSAppUsesNonExemptEncryption:false`. Still needed before submitting for
review: **a demo account for Apple's reviewer**, since all content is behind
login — that's a Ryan action, not a code gap.

### Build / submit

**Never run a build or submit without Ryan's per-time go — every EAS build/
submit is billed against his account.** State the cost when you ask, every
time — see the standing rule in project memory.

`eas build`/`eas submit` are classifier-blocked in a local Claude Code shell —
use the GitHub Actions workflows instead (`.github/workflows/eas-build.yml`,
`eas-submit.yml`), dispatched via `gh workflow run` or the Actions tab:

```bash
gh workflow run eas-build.yml -f platform=ios -f profile=production   # native build
gh workflow run eas-submit.yml -f platform=ios                        # → TestFlight
```

`eas-submit.yml` submits to **TestFlight only** — that needs no Apple review.
Actually going public on the App Store is a separate, manual step in App Store
Connect (opening the version page and clicking "Add for Review" /
"Submit for Review") that nothing in this repo automates, and nobody should
click without Ryan's explicit go — see DISTRIBUTION.md.

`eas.json` uses `appVersionSource: remote` with dev/preview/production profiles;
production auto-increments the build number. `ascAppId` is deliberately absent
from the committed file — the submit workflow injects it at run time (see the
comment at the top of `eas-submit.yml`); adding it to the committed file
changes the OTA fingerprint and silently orphans installed apps from updates.

---

## Remaining work to ship

_Rewritten 2026-08-12 — every item below was independently re-checked against
the current code/build history, not assumed from the old version of this list._

**Done (this list used to claim these were open — they aren't):**
- ✅ Backend routes (`feed`, `deal/[id]`, `push/register`, `save`, `moderation/*`,
  `buyer/delete`) are all live, and the moderation/push ones each already had a
  real contract-mismatch bug found and fixed against this exact app.
- ✅ EAS `projectId`, Supabase env, and real app icons/splash/adaptive-icon are
  all filled in with real values, not placeholders.
- ✅ Terms/EULA + Privacy pages are published and live (confirmed HTTP 200).

**Still genuinely open:**
1. **A fresh production build, before submitting.** The last App-Store-profile
   build (`build:list` id `2ae80beb`, 2026-08-02) predates 18 commits on `main`,
   including two real fixed bugs (a proof-of-funds upload crash/hang, and an
   org-data leak in the Listings tab) that are only on the `preview` channel
   today. Don't submit the stale build.
2. Provide **a demo account** for Apple's reviewer (all content is behind
   login) — a Ryan action, not a code change.
3. PKCE email-confirm deep link (`bluelimemobile://auth`) is implemented
   (`auth.tsx`) but not end-to-end verified on a real device/mailbox — do that
   once during the next real device test.
4. POF multipart upload and push token registration are implemented and have
   fix history behind them (see the extensive comments in `lib/upload.ts` and
   `lib/api.ts`), but confirm both again on the next real device test — no
   session since has re-verified them live.
5. Replace emoji tab icons with vector/SF Symbols — cosmetic polish, not a
   submission blocker.
6. Seller "Counter offer" is iOS-only (`Alert.prompt`) — fine for an
   iOS-only submission, needs a real cross-platform input before Android ships.
