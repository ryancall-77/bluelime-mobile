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
}

export interface FeedResponse {
  deals: FeedDeal[];
}

// Full detail — a superset of FeedDeal with the verified P&L lines and gallery.
export interface DealDetail extends FeedDeal {
  zip?: string | null;
  year_built?: number | null;
  property_type?: string | null;
  condition_score?: number | null;
  verified_at?: string | null;
  photos?: string[];
  net_profit_cents?: number | null;
  // P&L lines from the backend profit engine; each is signed cents.
  pnl_lines?: { label: string; cents: number; kind: 'value' | 'cost' }[];
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
  buyer_url: string; // public shareable buyer link (send to buyers)
}
