import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Button, EmptyState, Loading, VerifiedBadge } from '@/components/ui';
import { listUnderwritings } from '@/lib/api';
import type { UnderwritingListItem, UnderwritingStatus } from '@/lib/types';
import { fmtUsdShort } from '@/lib/format';
import { colors, radius, space, font } from '@/lib/theme';

// "My Deals" — the supply-side surface. Lists this account's underwritings with
// status + the three MAOs, and a button to run a new one. Tapping a row opens the
// full report (WebView) with the "Post to Bluelime Marketplace" action.

function statusChip(status: UnderwritingStatus): { label: string; color: string } {
  switch (status) {
    case 'processing': return { label: 'Running…', color: colors.blue };
    case 'queued': return { label: 'Queued', color: colors.warn };
    case 'failed': return { label: 'Failed', color: colors.danger };
    case 'pending_review':
    case 'under_review': return { label: 'Ready', color: colors.lime };
    case 'approved':
    case 'complete': return { label: 'Approved', color: colors.lime };
    default: return { label: String(status || '—'), color: colors.textFaint };
  }
}

function Row({ item, onPress }: { item: UnderwritingListItem; onPress: () => void }) {
  const chip = statusChip(item.status);
  const cash = item.final_cash_mao_cents ?? item.cash_mao_cents;
  const nov = item.final_novation_mao_cents ?? item.novation_mao_cents;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.rowTop}>
        <Text style={styles.addr} numberOfLines={1}>{item.property_address || 'Untitled property'}</Text>
        <View style={[styles.chip, { borderColor: chip.color }]}>
          <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
        </View>
      </View>
      <View style={styles.maos}>
        <View style={styles.mao}><Text style={styles.maoLbl}>ARV</Text><Text style={styles.maoVal}>{fmtUsdShort(item.arv_cents)}</Text></View>
        <View style={styles.mao}><Text style={styles.maoLbl}>Cash MAO</Text><Text style={[styles.maoVal, { color: colors.lime }]}>{fmtUsdShort(cash)}</Text></View>
        <View style={styles.mao}><Text style={styles.maoLbl}>Novation</Text><Text style={styles.maoVal}>{fmtUsdShort(nov)}</Text></View>
      </View>
      {item.buyer_share_enabled ? (
        <View style={styles.posted}><VerifiedBadge small /><Text style={styles.postedText}>Posted to Marketplace</Text></View>
      ) : null}
    </Pressable>
  );
}

export default function MyDeals() {
  const router = useRouter();
  const [items, setItems] = useState<UnderwritingListItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!items) return items;
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => (it.property_address ?? '').toLowerCase().includes(q));
  }, [items, query]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await listUnderwritings();
      setItems(Array.isArray(res) ? res : []);
    } catch {
      setItems((s) => s ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Refresh on focus so a just-submitted deal (and status changes) show up.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (items === null) return <Loading label="Loading your underwritings…" />;

  return (
    <View style={styles.wrap}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.content}
        data={filtered ?? []}
        keyExtractor={(d) => d.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          items && items.length > 0 ? (
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search by address…"
              placeholderTextColor={colors.textFaint}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Row
            item={item}
            onPress={() =>
              router.push({
                pathname: '/underwriting/[id]',
                params: {
                  id: item.id,
                  token: item.access_token ?? '',
                  address: item.property_address ?? '',
                  status: item.status,
                  posted: item.buyer_share_enabled ? '1' : '0',
                },
              })
            }
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.blue} />}
        ListEmptyComponent={
          query.trim() && items && items.length > 0 ? (
            <EmptyState title="No matches" body={`No underwritings match “${query.trim()}”.`} />
          ) : (
            <EmptyState
              title="No underwritings yet"
              body="Run your first deal analysis — enter an address and we'll pull ARV, comps, rehab, and your max offers."
              action={<Button title="New Underwriting" onPress={() => router.push('/underwriting/new')} />}
            />
          )
        }
      />
      <View style={styles.fabWrap} pointerEvents="box-none">
        <Button title="＋ New Underwriting" onPress={() => router.push('/underwriting/new')} style={styles.fab} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: 96, flexGrow: 1 },
  search: {
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10,
    color: colors.text, fontSize: font.body, marginBottom: space.md,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: space.lg, marginBottom: space.md,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  addr: { flex: 1, color: colors.text, fontSize: font.h3, fontWeight: '700' },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontSize: font.small, fontWeight: '700' },
  maos: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
  mao: { flex: 1 },
  maoLbl: { color: colors.textFaint, fontSize: font.small, marginBottom: 2 },
  maoVal: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  posted: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md },
  postedText: { color: colors.lime, fontSize: font.small, fontWeight: '600' },
  fabWrap: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg },
  fab: {},
});
