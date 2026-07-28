import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { useRouter, useFocusEffect } from 'expo-router';
import { DealCard } from '@/components/DealCard';
import { Button, EmptyState, Loading } from '@/components/ui';
import { getFeed } from '@/lib/api';
import type { FeedDeal } from '@/lib/types';
import { fmtUsdShort } from '@/lib/format';
import { colors, font, radius, space } from '@/lib/theme';
import { EARLY_ACCESS_HEADSTART_MIN } from '@/lib/config';

// Continental-US fallback when no deal has coordinates yet.
const US_REGION: Region = { latitude: 39.5, longitude: -98.35, latitudeDelta: 32, longitudeDelta: 40 };

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
  const [deals, setDeals] = useState<FeedDeal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [query, setQuery] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const res = await getFeed();
      setDeals(res.deals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load deals');
      setDeals((d) => d ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !deals) return deals ?? [];
    return deals.filter((d) =>
      [d.address, d.city, d.state].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [deals, query]);

  const pins = useMemo(
    () => filtered.filter((d) => d.latitude != null && d.longitude != null) as Array<FeedDeal & { latitude: number; longitude: number }>,
    [filtered],
  );

  if (deals === null) return <Loading label="Finding your matches…" />;

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
        <Pressable onPress={() => router.push('/buybox')} style={styles.filterBtn} accessibilityLabel="Filters">
          <Text style={styles.filterIcon}>⚙︎</Text>
        </Pressable>
      </View>

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
              <Text style={styles.banner}>⚡ Early access — you see new deals {EARLY_ACCESS_HEADSTART_MIN} minutes before the public.</Text>
            }
            ListEmptyComponent={
              <EmptyState
                title={query ? 'No matches for that search' : 'No matches yet'}
                body={query ? 'Try a different city, ZIP, or clear the search.' : 'Set up your buy-box (markets, price band, min profit) and we’ll surface deals that fit.'}
                action={query ? undefined : <Button title="Set up buy-box" onPress={() => router.push('/buybox')} variant="accent" />}
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
});
