import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { useRouter, useFocusEffect } from 'expo-router';
import { DealCard } from '@/components/DealCard';
import { Button, EmptyState, Loading, Pill } from '@/components/ui';
import { getPublicFeed } from '@/lib/api';
import type { FeedDeal } from '@/lib/types';
import { fmtUsdShort } from '@/lib/format';
import { colors, font, radius, space } from '@/lib/theme';
import { EARLY_ACCESS_HEADSTART_MIN } from '@/lib/config';
import { consumeNeedsBuyBox } from '@/lib/onboarding';
import { useAuth } from '@/lib/auth';
import { promptSignUp, requireAuth } from '@/lib/gate';

// Continental-US fallback when no deal has coordinates yet.
const US_REGION: Region = { latitude: 39.5, longitude: -98.35, latitudeDelta: 32, longitudeDelta: 40 };

// Spread = ARV − asking price, the same number the card pill shows. Coarse steps
// on purpose: this is a phone, not a search console.
const SPREAD_STEPS: Array<{ label: string; cents: number }> = [
  { label: 'Any', cents: 0 },
  { label: '$25k+', cents: 25_000_00 },
  { label: '$50k+', cents: 50_000_00 },
  { label: '$100k+', cents: 100_000_00 },
];

// single_family → "Single family". The server sends snake_case buckets.
function prettyType(t: string): string {
  const s = t.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Fit a region around the deals that have coordinates.
function regionFor(deals: FeedDeal[]): Region {
  const pts = deals.filter((d) => d.latitude != null && d.longitude != null) as Array<FeedDeal & { latitude: number; longitude: number }>;
  if (pts.length === 0) return US_REGION;
  const lats = pts.map((p) => p.latitude);
  const lngs = pts.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latPad = Math.max((maxLat - minLat) * 1.4, 0.08);
  const lngPad = Math.max((maxLng - minLng) * 1.4, 0.08);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latPad,
    longitudeDelta: lngPad,
  };
}

