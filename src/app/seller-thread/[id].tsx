import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen, Loading, EmptyState } from '@/components/ui';
import { getSellerThread, postSellerThreadMessage, respondToOffer } from '@/lib/api';
import type { ThreadMessage, ThreadOffer } from '@/lib/types';
import { colors, font, radius, space } from '@/lib/theme';
import { fmtDate, fmtUsd } from '@/lib/format';

// Seller side of a buyer thread (opened from the Buyers tab). 'seller' messages
// are mine; replying pushes the buyer. If the buyer has a live offer, a bar at
// the top lets the seller accept / counter / decline.
export default function SellerThread() {
  const { id } = useLocalSearchParams<{ id: string }>(); // interest_id
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [offer, setOffer] = useState<ThreadOffer | null>(null);
  const [title, setTitle] = useState('Buyer');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await getSellerThread(String(id));
      setMessages(res.messages ?? []);
      setTitle(res.buyer_name || 'Buyer');
      setOffer(res.offer ?? null);
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

  const respond = async (action: 'accept' | 'counter' | 'decline', counterCents?: number) => {
    if (!id || acting) return;
    setActing(true);
    try {
      await respondToOffer(String(id), { action, ...(counterCents ? { counter_cents: counterCents } : {}) });
      await load();
      Alert.alert(
        action === 'accept' ? 'Offer accepted' : action === 'counter' ? 'Counter sent' : 'Offer declined',
        action === 'accept' ? 'The buyer has been notified.' : 'The buyer has been notified.',
      );
    } catch (e) {
      Alert.alert('Could not respond', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setActing(false);
    }
  };

  const onCounter = () => {
    // iOS supports Alert.prompt for a quick amount entry.
    if (Platform.OS === 'ios') {
      Alert.prompt('Counter offer', 'Enter your counter amount (USD).', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send counter',
          onPress: (val?: string) => {
            const n = parseInt((val || '').replace(/[^0-9]/g, ''), 10);
            if (!n || n <= 0) { Alert.alert('Enter a valid amount'); return; }
            respond('counter', n * 100);
          },
        },
      ], 'plain-text', '', 'number-pad');
    } else {
      Alert.alert('Counter offer', 'Countering is available on iOS for now.');
    }
  };

  const confirm = (action: 'accept' | 'decline') => {
    Alert.alert(
      action === 'accept' ? 'Accept this offer?' : 'Decline this offer?',
      action === 'accept'
        ? 'Accepting notifies the buyer and declines any other live offers on this deal.'
        : 'The buyer will be notified their offer was declined.',
      [{ text: 'Cancel', style: 'cancel' }, { text: action === 'accept' ? 'Accept' : 'Decline', style: action === 'accept' ? 'default' : 'destructive', onPress: () => respond(action) }],
    );
  };

  if (messages === null) return <Loading label="Loading conversation…" />;

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} style={{ flex: 1 }}>
        {offer ? (
          <View style={styles.offerBar}>
            <View style={styles.offerTop}>
              <Text style={styles.offerLabel}>{offer.status === 'countered' ? 'Countered — buyer’s offer' : 'Buyer offer'}</Text>
              <Text style={styles.offerAmount}>{fmtUsd(offer.amount_cents)}</Text>
            </View>
            <View style={styles.offerBtns}>
              <Pressable disabled={acting} onPress={() => confirm('accept')} style={[styles.oBtn, styles.accept]}><Text style={styles.acceptText}>Accept</Text></Pressable>
              <Pressable disabled={acting} onPress={onCounter} style={[styles.oBtn, styles.counter]}><Text style={styles.counterText}>Counter</Text></Pressable>
              <Pressable disabled={acting} onPress={() => confirm('decline')} style={[styles.oBtn, styles.decline]}><Text style={styles.declineText}>Decline</Text></Pressable>
            </View>
          </View>
        ) : null}

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
  offerBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, padding: space.md },
  offerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  offerLabel: { color: colors.textDim, fontSize: font.small, fontWeight: '600' },
  offerAmount: { color: colors.lime, fontSize: font.h3, fontWeight: '800' },
  offerBtns: { flexDirection: 'row', gap: space.sm },
  oBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', borderWidth: 1 },
  accept: { backgroundColor: colors.lime, borderColor: colors.lime },
  acceptText: { color: colors.bg, fontWeight: '800' },
  counter: { backgroundColor: 'transparent', borderColor: colors.blue },
  counterText: { color: colors.blue, fontWeight: '700' },
  decline: { backgroundColor: 'transparent', borderColor: colors.border },
  declineText: { color: colors.textDim, fontWeight: '700' },
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
