import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { EmptyState, Loading, Button } from '@/components/ui';
import { listOffers } from '@/lib/api';
import type { OfferListItem } from '@/lib/types';
import { fmtUsd } from '@/lib/format';
import { colors, font, radius, space } from '@/lib/theme';

// Offers — the buyer's pipeline: every offer they've made + live status. Tap a
// row → the deal. Countered offers surface the seller's counter. Tapping
// "Terms" expands the seller's required terms + the buyer's own submitted
// terms in place, without leaving the list (Ryan, 2026-08-06).
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

// Mirrors offer/[id].tsx's own parsing of the same marketing.offer_terms field.
function splitTermLines(raw: string | null): string[] {
  return (raw ?? '')
    .split(/\r?\n/)
    .map((t) => t.replace(/^[•\-*]\s+/, '').trim())
    .filter(Boolean);
}

export default function Offers() {
  const router = useRouter();
  const [offers, setOffers] = useState<OfferListItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (offers === null) return <Loading label="Loading your offers…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={offers}
      keyExtractor={(o) => o.id}
      renderItem={({ item }) => {
        const chip = statusChip(item.status);
        const requiredTerms = splitTermLines(item.offer_terms);
        const hasTerms = requiredTerms.length > 0 || !!item.note;
        const isOpen = expanded.has(item.id);
        return (
          <View style={styles.card}>
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
                {hasTerms ? (
                  <Pressable onPress={() => toggleExpanded(item.id)} hitSlop={8} style={styles.termsToggle}>
                    <Text style={styles.termsToggleText}>{isOpen ? 'Hide terms ▴' : 'View terms ▾'}</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={[styles.chip, { borderColor: chip.color }]}>
                <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
              </View>
            </Pressable>
            {isOpen ? (
              <View style={styles.termsBox}>
                {requiredTerms.length > 0 ? (
                  <View style={styles.termsSection}>
                    <Text style={styles.termsLabel}>Seller&apos;s required terms</Text>
                    {requiredTerms.map((t, i) => (
                      <Text key={i} style={styles.termsLine}>• {t}</Text>
                    ))}
                  </View>
                ) : null}
                {item.note ? (
                  <View style={styles.termsSection}>
                    <Text style={styles.termsLabel}>Your terms</Text>
                    <Text style={styles.termsLine}>{item.note}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
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
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    marginBottom: space.sm, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbGlyph: { fontSize: 22 },
  mid: { flex: 1 },
  addr: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  amount: { color: colors.lime, fontSize: font.body, fontWeight: '800', marginTop: 2 },
  counter: { color: colors.warn, fontSize: font.small, marginTop: 2 },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: font.small, fontWeight: '700' },
  termsToggle: { marginTop: 4, alignSelf: 'flex-start' },
  termsToggleText: { color: colors.blue, fontSize: font.small, fontWeight: '700' },
  termsBox: {
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceAlt,
    padding: space.md, gap: space.sm,
  },
  termsSection: { gap: 2 },
  termsLabel: { color: colors.textDim, fontSize: font.tiny, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  termsLine: { color: colors.text, fontSize: font.small, lineHeight: 19 },
});
