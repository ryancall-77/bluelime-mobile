import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Button, EmptyState, Loading, VerifiedBadge } from '@/components/ui';
import { listUnderwritings } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { UnderwritingListItem } from '@/lib/types';
import { fmtUsdShort } from '@/lib/format';
import { colors, radius, space, font } from '@/lib/theme';

// Listings — the deals YOU'VE published to the RealtyZoom Marketplace (a filtered
// view of your own underwritings where buyer sharing is enabled — /api/underwriting/list
// scopes by org, not creator, so the creator filter happens here; "My Deals"/Reports
// intentionally stays org-wide). Tap to open the report + re-share the buyer link.
export default function Listings() {
  const router = useRouter();
  const { session } = useAuth();
  const [items, setItems] = useState<UnderwritingListItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await listUnderwritings();
      const uid = session?.user?.id;
      const posted = (Array.isArray(res) ? res : []).filter((u) => u.buyer_share_enabled && u.created_by === uid);
      setItems(posted);
    } catch {
      setItems((s) => s ?? []);
    } finally {
      setRefreshing(false);
    }
  }, [session?.user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (items === null) return <Loading label="Loading your listings…" />;

  return (
    <View style={styles.wrap}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => {
          const cash = item.final_cash_mao_cents ?? item.cash_mao_cents;
          return (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/underwriting/[id]',
                  params: {
                    id: item.id, token: item.access_token ?? '',
                    address: item.property_address ?? '', status: item.status, posted: '1',
                  },
                })
              }
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.rowTop}>
                <Text style={styles.addr} numberOfLines={1}>{item.property_address || 'Untitled property'}</Text>
                <View style={styles.live}><VerifiedBadge small /><Text style={styles.liveText}>Live</Text></View>
              </View>
              <View style={styles.maos}>
                <View style={styles.mao}><Text style={styles.maoLbl}>ARV</Text><Text style={styles.maoVal}>{fmtUsdShort(item.arv_cents)}</Text></View>
                <View style={styles.mao}><Text style={styles.maoLbl}>Cash MAO</Text><Text style={[styles.maoVal, { color: colors.lime }]}>{fmtUsdShort(cash)}</Text></View>
                <View style={styles.mao}><Text style={styles.maoLbl}>Novation</Text><Text style={styles.maoVal}>{fmtUsdShort(item.final_novation_mao_cents ?? item.novation_mao_cents)}</Text></View>
              </View>
            </Pressable>
          );
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.blue} />}
        ListEmptyComponent={
          <EmptyState
            title="No live listings yet"
            body="Run an underwriting, then tap “Post to RealtyZoom Marketplace” to publish it and get a buyer link to send out. Your published deals show here."
            action={<Button title="Run an underwriting" onPress={() => router.push('/(underwriting)/submit')} />}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: space.lg, marginBottom: space.md,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  addr: { flex: 1, color: colors.text, fontSize: font.h3, fontWeight: '700' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveText: { color: colors.lime, fontSize: font.small, fontWeight: '700' },
  maos: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
  mao: { flex: 1 },
  maoLbl: { color: colors.textFaint, fontSize: font.small, marginBottom: 2 },
  maoVal: { color: colors.text, fontSize: font.body, fontWeight: '700' },
});
