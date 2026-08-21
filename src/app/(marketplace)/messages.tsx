import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { EmptyState, Loading, Button } from '@/components/ui';
import { SignInPrompt } from '@/components/SignInPrompt';
import { listThreads } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ThreadListItem } from '@/lib/types';
import { fmtDate } from '@/lib/format';
import { colors, font, radius, space } from '@/lib/theme';

// Messages — the buyer's inbox: one row per deal they're talking to a seller
// about. Tap → the thread (per-listing). Unread = seller messages not yet read.
export default function Messages() {
  const router = useRouter();
  const { signedIn } = useAuth();
  const [threads, setThreads] = useState<ThreadListItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    // listThreads() is an authed endpoint; a guest would just eat a 401.
    if (!signedIn) return;
    if (isRefresh) setRefreshing(true);
    try {
      const res = await listThreads();
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
  if (!signedIn) return <SignInPrompt title="Message sellers directly" reason="message" />;
  if (threads === null) return <Loading label="Loading your messages…" />;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={threads}
      keyExtractor={(t) => t.interest_id}
      renderItem={({ item }) => {
        const snippet = item.last_message
          ? `${item.last_message.sender === 'buyer' ? 'You: ' : ''}${item.last_message.body}`
          : 'Inquiry sent';
        return (
          <Pressable
            onPress={() => router.push(`/messages/${item.listing_id}`)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
          >
            {item.photo
              ? <Image source={{ uri: item.photo }} style={styles.thumb} />
              : <View style={[styles.thumb, styles.thumbEmpty]}><Text style={styles.thumbGlyph}>🏠</Text></View>}
            <View style={styles.mid}>
              <Text style={styles.addr} numberOfLines={1}>{item.address || 'Deal'}</Text>
              <Text style={[styles.snippet, item.unread > 0 && styles.snippetUnread]} numberOfLines={1}>{snippet}</Text>
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
          title="No messages yet"
          body="Message a seller from any deal to start a conversation — it’ll show up here."
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
  snippet: { color: colors.textDim, fontSize: font.small, marginTop: 2 },
  snippetUnread: { color: colors.text, fontWeight: '600' },
  right: { alignItems: 'flex-end', gap: 6 },
  time: { color: colors.textFaint, fontSize: font.tiny },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontSize: font.tiny, fontWeight: '800' },
});
