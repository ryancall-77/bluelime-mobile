import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { EmptyState, Loading, Button } from '@/components/ui';
import { listOffers } from '@/lib/api';
import type { OfferListItem } from '@/lib/types';
import { fmtUsd } from '@/lib/format';
import { colors, font, radius, space } from '@/lib/theme';

// Offers — the buyer's pipeline: every offer they've made + live status. Tap a
// row → the deal. Countered offers surface the seller's counter.
function statusChip(status: string): { label: string; color: string } {
  switch (status) {
    case 'submitted': return { label: 'Submitted', color: colors.blue };
    case 'countered': return { label: 'Countered', color: colors.warn };
    case 'accepted': return { label: 'Accepted', color: colors.lime };
    case 'declined': return { label: 'Declined', color: colors.danger };
    case 'withdrawn': return { label: 'Withdrawn', color: colors.textFaint };
    default: return { label: status || '—', color: colors.textFaint };
  }
}

export default function Offers() {
  const router = useRouter();
  const [offers, setOffers] = useState<OfferListItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await listOffers();
      setOffers(res.offers ?? []);
    } catch {
      setOffers((o) => o ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (offers === null) return <Loading label="Loading your offers…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={offers}
      keyExtractor={(o) => o.id}
      renderItem={({ item }) => {
        const chip = statusChip(item.status);
        return (
          <Pressable
            onPress={() => router.push(`/deal/${item.listing_id}`)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
          >
            {item.photo
              ? <Image source={{ uri: item.photo }} style={styles.thumb} />
              : <View style={[styles.thumb, styles.thumbEmpty]}><Text style={styles.thumbGlyph}>🏠</Text></View>}
            <View style={styles.mid}>
              <Text style={styles.addr} numberOfLines={1}>{item.address || 'Deal'}</Text>
              <Text style={styles.amount}>{fmtUsd(item.amount_cents)}</Text>
              {item.status === 'countered' && item.counter_cents != null ? (
                <Text style={styles.counter}>Seller countered: {fmtUsd(item.counter_cents)}</Text>
              ) : null}
            </View>
            <View style={[styles.chip, { borderColor: chip.color }]}>
              <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
            </View>
          </Pressable>
        );
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.blue} />}
      ListEmptyComponent={
        <EmptyState
          title="No offers yet"
          body="Make an offer from any deal and track its status here — submitted, countered, or accepted."
          action={<Button title="Browse deals" onPress={() => router.push('/(marketplace)')} />}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, flexGrow: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: space.md, marginBottom: space.sm,
  },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbGlyph: { fontSize: 22 },
  mid: { flex: 1 },
  addr: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  amount: { color: colors.lime, fontSize: font.body, fontWeight: '800', marginTop: 2 },
  counter: { color: colors.warn, fontSize: font.small, marginTop: 2 },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: font.small, fontWeight: '700' },
});
