import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { DealCard } from '@/components/DealCard';
import { EmptyState, Loading, Button } from '@/components/ui';
import { getProfile } from '@/lib/api';
import type { ListingCard } from '@/lib/types';
import { colors, space } from '@/lib/theme';

// Saved deals come from the buyer profile payload (saved[]).
export default function Watchlist() {
  const router = useRouter();
  const [saved, setSaved] = useState<ListingCard[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await getProfile();
      setSaved(res.saved ?? []);
    } catch {
      setSaved((s) => s ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (saved === null) return <Loading label="Loading your saved deals…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={saved}
      keyExtractor={(d) => d.id}
      renderItem={({ item }) => (
        <DealCard
          deal={{ id: item.id, address: item.address, city: item.city, state: item.state, ask_cents: item.ask_cents, profit_cents: item.profit_cents, photo: item.photo }}
          onPress={() => router.push(`/deal/${item.id}`)}
        />
      )}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.blue} />}
      ListEmptyComponent={
        <EmptyState
          title="Nothing saved yet"
          body="Tap the ⭐ on any deal to keep it here for quick access."
          action={<Button title="Browse deals" onPress={() => router.push('/(tabs)')} />}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, flexGrow: 1 },
});
