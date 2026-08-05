// RealtyZoom Deals API layer. Every authenticated call carries
// `Authorization: Bearer <supabase access_token>` — the SAME token the web app
// uses (one shared account). Base URL from EXPO_PUBLIC_API_BASE.
//
// Matches the backend contract in the README exactly. Money is integer cents.

import { API_BASE } from './config';
import { getAccessToken } from './supabase';
import type {
  FeedResponse, DealDetailResponse, ProfileResponse, BuyBox, ThreadResponse, ThreadMessage,
  UnderwritingListItem, SubmitUnderwritingBody, SubmitUnderwritingResponse, PublishMarketplaceResponse,
  ThreadListItem, SellerThreadListItem, SellerThreadResponse, OfferListItem,
} from './types';

async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: await authHeaders() });
  return parse<T>(res);
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return parse<T>(res);
}

// ───────────────────────── Feed / detail ─────────────────────────

// GET /api/marketplace/feed → deals matching the buyer's buy-box.
export const getFeed = () => get<FeedResponse>('/api/marketplace/feed');

// GET /api/marketplace/deal/[id] → full detail + report.
export const getDeal = (id: string) =>
  get<DealDetailResponse>(`/api/marketplace/deal/${encodeURIComponent(id)}`);

// ───────────────────────── Buy-box / profile ─────────────────────────

// GET /api/marketplace/buyer/profile → profile + saved + inquired + offers.
export const getProfile = () => get<ProfileResponse>('/api/marketplace/buyer/profile');

// PUT /api/marketplace/buyer/buybox → upsert the buyer's buy-box.
export const putBuyBox = (box: BuyBox) =>
  send<{ ok: true; buy_box_id: string }>('/api/marketplace/buyer/buybox', 'PUT', box);

// PATCH /api/marketplace/buyer/profile → edit name / phone / strategy.
export const patchProfile = (patch: { display_name?: string; phone?: string; strategy?: string }) =>
  send<{ ok: true }>('/api/marketplace/buyer/profile', 'PATCH', patch);

// ───────────────────────── Save / watchlist ─────────────────────────

// Add to / remove from the watchlist. The server keys the action off the HTTP
// METHOD — POST upserts the save, DELETE removes it — and ignores the body
// entirely. Sending POST with {saved:false} therefore RE-SAVED the listing and
// returned saved:true, so un-favouriting was impossible: the star dimmed, then
// popped straight back (Ryan 2026-07-30). `saved` here is the DESIRED state.
export const saveListing = (id: string, saved: boolean) =>
  send<{ ok: true; saved: boolean }>(
    `/api/marketplace/listings/${encodeURIComponent(id)}/save`,
    saved ? 'POST' : 'DELETE',
  );

// ───────────────────────── Messaging (inquiry thread) ─────────────────────────

// GET /api/marketplace/listings/[id]/thread → the buyer↔seller thread.
export const getThread = (id: string) =>
  get<ThreadResponse>(`/api/marketplace/listings/${encodeURIComponent(id)}/thread`);

// POST /api/marketplace/listings/[id]/thread → reply in an existing thread.
export const postThreadMessage = (id: string, message: string) =>
  send<{ ok: true; message: ThreadMessage }>(
    `/api/marketplace/listings/${encodeURIComponent(id)}/thread`, 'POST', { message },
  );

// GET /api/marketplace/offers → the buyer's offers across listings, with status.
export const listOffers = () => get<{ offers: OfferListItem[] }>('/api/marketplace/offers');

// GET /api/marketplace/threads → the buyer's message inbox (one row per thread).
export const listThreads = () => get<{ threads: ThreadListItem[] }>('/api/marketplace/threads');

// GET /api/marketplace/seller/threads → the seller's inbox (buyers on the org's listings).
export const listSellerThreads = () => get<{ threads: SellerThreadListItem[] }>('/api/marketplace/seller/threads');

// GET /api/marketplace/seller/threads/[interestId] → seller view of one thread.
export const getSellerThread = (interestId: string) =>
  get<SellerThreadResponse>(`/api/marketplace/seller/threads/${encodeURIComponent(interestId)}`);

