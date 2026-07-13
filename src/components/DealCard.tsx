// A single matched deal in the feed / watchlist — numbers up front (verified
// ARV, rehab, gross profit) with the photo, per the product spec.

import React from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '@/lib/theme';
import { fmtUsd, fmtUsdShort, fmtBedBath, fmtCityState } from '@/lib/format';
import { VerifiedBadge } from './ui';
import type { FeedDeal, ListingCard } from '@/lib/types';

type CardDeal = Partial<FeedDeal> & Partial<ListingCard> & { id: string };

export function DealCard({ deal, onPress }: { deal: CardDeal; onPress: () => void }) {
  const profit = deal.profit_cents ?? null;
  const profitPositive = profit != null && profit > 0;
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]} onPress={onPress}>
      <View style={styles.imageWrap}>
        {deal.photo ? (
          <Image source={{ uri: deal.photo }} style={styles.image} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>No photo</Text>
          </View>
        )}
        <View style={styles.badgeOnImage}>
          <VerifiedBadge small />
        </View>
        {profit != null && (
          <View style={[styles.profitBadge, { backgroundColor: profitPositive ? colors.lime : colors.danger }]}>
            <Text style={[styles.profitBadgeText, { color: profitPositive ? colors.bg : colors.white }]}>
              {fmtUsdShort(profit)} profit
            </Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.address} numberOfLines={1}>{deal.address ?? 'Address pending'}</Text>
        <Text style={styles.location} numberOfLines={1}>{fmtCityState(deal.city ?? null, deal.state ?? null)}</Text>

        {(deal.beds != null || deal.baths != null || deal.sqft != null) && (
          <Text style={styles.specs}>{fmtBedBath(deal.beds ?? null, deal.baths ?? null, deal.sqft ?? null)}</Text>
        )}

        <View style={styles.numbersRow}>
          <Metric label="Ask" value={fmtUsd(deal.ask_cents)} />
          <Metric label="ARV" value={fmtUsd(deal.arv_cents ?? null)} />
          <Metric label="Rehab" value={fmtUsd(deal.rehab_cents ?? null)} />
        </View>
      </View>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    marginBottom: space.lg, overflow: 'hidden',
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 190, backgroundColor: colors.surfaceAlt },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: colors.textFaint, fontSize: font.small },
  badgeOnImage: { position: 'absolute', top: space.sm, left: space.sm },
  profitBadge: {
    position: 'absolute', bottom: space.sm, right: space.sm, borderRadius: radius.pill,
    paddingHorizontal: space.md, paddingVertical: 5,
  },
  profitBadgeText: { fontWeight: '800', fontSize: font.small },
  body: { padding: space.lg },
  address: { color: colors.text, fontSize: font.h3, fontWeight: '700' },
  location: { color: colors.textDim, fontSize: font.small, marginTop: 2 },
  specs: { color: colors.textFaint, fontSize: font.small, marginTop: space.xs },
  numbersRow: { flexDirection: 'row', marginTop: space.md, gap: space.lg },
  metric: {},
  metricLabel: { color: colors.textFaint, fontSize: font.tiny, textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { color: colors.text, fontSize: font.body, fontWeight: '700', marginTop: 2 },
});
