import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen, Loading, EmptyState } from '@/components/ui';
import { getSellerThread, postSellerThreadMessage } from '@/lib/api';
import type { ThreadMessage } from '@/lib/types';
import { colors, font, radius, space } from '@/lib/theme';
import { fmtDate } from '@/lib/format';

// Seller side of a buyer thread (opened from the Buyers tab). 'seller' messages
// are mine; replying pushes the buyer.
export default function SellerThread() {
  const { id } = useLocalSearchParams<{ id: string }>(); // interest_id
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [title, setTitle] = useState('Buyer');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await getSellerThread(String(id));
      setMessages(res.messages ?? []);
      setTitle(res.buyer_name || 'Buyer');
    } catch {
      setMessages([]);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !id || sending) return;
    setSending(true);
    const optimistic: ThreadMessage = { id: `tmp-${Date.now()}`, sender: 'seller', body: text, created_at: new Date().toISOString() };
    setMessages((m) => [...(m ?? []), optimistic]);
    setDraft('');
    try {
      const res = await postSellerThreadMessage(String(id), text);
      setMessages((m) => (m ?? []).map((x) => (x.id === optimistic.id ? res.message : x)));
    } catch (e) {
      setMessages((m) => (m ?? []).filter((x) => x.id !== optimistic.id));
      Alert.alert('Not sent', e instanceof Error ? e.message : 'Try again.');
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  if (messages === null) return <Loading label="Loading conversation…" />;

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.sender === 'seller';
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={[styles.bubbleText, mine && { color: colors.bg }]}>{item.body}</Text>
                <Text style={[styles.time, mine && { color: 'rgba(11,27,43,0.6)' }]}>{fmtDate(item.created_at)}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState title="No messages yet" body="Reply to open the conversation with this buyer." />
          }
        />
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Reply to the buyer…"
            placeholderTextColor={colors.textFaint}
            multiline
          />
          <Pressable onPress={send} disabled={sending || !draft.trim()} style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.5 }]}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, flexGrow: 1 },
  bubble: { maxWidth: '82%', borderRadius: radius.lg, padding: space.md, marginBottom: space.sm },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.lime },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bubbleText: { color: colors.text, fontSize: font.body, lineHeight: 20 },
  time: { color: colors.textFaint, fontSize: font.tiny, marginTop: 4 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  input: {
    flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    color: colors.text, paddingHorizontal: space.md, paddingVertical: 10, maxHeight: 120, fontSize: font.body,
  },
  sendBtn: { backgroundColor: colors.blue, borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: 12 },
  sendText: { color: colors.white, fontWeight: '700' },
});