// POST /api/marketplace/seller/threads/[interestId] → seller reply (pushes the buyer).
export const postSellerThreadMessage = (interestId: string, message: string) =>
  send<{ ok: true; message: ThreadMessage }>(
    `/api/marketplace/seller/threads/${encodeURIComponent(interestId)}`, 'POST', { message },
  );

// POST /api/marketplace/seller/threads/[interestId]/respond → accept/counter/decline
// the buyer's live offer (notifies the buyer by email + push).
export const respondToOffer = (
  interestId: string,
  body: { action: 'accept' | 'counter' | 'decline'; counter_cents?: number; note?: string },
) => send<{ ok: true; offer: { id: string; amount_cents: number | null; status: string; counter_cents: number | null } }>(
  `/api/marketplace/seller/threads/${encodeURIComponent(interestId)}/respond`, 'POST', body,
);

// POST /api/marketplace/listings/[id]/inquire → open a new inquiry / message the
// seller (creates the thread if none exists).
export const inquire = (id: string, body: { name: string; email: string; phone?: string; message?: string }) =>
  send<{ ok: true }>(`/api/marketplace/listings/${encodeURIComponent(id)}/inquire`, 'POST', body);

// ───────────────────────── Moderation (UGC — Apple requirement) ─────────────────────────

// POST /api/marketplace/moderation/report → flag a message/listing/user.
export const reportContent = (body: {
  target_type: 'message' | 'listing' | 'user';
  target_id: string;
  reason: string;
}) => send<{ ok: true }>('/api/marketplace/moderation/report', 'POST', body);

// POST /api/marketplace/moderation/block → block the counterparty on a listing.
export const blockCounterparty = (listingId: string) =>
  send<{ ok: true }>('/api/marketplace/moderation/block', 'POST', { listing_id: listingId });

// ───────────────────────── Account deletion (Apple 5.1.1(v)) ─────────────────────────

// POST /api/marketplace/buyer/delete → permanently delete the buyer account.
export const deleteAccount = () =>
  send<{ ok: true }>('/api/marketplace/buyer/delete', 'POST');

// ───────────────────────── Push registration ─────────────────────────

// POST /api/marketplace/push/register → register this device's Expo push token.
export const registerPushToken = (expo_push_token: string) =>
  send<{ ok: true }>('/api/marketplace/push/register', 'POST', { expo_push_token });

// ───────────────────────── Underwriting ("My Deals" / supply side) ─────────────

// GET /api/underwriting/list → this org's underwriting analyses (newest first).
export const listUnderwritings = () =>
  get<UnderwritingListItem[]>('/api/underwriting/list');

// POST /api/underwriting/submit → run a new underwriting from the phone. Always
// source 'mobile_app' — served by an RPR agent or queued (no local scrape).
export const submitUnderwriting = (body: SubmitUnderwritingBody) =>
  send<SubmitUnderwritingResponse>('/api/underwriting/submit', 'POST', { ...body, source: 'mobile_app' });

// NOTE: there is deliberately no one-tap "postToMarketplace(id)" any more. It
// posted an EMPTY payload to buyer-generate, which (a) wrote a blank snapshot —
// erasing any prepared listing copy and blanking the listing's marketing — and
// (b) left offer_price_cents null, so the server could never create a listing
// ('no_ask_price'). Publishing always goes through the prepare screen now.

// GET /api/underwriting/buyer-report/[id] → the previously prepared snapshot, so
// the prepare form seeds with what was entered last time instead of wiping it.
export const getPreparedListing = (analysisId: string) =>
  get<{
    ok: true;
    property_address: string | null;
    published: boolean;
    buyer_report: Record<string, unknown> | null;
  }>(`/api/underwriting/buyer-report/${encodeURIComponent(analysisId)}`);

