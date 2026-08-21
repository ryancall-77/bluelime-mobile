import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { EmptyState, Loading, Button } from '@/components/ui';
import { SignInPrompt } from '@/components/SignInPrompt';
import { listSellerThreads } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { SellerThreadListItem } from '@/lib/types';
import { fmtDate, fmtUsd } from '@/lib/format';
import { colors, font, radius, space } from '@/lib/theme';

// Buyers — the dispo side: buyers messaging your listings. A message = a lead.
// Tap → the seller thread (reply from there). Unread = buyer messages not read.
export default function Buyers() {
  const router = useRouter();
  const { signedIn } = useAuth();
  const [threads, setThreads] = useState<SellerThreadListItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    // listSellerThreads() is an authed endpoint; a guest would just eat a 401.
    if (!signedIn) return;
    if (isRefresh) setRefreshing(true);
    try {
      const res = await listSellerThreads();
      setThreads(res.threads ?? []);
    } catch {
      setThreads((t) => t ?? []);
    } finally {
      setRefreshing(false);
    }
  }, [signedIn]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Both early returns sit below every hook — the react compiler is on, and a
  // conditional return above a hook makes it bail silently instead of crashing.
  // Guest first, so they never sit on a spinner for a fetch that never runs.
  if (!signedIn) return <SignInPrompt title="Work your buyers in one place" reason="buyers" />;
  if (threads === null) return <Loading label="Loading buyer activity…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={threads}
      keyExtractor={(t) => t.interest_id}
      renderItem={({ item }) => {
        const snippet = item.last_message
          ? `${item.last_message.sender === 'seller' ? 'You: ' : ''}${item.last_message.body}`
          : 'New inquiry';
        return (
          <Pressable
            onPress={() => router.push(`/seller-thread/${item.interest_id}`)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
          >
            {item.photo
              ? <Image source={{ uri: item.photo }} style={styles.thumb} />
              : <View style={[styles.thumb, styles.thumbEmpty]}><Text style={styles.thumbGlyph}>🏠</Text></View>}
            <View style={styles.mid}>
              <Text style={styles.who} numberOfLines={1}>{item.buyer_name}</Text>
              <Text style={styles.addr} numberOfLines={1}>{item.address || 'Deal'}</Text>
              <Text style={[styles.snippet, item.unread > 0 && styles.snippetUnread]} numberOfLines={1}>{snippet}</Text>
              {item.offer ? (
                <View style={styles.offerPill}>
                  <Text style={styles.offerPillText}>💵 {fmtUsd(item.offer.amount_cents)}{item.offer.status === 'countered' ? ' · countered' : ''}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.right}>
              {item.last_message ? <Text style={styles.time}>{fmtDate(item.last_message.created_at)}</Text> : null}
              {item.unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{item.unread}</Text></View> : null}
            </View>
          </Pressable>
        );
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.blue} />}
      ListEmptyComponent={
        <EmptyState
          title="No buyer activity yet"
          body="When buyers message or inquire on your listings, they show up here so you can work your dispo in one place."
          action={<Button title="View your listings" onPress={() => router.push('/(underwriting)/listings')} />}
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
  who: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  addr: { color: colors.textDim, fontSize: font.small, marginTop: 1 },
  snippet: { color: colors.textDim, fontSize: font.small, marginTop: 2 },
  snippetUnread: { color: colors.text, fontWeight: '600' },
  offerPill: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: 'rgba(125,226,75,0.12)', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  offerPillText: { color: colors.lime, fontSize: font.tiny, fontWeight: '700' },
  right: { alignItems: 'flex-end', gap: 6 },
  time: { color: colors.textFaint, fontSize: font.tiny },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontSize: font.tiny, fontWeight: '800' },
});
