import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { DealCard } from '@/components/DealCard';
import { Button, EmptyState, Loading } from '@/components/ui';
import { getFeed } from '@/lib/api';
import type { FeedDeal } from '@/lib/types';
import { colors, font, space } from '@/lib/theme';
import { EARLY_ACCESS_HEADSTART_MIN } from '@/lib/config';

// The matched-deal feed — the buyer's buy-box drives what shows here (matching
// is server-side). Numbers are up front on every card.
export default function Feed() {
  const router = useRouter();
  const [deals, setDeals] = useState<FeedDeal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  if (deals === null) return <Loading label="Finding your matches…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={deals}
      keyExtractor={(d) => d.id}
      renderItem={({ item }) => (
        <DealCard deal={item} onPress={() => router.push(`/deal/${item.id}`)} />
      )}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.blue} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.banner}>
            ⚡ Early access — you see new deals {EARLY_ACCESS_HEADSTART_MIN} minutes before the public.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="No matches yet"
          body="Set up your buy-box (markets, price band, min profit) and we'll surface deals that fit — and alert you the moment new ones land."
          action={<Button title="Set up buy-box" onPress={() => router.push('/buybox')} variant="accent" />}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, flexGrow: 1 },
  header: { marginBottom: space.md },
  banner: {
    color: colors.lime, fontSize: font.small, fontWeight: '600', backgroundColor: 'rgba(125,226,75,0.10)',
    borderRadius: 10, padding: space.md, overflow: 'hidden',
  },
  error: { color: colors.danger, fontSize: font.small, marginTop: space.sm },
});
