import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen, Loading, EmptyState } from '@/components/ui';
import { SignInPrompt } from '@/components/SignInPrompt';
import { KeyboardLift } from '@/components/KeyboardLift';
import { getThread, postThreadMessage, inquire, reportContent, blockCounterparty } from '@/lib/api';
import { getProfile, getDeal } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { requireAuth } from '@/lib/gate';
import type { ThreadMessage, DealDetail } from '@/lib/types';
import { colors, font, radius, space } from '@/lib/theme';
import { fmtDate } from '@/lib/format';

// A thread is between two identified parties. The deal fetch behind the address
// banner is public, so signed out this screen would render a complete, working
// LOOKING composer over it — a guest could type a whole message to the seller
// that has no sender, no thread to land in, and no way to send. So it gates at
// entry, and send() re-checks.
export default function Messages() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { signedIn } = useAuth();
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [interestId, setInterestId] = useState<string | null>(null);
  const [deal, setDeal] = useState<Pick<DealDetail, 'address' | 'city' | 'state' | 'zip' | 'photo'> | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    // getThread() is authed; a guest would just eat a 401.
    if (!id || !signedIn) return;
    try {
      const res = await getThread(id);
      setMessages(res.messages ?? []);
      setInterestId(res.interest_id ?? null);
    } catch {
      setMessages([]);
    }
  }, [id, signedIn]);

  useEffect(() => { load(); }, [load]);

  // The thread itself doesn't carry listing details (it's keyed off buyer +
  // listing, not the other way around) — a lightweight one-time fetch of the
  // deal, same call offer/[id].tsx already makes, is enough for the banner.
  useEffect(() => {
    // getDeal() is public, but the banner only ever appears above the thread — a
    // guest gets the prompt instead, so don't spend the request.
    if (!id || !signedIn) return;
    let cancelled = false;
    getDeal(String(id)).then((res) => {
      if (cancelled || !res) return;
      const { address, city, state, zip, photo } = res.deal;
      setDeal({ address, city, state, zip, photo });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [id, signedIn]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !id || sending || blocked) return;
    // Second gate, ahead of the optimistic bubble: unreachable through the UI (the
    // guest branch replaces the composer), but a send that 401s after the bubble
    // has already appeared is exactly the "typed a message that can never send"
    // failure this screen is being fixed for.
    if (!requireAuth(signedIn, 'message')) return;
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

  // Both early returns sit below every hook — the react compiler is on, and a
  // conditional return above a hook makes it bail silently instead of crashing.
  // Guest first, so they never sit on a spinner for a fetch that never runs.
  // edges matches the signed-in branch below — this route keeps its native header,
  // so a 'top' edge would pad for a status bar the header already covers.
  if (!signedIn) {
    return <Screen edges={['left', 'right']}><SignInPrompt title="Message the seller" reason="message" /></Screen>;
  }
  if (messages === null) return <Loading label="Loading messages…" />;

  const cityState = [deal?.city, deal?.state].filter(Boolean).join(', ');
  const cityStateZip = [cityState, deal?.zip].filter(Boolean).join(' ');

  return (
    <Screen edges={['left', 'right']}>
      <Stack.Screen options={{
        title: 'Messages',
        headerRight: () => (
          <Pressable onPress={blockSeller} hitSlop={12}><Text style={styles.headerAction}>Block</Text></Pressable>
        ),
      }} />
      {deal ? (
        <View style={styles.addressBar}>
          {deal.photo
            ? <Image source={{ uri: deal.photo }} style={styles.addressThumb} />
            : <View style={[styles.addressThumb, styles.addressThumbEmpty]}><Text style={styles.addressThumbGlyph}>🏠</Text></View>}
          <View style={styles.addressText}>
            <Text style={styles.addressStreet} numberOfLines={1}>{deal.address}</Text>
            {cityStateZip ? <Text style={styles.addressCityState} numberOfLines={1}>{cityStateZip}</Text> : null}
          </View>
        </View>
      ) : null}
      {/* The address bar above is CONDITIONAL, so the old hardcoded offset of 90
          was wrong whenever it rendered. KeyboardLift measures instead. */}
      <KeyboardLift>
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
      </KeyboardLift>
    </Screen>
  );
}

const styles = StyleSheet.create({
  addressBar: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  addressThumb: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  addressThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  addressThumbGlyph: { fontSize: 18 },
  addressText: { flex: 1 },
  addressStreet: { color: colors.text, fontSize: font.small, fontWeight: '700' },
  addressCityState: { color: colors.textFaint, fontSize: font.tiny, marginTop: 1 },
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
