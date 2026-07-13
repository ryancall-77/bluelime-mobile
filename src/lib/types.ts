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
