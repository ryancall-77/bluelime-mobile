import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { DealCard } from '@/components/DealCard';
import { EmptyState, Loading, Button } from '@/components/ui';
import { SignInPrompt } from '@/components/SignInPrompt';
import { getProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ListingCard } from '@/lib/types';
import { colors, space } from '@/lib/theme';

// Saved deals come from the buyer profile payload (saved[]).
//
// Signed out this tab is a sign-in prompt, not "Nothing saved yet" — a guest has
// no favorites by definition, and the real empty state would read as a truthful
// answer to a question they never got to ask.
export default function Watchlist() {
  const router = useRouter();
  const { signedIn } = useAuth();
  const [saved, setSaved] = useState<ListingCard[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    // getProfile() is an authed endpoint; a guest would just eat a 401.
    if (!signedIn) return;
    if (isRefresh) setRefreshing(true);
    try {
      const res = await getProfile();
      setSaved(res.saved ?? []);
    } catch {
      setSaved((s) => s ?? []);
    } finally {
      setRefreshing(false);
    }
  }, [signedIn]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Both early returns sit below every hook — the react compiler is on, and a
  // conditional return above a hook makes it bail silently instead of crashing.
  // Guest first, so they never sit on a spinner for a fetch that never runs.
  if (!signedIn) return <SignInPrompt title="Save the deals you like" reason="save" />;
  if (saved === null) return <Loading label="Loading your saved deals…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={saved}
      keyExtractor={(d) => d.id}
      renderItem={({ item }) => (
        // Pass the whole card through — cherry-picking fields here is what left
        // ARV/Rehab (and the bed/bath/sqft line) blank on this screen.
        <DealCard deal={item} onPress={() => router.push(`/deal/${item.id}`)} />
      )}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.blue} />}
      ListEmptyComponent={
        <EmptyState
          title="Nothing saved yet"
          body="Tap the ⭐ on any deal to keep it here for quick access."
          action={<Button title="Browse deals" onPress={() => router.push('/(marketplace)')} />}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, flexGrow: 1 },
});