export default function Search() {
  const router = useRouter();
  const { signedIn } = useAuth();
  const [deals, setDeals] = useState<FeedDeal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [query, setQuery] = useState('');

  // ── Filters (Ryan, 2026-09-12) ────────────────────────────────────────────
  // Applied ON DEVICE, over the ≤100 deals the board already holds, rather than
  // as extra query params. The board is small, the whole set is already in
  // memory for the map pins, and doing it here means the filter row cannot get
  // out of step with a server deploy. `status` is the one exception — pending
  // has to be REQUESTED or it is never fetched at all.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [includePending, setIncludePending] = useState(true);   // pending shows by DEFAULT
  const [minSpread, setMinSpread] = useState(0);
  const [propertyType, setPropertyType] = useState<string | null>(null);

  const resetFilters = useCallback(() => {
    setIncludePending(true);
    setMinSpread(0);
    setPropertyType(null);
  }, []);

  // Counts only DEPARTURES from the default, so the badge means "you have
  // narrowed something", not "filters exist".
  const activeFilterCount =
    (includePending ? 0 : 1) + (minSpread > 0 ? 1 : 0) + (propertyType ? 1 : 0);

  // ⚠️ ALWAYS THE PUBLIC BOARD. EVERY deal, to everyone, signed in or not.
  // (Ryan, 2026-08-28: "It's essential that all deals show to all users all the
  // time. You don't even need to be a user or have an account.")
  //
  // This used to be `signedIn ? getFeed() : getPublicFeed()`, and /feed is
  // BUY-BOX MATCHED. So signing in made the board WORSE: the app-review account
  // has no buy-box, matched nothing, and every deal vanished the instant it
  // authenticated — a guest saw the whole map and a logged-in user saw nothing.
  // That is an App Store blocker, and it is backwards regardless.
  //
  // The buy-box stays what it is good for — deal ALERTS — and must never again
  // decide whether inventory is visible at all. If matched-first ordering is
  // wanted later, sort by it; do not filter on it.
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const res = await getPublicFeed();
      setDeals(res.deals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load deals');
      setDeals((d) => d ?? []);
    } finally {
      setRefreshing(false);
    }
  }, [signedIn]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // First run after signup: nudge toward the buy-box, softly. This used to be
  // an immediate router.push('/buybox') the instant this screen mounted — Ryan,
  // 2026-09-07: "after logging in [signing up + verifying], it takes me
  // immediately to the profile page. I'd rather it take me into the app... a
  // pop-up after a little bit of time browsing, that allows them to dismiss
  // it." The forced-push reasoning was also already stale: the 2026-08-28 "show
  // every deal to everyone regardless of buy-box" decision above means a new
  // account no longer sees an empty map without one — there is no longer an
  // urgent reason to interrupt them for it.
  //
  // Still consume-once (a user who dismisses it is never nagged again — same
  // guarantee as before), just shown as a dismissible card after a delay
  // instead of a forced navigation.
  const [showBuyBoxNudge, setShowBuyBoxNudge] = useState(false);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    consumeNeedsBuyBox().then((needs) => {
      if (cancelled || !needs) return;
      nudgeTimer.current = setTimeout(() => { if (!cancelled) setShowBuyBoxNudge(true); }, 15000);
    });
    return () => {
      cancelled = true;
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    };
  }, [signedIn]);

  // The buy-box is an account feature, so a guest tapping ⚙︎ or "Set up buy-box"
  // gets the prompt instead of a modal that could not save anything.
  const openBuyBox = useCallback(() => {
    if (requireAuth(signedIn, 'buybox')) router.push('/buybox');
  }, [signedIn, router]);

  // Same destination, different door. The empty-state button and the feed banner
  // both LABEL themselves "Create a free account", and both used to hand the tap
  // to requireAuth — which lands on Log IN. A brand-new user reads their own
  // button's promise, gets a password field for an account they do not have, and
  // has to find the small link at the bottom. promptSignUp goes where the label
  // said it would; the signup screen still links back to Log in for the minority
  // who already have one.
  const openSignUp = useCallback((reason: 'buybox' | 'alerts') => {
    promptSignUp(signedIn, reason);
  }, [signedIn]);

  // Property types present in the CURRENT result set — offering a type nothing
  // is listed under would just produce a guaranteed-empty board.
  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of deals ?? []) if (d.property_type) set.add(d.property_type);
    return [...set].sort();
  }, [deals]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (deals ?? []).filter((d) => {
      if (q && !([d.address, d.city, d.state].filter(Boolean).join(' ').toLowerCase().includes(q))) return false;
      // A listing with no state recorded predates the field and was active.
      const state = d.listing_state ?? 'active';
      if (!includePending && state !== 'active') return false;
      if (minSpread > 0) {
        const spread = d.spread_cents ?? (
          d.arv_cents != null && d.ask_cents != null && d.ask_cents > 0 ? d.arv_cents - d.ask_cents : null
        );
        // Unknown spread fails a spread floor — asserting it clears a bar we
        // cannot compute would be the permissive-default trap.
        if (spread == null || spread < minSpread) return false;
      }
      if (propertyType && d.property_type !== propertyType) return false;
      return true;
    });
  }, [deals, query, includePending, minSpread, propertyType]);

  const pins = useMemo(
    () => filtered.filter((d) => d.latitude != null && d.longitude != null) as Array<FeedDeal & { latitude: number; longitude: number }>,
    [filtered],
  );

  // Below every hook, deliberately — the react compiler is on and an early return
  // above a hook makes it bail silently rather than crash.
  if (deals === null) return <Loading label={signedIn ? 'Finding your matches…' : 'Loading deals…'} />;

  return (
    <View style={styles.wrap}>
      {/* Search + filter row (InvestorLift-style) */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="State, City, ZIP…"
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? <Pressable onPress={() => setQuery('')} hitSlop={8}><Text style={styles.clear}>✕</Text></Pressable> : null}
        </View>
        {/* Was a ⚙︎ that opened the buy-box editor — redundant (Ryan,
            2026-09-12): Account already has "Set up / Edit buy-box" in two
            places, and a gear beside a search field reads as app settings, not
            as a way to shape results. It is a real filter control now. */}
        <Pressable
          onPress={() => setFiltersOpen((v) => !v)}
          style={[styles.filterBtn, (filtersOpen || activeFilterCount > 0) && styles.filterBtnOn]}
          accessibilityLabel="Filters"
          accessibilityState={{ expanded: filtersOpen }}
        >
          <Text style={[styles.filterIcon, (filtersOpen || activeFilterCount > 0) && styles.filterIconOn]}>
            ⇅{activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}
          </Text>
        </Pressable>
      </View>

      {filtersOpen ? (
        <View style={styles.filterPanel}>
          <Text style={styles.filterLabel}>Status</Text>
          <View style={styles.filterRow}>
            {/* Pending is ON by default — the point of showing pending deals is
                that a buyer sees the market moving. "Active only" is the opt-out. */}
            <Pill label="Active + pending" active={includePending} onPress={() => setIncludePending(true)} />
            <Pill label="Active only" active={!includePending} onPress={() => setIncludePending(false)} />
          </View>

          <Text style={styles.filterLabel}>Minimum spread</Text>
          <View style={styles.filterRow}>
            {SPREAD_STEPS.map((s) => (
              <Pill
                key={s.label}
                label={s.label}
                active={minSpread === s.cents}
                onPress={() => setMinSpread(s.cents)}
              />
            ))}
          </View>

          {/* Only offered when the loaded deals actually span more than one type —
              a single-choice filter over one option is noise. */}
          {typeOptions.length > 1 ? (
            <>
              <Text style={styles.filterLabel}>Property type</Text>
              <View style={styles.filterRow}>
                <Pill label="Any" active={propertyType === null} onPress={() => setPropertyType(null)} />
                {typeOptions.map((t) => (
                  <Pill
                    key={t}
                    label={prettyType(t)}
                    active={propertyType === t}
                    onPress={() => setPropertyType(t)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {activeFilterCount > 0 ? (
            <Pressable onPress={resetFilters} hitSlop={8} style={styles.resetWrap}>
              <Text style={styles.reset}>Clear filters</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {view === 'map' ? (
        <View style={styles.mapWrap}>
          <MapView provider={PROVIDER_DEFAULT} style={StyleSheet.absoluteFill} initialRegion={regionFor(filtered)}>
            {pins.map((d) => (
              <Marker
                key={d.id}
                coordinate={{ latitude: d.latitude, longitude: d.longitude }}
                onPress={() => router.push(`/deal/${d.id}`)}
                tracksViewChanges={false}
              >
                <View style={styles.pin}>
                  <Text style={styles.pinText}>{fmtUsdShort(d.ask_cents ?? d.arv_cents)}</Text>
                </View>
              </Marker>
            ))}
          </MapView>

          {/* Toggle to list (bottom center, like InvestorLift's "List view") */}
          <View style={styles.floatWrap} pointerEvents="box-none">
            <Pressable style={styles.floatBtn} onPress={() => setView('list')}>
              <Text style={styles.floatText}>☰  List view</Text>
            </Pressable>
          </View>

          {pins.length === 0 ? (
            <View style={styles.mapNote} pointerEvents="none">
              <Text style={styles.mapNoteText}>No mapped deals in view — try List.</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.listWrap}>
          <FlatList
            style={styles.list}
            contentContainerStyle={styles.content}
            data={filtered}
            keyExtractor={(d) => d.id}
            renderItem={({ item }) => <DealCard deal={item} onPress={() => router.push(`/deal/${item.id}`)} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.blue} />}
            ListHeaderComponent={
              // Signed-out this line was a straight-up lie — a guest gets no alerts
              // at all, so there is nothing for them to be early TO. (The head start
              // itself is a backend claim we only ever reflected in copy.) Guests get
              // the honest version, which is also the reason to sign up.
              signedIn ? (
                <Text style={styles.banner}>⚡ Early access — you see new deals {EARLY_ACCESS_HEADSTART_MIN} minutes before the public.</Text>
              ) : (
                <Pressable onPress={() => openSignUp('alerts')}>
                  <Text style={styles.banner}>🔔 Create a free account to be alerted the moment a matching deal lands.</Text>
                </Pressable>
              )
            }
            ListEmptyComponent={
              <EmptyState
                title={query ? 'No matches for that search' : signedIn ? 'No matches yet' : 'No live deals right now'}
                body={
                  query ? 'Try a different city, ZIP, or clear the search.'
                  : signedIn ? 'Set up your buy-box (markets, price band, min profit) and we’ll surface deals that fit.'
                  : 'Create a free account and we’ll alert you the moment a matching deal lands.'
                }
                action={query ? undefined : (
                  <Button
                    title={signedIn ? 'Set up buy-box' : 'Create free account'}
                    onPress={signedIn ? openBuyBox : () => openSignUp('buybox')}
                    variant="accent"
                  />
                )}
              />
            }
          />
          <View style={styles.floatWrap} pointerEvents="box-none">
            <Pressable style={styles.floatBtn} onPress={() => setView('map')}>
              <Text style={styles.floatText}>📍  Map view</Text>
            </Pressable>
          </View>
        </View>
      )}

      {showBuyBoxNudge ? (
        <View style={styles.nudgeWrap} pointerEvents="box-none">
          <View style={styles.nudgeCard}>
            <Pressable onPress={() => setShowBuyBoxNudge(false)} hitSlop={8} style={styles.nudgeClose} accessibilityLabel="Dismiss">
              <Text style={styles.nudgeCloseText}>✕</Text>
            </Pressable>
            <Text style={styles.nudgeText}>
              Be notified of new deals as soon as they become available in your area — just complete your profile here.
            </Text>
            <Button
              title="Complete profile"
              variant="accent"
              onPress={() => { setShowBuyBoxNudge(false); router.push('/buybox'); }}
              style={{ marginTop: space.sm }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: space.md, height: 42,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: colors.text, fontSize: font.body },
  clear: { color: colors.textFaint, fontSize: font.body, paddingHorizontal: 4 },
  filterBtn: {
    width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  filterIcon: { fontSize: 18, color: colors.text },
  filterBtnOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  filterIconOn: { color: colors.white, fontWeight: '800' },
  filterPanel: {
    paddingHorizontal: space.md, paddingBottom: space.sm, gap: space.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterLabel: { color: colors.textDim, fontSize: font.tiny, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: space.sm },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  resetWrap: { alignSelf: 'flex-start', marginTop: space.sm },
  reset: { color: colors.blue, fontSize: font.small, fontWeight: '700' },
  error: { color: colors.danger, fontSize: font.small, paddingHorizontal: space.md, paddingBottom: space.sm },
  mapWrap: { flex: 1, overflow: 'hidden' },
  listWrap: { flex: 1 },
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, flexGrow: 1 },
  banner: {
    color: colors.lime, fontSize: font.small, fontWeight: '600', backgroundColor: 'rgba(125,226,75,0.10)',
    borderRadius: 10, padding: space.md, overflow: 'hidden', marginBottom: space.md,
  },
  pin: {
    backgroundColor: colors.blue, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 2, borderColor: colors.white,
  },
  pinText: { color: colors.white, fontSize: font.small, fontWeight: '800' },
  floatWrap: { position: 'absolute', left: 0, right: 0, bottom: space.lg, alignItems: 'center' },
  floatBtn: {
    backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: space.lg, paddingVertical: 12,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  floatText: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  mapNote: { position: 'absolute', top: space.md, left: 0, right: 0, alignItems: 'center' },
  mapNoteText: {
    color: colors.textDim, fontSize: font.small, backgroundColor: colors.surface,
    paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, overflow: 'hidden',
  },
  // Sits above the floating map/list toggle (bottom: space.lg) so the two never
  // overlap — the toggle button is ~44pt tall, this clears it with room to spare.
  nudgeWrap: { position: 'absolute', left: space.md, right: space.md, bottom: 84, alignItems: 'stretch' },
  nudgeCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: space.lg, paddingRight: space.xl,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  nudgeClose: { position: 'absolute', top: space.sm, right: space.sm, padding: 4 },
  nudgeCloseText: { color: colors.textFaint, fontSize: font.body, fontWeight: '700' },
  nudgeText: { color: colors.text, fontSize: font.small, lineHeight: 20, paddingRight: space.md },
});
