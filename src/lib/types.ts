// Shared API types — mirror the Bluelime marketplace backend contract exactly
// (see README "Backend API contract"). Money is always integer cents.

export interface FeedDeal {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  ask_cents: number | null;
  arv_cents: number | null;
  rehab_cents: number | null;
  profit_cents: number | null;
  photo: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface FeedResponse {
  deals: FeedDeal[];
}

// A signed cents line (P&L / cashflow breakdown). `text` overrides the money
// value when the line is descriptive (e.g. "25% down · 30-yr @ 7.25%").
export interface MoneyLine { label: string; cents: number; kind?: 'value' | 'cost' | 'income'; text?: string }

// Seller marketing payload (from the CRM feed).
export interface DealMarketing {
  headline?: string | null;
  description?: string | null;
  highlights?: string | null;
  offer_terms?: string | null;
  offer_process?: string | null;       // LEGACY combined field (fallback)
  // Split successor of offer_process (Ryan 2026-07-29) — three titled sections.
  showings?: string | null;
  offer?: string | null;
  agent_instructions?: string | null;
  deal_type?: string | null;
  buyer_report_url?: string | null;
  contact?: { phone?: string | null; text_line?: string | null } | null;
}

// Buy-and-hold cashflow box (null when RentCast has no estimate).
export interface RentBox {
  rent_cents: number;
  net_monthly_cents: number;
  cap_rate_pct: number;
  cash_on_cash_pct: number;
  op_costs_cents: number;
  op_cost_lines: MoneyLine[];
  debt_service_cents: number;
  debt_lines: MoneyLine[];
}

// Full detail — a superset of FeedDeal with the verified P&L lines and gallery.
export interface DealDetail extends FeedDeal {
  zip?: string | null;
  year_built?: number | null;
  property_type?: string | null;
  lot_sqft?: number | null;
  condition_score?: number | null;
  verified_at?: string | null;
  photos?: string[];
  net_profit_cents?: number | null;
  // P&L lines from the backend profit engine; each is signed cents.
  pnl_lines?: MoneyLine[];
  // Flip-box detail — grouped closing/selling/holding costs + their breakdown.
  costs_cents?: number | null;
  cost_lines?: MoneyLine[];
  // Buy-and-hold cashflow box (web parity); null when no rent estimate.
  rent?: RentBox | null;
  marketing?: DealMarketing | null;
  accepting_offers?: boolean;
  contract_verified?: boolean;
  sale_mode?: string | null;
  offer_deadline?: string | null;
  saved?: boolean;
  listing_state?: string;
}

export interface ReportComp {
  id: string;
  address: string;
  distance_miles: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  sale_price_cents: number | null;
  sale_date: string | null;
  similarity_pct: number | null;
  condition_score: number | null;
  photo: string | null;
  latitude: number | null;
  longitude: number | null;
  property_type: string | null;
}

export interface RehabItem {
  label: string;
  cost_cents: number;
  reasoning: string | null;
}

export interface DealReport {
  comps: ReportComp[];
  rehab_items: RehabItem[];
  condition?: string | null;
  rehab_total_cents?: number | null;
  condition_score?: number | null;
}

export interface DealDetailResponse {
  deal: DealDetail;
  report: DealReport;
}

// Buy-box buckets — must match backend match.ts PROPERTY_TYPE_LABELS keys.
export type PropertyTypeBucket =
  | 'single_family' | 'condo' | 'townhouse' | 'multi_family'
  | 'manufactured' | 'land' | 'other';

export const PROPERTY_TYPE_LABELS: Record<PropertyTypeBucket, string> = {
  single_family: 'Single family',
  condo: 'Condo',
  townhouse: 'Townhouse',
  multi_family: 'Multi-family (2–4)',
  manufactured: 'Mobile / manufactured',
  land: 'Land',
  other: 'Other',
};

export type Strategy = 'flip' | 'hold' | 'both';
export type AlertMode = 'instant' | 'digest' | 'off';

export interface BuyBox {
  id?: string;
  markets: string[];
  price_min_cents: number | null;
  price_max_cents: number | null;
  property_types: PropertyTypeBucket[];
  min_profit_cents: number | null;
  min_profit_pct: number | null;
  alert_mode: AlertMode;
}

export interface BuyerProfile {
  email: string | null;
  display_name: string | null;
  phone: string | null;
  strategy: Strategy | null;
  pof_status?: string | null;
}

export interface ListingCard {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  ask_cents: number | null;
  listing_state?: string;
  photo: string | null;
  profit_cents: number | null;
}

export interface OfferRow {
  id: string;
  amount_cents: number | null;
  status: string;
  counter_cents: number | null;
  seller_note: string | null;
  round: number | null;
  created_at: string;
  listing: ListingCard | null;
}

export interface ProfileResponse {
  profile: BuyerProfile;
  buy_box: BuyBox | null;
  saved: ListingCard[];
  inquired: { interest_id: string; stage: string; listing: ListingCard | null }[];
  offers: OfferRow[];
}

export interface ThreadMessage {
  id: string;
  sender: 'buyer' | 'seller' | string;
  body: string;
  created_at: string;
}

// Buyer offer row (Offers pipeline tab).
export interface OfferListItem {
  id: string;
  listing_id: string;
  amount_cents: number | null;
  status: 'submitted' | 'countered' | 'accepted' | 'declined' | 'withdrawn' | string;
  round: number;
  counter_cents: number | null;
  seller_note: string | null;
  responded_at: string | null;
  created_at: string;
  address: string | null;
  city: string | null;
  state: string | null;
  photo: string | null;
}

// Inbox rows (buyer Messages tab / seller Buyers tab).
export interface ThreadListItem {
  listing_id: string;
  interest_id: string;
  stage: string;
  address: string | null;
  city: string | null;
  state: string | null;
  photo: string | null;
  last_message: { body: string; sender: 'buyer' | 'seller'; created_at: string } | null;
  unread: number;
  updated_at: string;
}
// Live offer summary attached to a seller thread / inbox row.
export interface ThreadOffer {
  id: string;
  amount_cents: number | null;
  status: 'submitted' | 'countered' | string;
  counter_cents: number | null;
  note?: string | null;
  created_at?: string;
}
export interface SellerThreadListItem extends ThreadListItem {
  buyer_name: string;
  offer?: ThreadOffer | null;
}
export interface SellerThreadResponse {
  interest_id: string;
  listing_id: string;
  stage: string;
  address: string | null;
  buyer_name: string;
  offer?: ThreadOffer | null;
  messages: ThreadMessage[];
}

export interface ThreadResponse {
  interest_id: string | null;
  stage?: string;
  messages: ThreadMessage[];
}

// ───────────────────────── Underwriting (supply side / "My Deals") ─────────────
// Mirrors /api/underwriting/list rows + /api/underwriting/submit response.

export type UnderwritingStatus =
  | 'processing' | 'queued' | 'pending_review' | 'under_review'
  | 'approved' | 'complete' | 'failed' | 'pre_estimate_complete' | string;

export interface UnderwritingListItem {
  id: string;
  property_address: string | null;
  property_sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  arv_cents: number | null;
  cash_mao_cents: number | null;
  novation_mao_cents: number | null;
  final_cash_mao_cents: number | null;
  final_novation_mao_cents: number | null;
  status: UnderwritingStatus;
  created_at: string;
  created_by_name?: string;
  access_token: string | null;        // → report WebView: /underwriting/<access_token>
  buyer_share_token: string | null;
  buyer_share_enabled: boolean | null; // already posted to marketplace?
}

export interface SubmitUnderwritingBody {
  property_address: string;
  property_sqft?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  year_built?: number | null;
  has_pool?: boolean;
  lot_size?: number | null;
  raw_property_type?: string | null;
  salesperson_comments?: string | null;
}

export interface SubmitUnderwritingResponse {
  ok: true;
  analysis_id: string;
  access_token: string;
  review_url: string;
  status: UnderwritingStatus;
  queued?: boolean;
  queue_message?: string | null;
}

export interface PublishMarketplaceResponse {
  ok: true;
  buyer_url: string;          // public shareable buyer link (send to buyers)
  // Publishing also lists the deal on the marketplace (Ryan 2026-07-29).
  // listing_url is the live /deals/p/<id> page; `listing.skipped` explains a
  // no-op (e.g. 'no_ask_price' — the buyer link still published).
  listing_url?: string | null;
  listing?: {
    listingId: string | null;
    created: boolean;
    becameActive: boolean;
    skipped?: 'no_ask_price' | 'crm_owned' | 'not_listable';
    error?: string;
  } | null;
}
