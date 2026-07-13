import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen, Loading, EmptyState } from '@/components/ui';
import { getThread, postThreadMessage, inquire, reportContent, blockCounterparty } from '@/lib/api';
import { getProfile } from '@/lib/api';
import type { ThreadMessage } from '@/lib/types';
import { colors, font, radius, space } from '@/lib/theme';
import { fmtDate } from '@/lib/format';

export default function Messages() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [interestId, setInterestId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await getThread(id);
      setMessages(res.messages ?? []);
      setInterestId(res.interest_id ?? null);
    } catch {
      setMessages([]);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !id || sending || blocked) return;
    setSending(true);
    const optimistic: ThreadMessage = { id: `tmp-${Date.now()}`, sender: 'buyer', body: text, created_at: new Date().toISOString() };
    setMessages((m) => [...(m ?? []), optimistic]);
    setDraft('');
    try {
      if (!interestId) {
        // No thread yet → open one with an inquiry (uses the buyer's profile identity).
        const profile = await getProfile().catch(() => null);
        await inquire(id, {
          name: profile?.profile.display_name || 'Buyer',
          email: profile?.profile.email || '',
          phone: profile?.profile.phone || undefined,
          message: text,
        });
        await load();
      } else {
        const res = await postThreadMessage(id, text);
        setMessages((m) => (m ?? []).map((x) => (x.id === optimistic.id ? res.message : x)));
      }
    } catch (e) {
      setMessages((m) => (m ?? []).filter((x) => x.id !== optimistic.id));
      Alert.alert('Not sent', e instanceof Error ? e.message : 'Try again.');
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const reportMessage = (msg: ThreadMessage) => {
    Alert.alert('Report message', 'Flag this message as objectionable or abusive?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report', style: 'destructive',
        onPress: async () => {
          try {
            await reportContent({ target_type: 'message', target_id: msg.id, reason: 'user_reported' });
            Alert.alert('Reported', 'Thanks — our team reviews reports within 24 hours.');
          } catch (e) {
            Alert.alert('Could not report', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  };

  const blockSeller = () => {
    Alert.alert('Block seller', 'You will no longer receive messages from this seller on this deal.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block', style: 'destructive',
        onPress: async () => {
          try {
            await blockCounterparty(String(id));
            setBlocked(true);
          } catch (e) {
            Alert.alert('Could not block', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  };

  if (messages === null) return <Loading label="Loading messages…" />;

  return (
    <Screen>
      <Stack.Screen options={{
        title: 'Messages',
        headerRight: () => (
          <Pressable onPress={blockSeller} hitSlop={12}><Text style={styles.headerAction}>Block</Text></Pressable>
        ),
      }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.sender === 'buyer';
            return (
              <Pressable onLongPress={() => !mine && reportMessage(item)}>
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <Text style={[styles.bubbleText, mine && { color: colors.bg }]}>{item.body}</Text>
                  <Text style={[styles.time, mine && { color: 'rgba(11,27,43,0.6)' }]}>{fmtDate(item.created_at)}</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState title="Start the conversation" body="Ask the seller about access, timeline, or terms. Long-press any received message to report it." />
          }
        />

        {blocked ? (
          <View style={styles.blockedBar}><Text style={styles.blockedText}>You blocked this seller.</Text></View>
        ) : (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Message the seller…"
              placeholderTextColor={colors.textFaint}
              multiline
            />
            <Pressable onPress={send} disabled={sending || !draft.trim()} style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.5 }]}>
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>
        )}
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
  headerAction: { color: colors.danger, fontSize: font.body, fontWeight: '600' },
  blockedBar: { padding: space.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  blockedText: { color: colors.textFaint, textAlign: 'center' },
});
