import React, { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Card, Button, Field, Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getProfile, deleteAccount, patchProfile, putBuyBox } from '@/lib/api';
import type { BuyerProfile, BuyBox } from '@/lib/types';
import { colors, font, radius, space } from '@/lib/theme';
import { SUPPORT_EMAIL, TERMS_URL, PRIVACY_URL } from '@/lib/config';
import { fmtUsd } from '@/lib/format';
import { BUILD_TAG } from '@/lib/buildTag';

export default function Account() {
  const router = useRouter();
  const { email, signedIn, signOut } = useAuth();
  const [profile, setProfile] = useState<BuyerProfile | null>(null);
  const [box, setBox] = useState<BuyBox | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pushOn, setPushOn] = useState(true); // mirrors buy-box alert_mode (the server-side switch)
  const [pushSaving, setPushSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Editable profile fields (name / phone) — persisted via patchProfile.
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const load = useCallback(async () => {
    // getProfile() is an authed endpoint; a guest would just eat a 401.
    if (!signedIn) return;
    try {
      const res = await getProfile();
      setProfile(res.profile);
      setBox(res.buy_box);
      setPushOn((res.buy_box?.alert_mode ?? 'instant') !== 'off');
      setName(res.profile?.display_name ?? '');
      setPhone(res.profile?.phone ?? '');
    } catch {
      /* keep prior */
    } finally {
      setLoaded(true);
    }
  }, [signedIn]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Persist name/phone. Trimmed; empty string clears the field server-side.
  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await patchProfile({ display_name: name.trim(), phone: phone.trim() });
      setProfile((p) => (p ? { ...p, display_name: name.trim() || null, phone: phone.trim() || null } : p));
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setSavingProfile(false);
    }
  };

  // The "Deal alerts" switch is the buy-box alert_mode (instant ↔ off), persisted
  // server-side. Optimistic; reverts on failure. No buy-box → route to set one up.
  const toggleAlerts = async (on: boolean) => {
    if (!box) {
      router.push('/buybox');
      return;
    }
    const prev = pushOn;
    setPushOn(on);
    setPushSaving(true);
    try {
      const next: BuyBox = { ...box, alert_mode: on ? 'instant' : 'off' };
      await putBuyBox(next);
      setBox(next);
    } catch (e) {
      setPushOn(prev); // revert
      Alert.alert('Could not update alerts', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setPushSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your RealtyZoom account, buy-box, saved deals, offers, and messages. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              await signOut();
            } catch (e) {
              Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again later.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  // The GUEST variant. It sits below every hook — the react compiler is on, and a
  // conditional return above a hook makes it bail silently instead of crashing —
  // and above the `loaded` check, because load() no-ops for a guest and would
  // otherwise strand them on a spinner forever.
  //
  // Two things are load-bearing here. Nothing account-shaped is rendered: no
  // "Signed in as", no Sign out, no Delete account — all three are meaningless or
  // actively alarming without a session. And the Support & legal card plus the
  // build tag are carried over UNCHANGED, because App Review reaches this screen
  // without signing in and those links are the standing evidence that support,
  // the EULA and the privacy policy are reachable to every user.
  if (!signedIn) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card style={{ marginBottom: space.lg }}>
          <Text style={styles.value}>Create a free account</Text>
          <Text style={styles.sub}>
            Browsing is open to everyone. An account is what lets you save deals, set a buy-box
            and get alerted the moment a matching deal lands, make offers, message sellers, and
            run your own underwriting.
          </Text>
          <Button
            title="Create free account"
            variant="accent"
            onPress={() => router.push({ pathname: '/(auth)/signup', params: { reason: 'account' } })}
            style={{ marginTop: space.lg }}
          />
          <Button
            title="Log in"
            variant="outline"
            onPress={() => router.push({ pathname: '/(auth)/login', params: { reason: 'account' } })}
            style={{ marginTop: space.md }}
          />
        </Card>

        <SectionTitle>Support & legal</SectionTitle>
        <Card style={{ marginBottom: space.lg }}>
          <LinkRow label="Contact support" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
          <LinkRow label="Terms & EULA" onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} />
          <LinkRow label="Privacy Policy" onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} last />
        </Card>

        <Text style={styles.footer}>RealtyZoom Deals · buyer app</Text>
        <Text style={styles.footer}>{BUILD_TAG}</Text>
      </ScrollView>
    );
  }

  if (!loaded) return <Loading />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={{ marginBottom: space.lg }}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.value}>{profile?.email ?? email ?? '—'}</Text>
      </Card>

      <SectionTitle>Profile</SectionTitle>
      <Card style={{ marginBottom: space.lg }}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
        <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="(555) 123-4567" keyboardType="phone-pad" />
        <Text style={styles.note}>Sellers see your name on offers and messages. Phone is used for deal-alert texts.</Text>
        <Button title="Save profile" onPress={saveProfile} loading={savingProfile} variant="outline" style={{ marginTop: space.md }} />
      </Card>

      <SectionTitle>Buy-box</SectionTitle>
      <Card style={{ marginBottom: space.lg }}>
        {box ? (
          <>
            <Row k="Markets" v={box.markets.length ? box.markets.join(', ') : 'Any'} />
            <Row k="Price" v={`${fmtUsd(box.price_min_cents)} – ${fmtUsd(box.price_max_cents)}`} />
            <Row k="Min profit" v={box.min_profit_cents ? fmtUsd(box.min_profit_cents) : (box.min_profit_pct ? `${box.min_profit_pct}% of ARV` : 'Platform default')} />
            <Row k="Types" v={box.property_types.length ? `${box.property_types.length} selected` : 'Any'} />
          </>
        ) : (
          <Text style={styles.sub}>No buy-box yet — set one up to get matched deals + alerts.</Text>
        )}
        <Button title={box ? 'Edit buy-box' : 'Set up buy-box'} onPress={() => router.push('/buybox')} variant="outline" style={{ marginTop: space.md }} />
      </Card>

      <SectionTitle>Notifications</SectionTitle>
      <Card style={{ marginBottom: space.lg }}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.value}>Deal alerts</Text>
            <Text style={styles.sub}>Push me when a new matched deal lands (60-min head start).</Text>
          </View>
          <Switch
            value={pushOn}
            onValueChange={toggleAlerts}
            disabled={pushSaving}
            trackColor={{ true: colors.blue, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>
        <Text style={styles.note}>
          {box
            ? 'Turns your buy-box alerts on (instant) or off. For a daily digest instead, choose the mode in your buy-box.'
            : 'Set up a buy-box first — then this controls whether matched deals push to your phone.'}
        </Text>
      </Card>

      <SectionTitle>Support & legal</SectionTitle>
      <Card style={{ marginBottom: space.lg }}>
        <LinkRow label="Contact support" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
        <LinkRow label="Terms & EULA" onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} />
        <LinkRow label="Privacy Policy" onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} last />
      </Card>

      <Button title="Sign out" onPress={signOut} variant="outline" style={{ marginBottom: space.lg }} />
      <Button title="Delete account" onPress={confirmDelete} loading={deleting} variant="danger" />
      <Text style={styles.footer}>RealtyZoom Deals · buyer app</Text>
      <Text style={styles.footer}>{BUILD_TAG}</Text>
    </ScrollView>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowK}>{k}</Text>
      <Text style={styles.rowV} numberOfLines={1}>{v}</Text>
    </View>
  );
}
function LinkRow({ label, onPress, last }: { label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable style={[styles.linkRow, !last && styles.linkBorder]} onPress={onPress}>
      <Text style={styles.linkLabel}>{label}</Text>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  label: { color: colors.textFaint, fontSize: font.tiny, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { color: colors.text, fontSize: font.body, fontWeight: '700', marginTop: 2 },
  sub: { color: colors.textDim, fontSize: font.small, marginTop: 4 },
  note: { color: colors.textFaint, fontSize: font.tiny, marginTop: space.md },
  section: { color: colors.textDim, fontSize: font.small, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: space.sm, marginLeft: space.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: space.md },
  rowK: { color: colors.textDim, fontSize: font.small },
  rowV: { color: colors.text, fontSize: font.small, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md },
  linkBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  linkLabel: { color: colors.text, fontSize: font.body },
  chev: { color: colors.textFaint, fontSize: 22 },
  footer: { color: colors.textFaint, fontSize: font.tiny, textAlign: 'center', marginTop: space.xl },
});