// ── Prepare a listing for the Marketplace (photos + property details) ──
// The full prep payload posted to buyer-generate. Mirrors the website prepare
// page. Showings / Offer / Agent instructions are the split successor of the
// legacy offer_process field (Ryan 2026-07-29).
export interface PrepareListingInput {
  photo_urls?: string[];
  condition_notes?: string;
  offer_price_cents?: number | null;
  offer_terms?: string;
  showings?: string;
  offer?: string;
  agent_instructions?: string;
  // rz-crm marketing parity — same listing copy the CRM feed and the website
  // prepare page supply, so all three surfaces stay consistent.
  headline?: string;
  description?: string;
  highlights?: string;
  deal_type?: string;
  contact_phone?: string;
  contact_text_line?: string;
  contact_url?: string;
  contact_label?: string;
}

// Generate the buyer report from the prepared inputs, then publish to the
// Marketplace and hand back the public buyer link to share.
//
// notifyBuyers=false lists the deal QUIETLY (no buy-box alerts) so the seller can
// check the live page first. Publishing again with it true still alerts — alerts
// are idempotent per buyer, so nobody is ever notified twice.
export const prepareAndPublish = async (
  analysisId: string,
  input: PrepareListingInput,
  notifyBuyers = true,
): Promise<PublishMarketplaceResponse> => {
  const id = encodeURIComponent(analysisId);
  await send<{ ok: true; buyer_url?: string }>(`/api/underwriting/buyer-generate/${id}`, 'POST', input);
  return send<PublishMarketplaceResponse>(
    `/api/underwriting/buyer-publish/${id}`, 'POST', { notify_buyers: notifyBuyers },
  );
};

// The public report URL for an analysis (owner-facing full report) — loaded in a WebView.
export const reportUrl = (accessToken: string) => `${API_BASE}/underwriting/${encodeURIComponent(accessToken)}`;

// ───────────────────────── Address autocomplete (Google Places, server-proxied) ─────────────

export interface PlacePrediction { description: string; place_id: string }

// GET /api/places/autocomplete → US street-address suggestions. The Maps key
// lives server-side; we just pass the typed input + a rotating session token.
export const placesAutocomplete = (input: string, session: string) =>
  get<{ predictions: PlacePrediction[] }>(
    `/api/places/autocomplete?input=${encodeURIComponent(input)}&session=${encodeURIComponent(session)}`,
  );

// ───────────────────────── Offer (multipart with POF file) ─────────────────────────

export interface OfferInput {
  name: string;
  email: string;
  phone?: string;
  amountCents: number;
  specialTerms?: string;
  // Web parity (Ryan, 2026-08-09): true when the seller has required offer
  // terms and the buyer checked "I agree." Omitted/false when there are no
  // terms to agree to — the server only cares when terms exist.
  termsAgreed?: boolean;
  // Proof-of-funds document, already read to bytes (see readFileBytes).
  pof?: { bytes: Uint8Array; fileName: string; mimeType: string } | null;
}

// POST /api/marketplace/listings/[id]/make-offer — multipart/form-data.
//
// IMPORTANT: RN's FormData produces 0-byte files on iOS when you pass a { uri }
// object. We instead attach a real Blob built from the file's BYTES (read via
// expo-file-system's new File API — see readFileBytes in upload.ts). This is the
// documented workaround and the reason we don't pass { uri, type, name }.
export async function makeOffer(id: string, input: OfferInput): Promise<{ ok: true }> {
  const form = new FormData();
  form.append('name', input.name);
  form.append('email', input.email);
  if (input.phone) form.append('phone', input.phone);
  form.append('offer_amount', String(Math.round(input.amountCents / 100)));
  if (input.specialTerms) form.append('special_terms', input.specialTerms);
  form.append('pof_provided', input.pof ? 'true' : 'false');
  form.append('terms_agreed', input.termsAgreed ? 'true' : 'false');

  if (input.pof) {
    // Build a Blob from the actual bytes — NOT a { uri } shim.
    const blob = new Blob([input.pof.bytes as BlobPart], { type: input.pof.mimeType });
    form.append('pof_file', blob as unknown as Blob, input.pof.fileName);
  }

  const res = await fetch(`${API_BASE}/api/marketplace/listings/${encodeURIComponent(id)}/make-offer`, {
    method: 'POST',
    headers: await authHeaders(), // do NOT set Content-Type — fetch sets the multipart boundary
    body: form,
  });
  return parse<{ ok: true }>(res);
}
