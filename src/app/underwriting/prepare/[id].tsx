import React, { useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  Share, StyleSheet, Text, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button, Field } from '@/components/ui';
import { prepareAndPublish } from '@/lib/api';
import { uploadListingPhoto } from '@/lib/upload';
import { colors, radius, space, font } from '@/lib/theme';

// Prepare Listing — the "🚀 Push to Marketplace" flow. Upload photos and fill in
// the property details (mirrors the website prepare page), then publish and hand
// back the public buyer link to share. Showings / Offer / Agent instructions are
// the three titled sections that render on the buyer property-details page.
export default function PrepareListing() {
  const params = useLocalSearchParams<{ id: string; address?: string }>();
  const id = String(params.id);
  const router = useRouter();

  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [conditionNotes, setConditionNotes] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [offerTerms, setOfferTerms] = useState('');
  const [showings, setShowings] = useState('');
  const [offer, setOffer] = useState('');
  const [agentInstructions, setAgentInstructions] = useState('');
  const [contactUrl, setContactUrl] = useState('');
  const [contactLabel, setContactLabel] = useState('Make an Offer');

  const [busy, setBusy] = useState(false);

  const offerPriceCents = (() => {
    const n = parseFloat(offerPrice.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  })();
  const canSubmit = offerPriceCents != null && !busy && !uploading;

  const pickPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add listing photos.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (res.canceled) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const asset of res.assets) {
        try {
          const url = await uploadListingPhoto(
            id,
            asset.uri,
            asset.fileName ?? `photo-${Date.now()}.jpg`,
            asset.mimeType ?? 'image/jpeg',
          );
          urls.push(url);
        } catch (e) {
          Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload a photo.');
        }
      }
      if (urls.length) setPhotos((prev) => [...prev, ...urls]);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (url: string) => setPhotos((prev) => prev.filter((u) => u !== url));

  const submit = async () => {
    if (offerPriceCents == null) {
      Alert.alert('Offer price required', 'Enter a valid offer price to publish.');
      return;
    }
    setBusy(true);
    try {
      const res = await prepareAndPublish(id, {
        photo_urls: photos,
        condition_notes: conditionNotes.trim(),
        offer_price_cents: offerPriceCents,
        offer_terms: offerTerms.trim(),
        showings: showings.trim(),
        offer: offer.trim(),
        agent_instructions: agentInstructions.trim(),
        contact_url: contactUrl.trim(),
        contact_label: contactLabel.trim() || 'Make an Offer',
      });
      try {
        await Share.share({
          message: `${params.address ? params.address + ' — ' : ''}View this deal on Bluelime: ${res.buyer_url}`,
          url: res.buyer_url,
        });
      } catch { /* user cancelled the share sheet */ }
      Alert.alert('Live on the Marketplace', 'Your listing is published. The buyer link is ready to share.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Could not publish', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {params.address ? <Text style={styles.addr}>{params.address}</Text> : null}

        {/* Photos */}
        <Text style={styles.section}>Photos</Text>
        <Text style={styles.hint}>Optional — if you add none, the report uses the original report photos.</Text>
        <View style={styles.photoGrid}>
          {photos.map((url) => (
            <View key={url} style={styles.thumbWrap}>
              <Image source={{ uri: url }} style={styles.thumb} />
              <Pressable style={styles.thumbX} onPress={() => removePhoto(url)} hitSlop={8}>
                <Text style={styles.thumbXText}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addPhoto} onPress={pickPhotos} disabled={uploading}>
            <Text style={styles.addPhotoText}>{uploading ? 'Uploading…' : '＋ Add'}</Text>
          </Pressable>
        </View>

        {/* Property details */}
        <Text style={styles.section}>Property details</Text>
        <Field
          label="Condition notes"
          value={conditionNotes}
          onChangeText={setConditionNotes}
          placeholder="Describe the property's condition for buyers…"
          multiline
          style={styles.multiline}
        />
        <Field
          label="Offer price *"
          value={offerPrice}
          onChangeText={setOfferPrice}
          placeholder="250000"
          keyboardType="numeric"
        />
        <Field
          label="Offer terms"
          value={offerTerms}
          onChangeText={setOfferTerms}
          placeholder="Cash, close in 14 days, as-is…"
          multiline
          style={styles.multiline}
        />

        {/* The three titled sections that render on the buyer property page */}
        <Text style={styles.section}>Showings, offer & agent instructions</Text>
        <Field
          label="Showings"
          value={showings}
          onChangeText={setShowings}
          placeholder="How and when the property can be shown…"
          multiline
          style={styles.multiline}
        />
        <Field
          label="Offer"
          value={offer}
          onChangeText={setOffer}
          placeholder="How to submit an offer, deadline, EMD, required docs…"
          multiline
          style={styles.multiline}
        />
        <Field
          label="Agent instructions"
          value={agentInstructions}
          onChangeText={setAgentInstructions}
          placeholder="Commission, cooperation terms, and instructions for agents…"
          multiline
          style={styles.multiline}
        />

        {/* Call to action */}
        <Text style={styles.section}>Call to action</Text>
        <Field
          label="Contact URL"
          value={contactUrl}
          onChangeText={setContactUrl}
          placeholder="https://…  (where the CTA button sends buyers)"
          autoCapitalize="none"
          keyboardType="url"
        />
        <Field
          label="Contact button label"
          value={contactLabel}
          onChangeText={setContactLabel}
          placeholder="Make an Offer"
        />

        <Button
          title="🚀 Publish to Marketplace"
          onPress={submit}
          loading={busy}
          disabled={!canSubmit}
          style={{ marginTop: space.md }}
        />
        <Text style={styles.footHint}>An offer price is required. Publishing gives you a buyer link to share.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const THUMB = 84;
const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  addr: { color: colors.text, fontSize: font.h3, fontWeight: '800', marginBottom: space.md },
  section: { color: colors.text, fontSize: font.body, fontWeight: '800', marginTop: space.md, marginBottom: space.xs },
  hint: { color: colors.textFaint, fontSize: font.small, marginBottom: space.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  thumbWrap: { width: THUMB, height: THUMB },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  thumbX: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  thumbXText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  addPhoto: {
    width: THUMB, height: THUMB, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    borderStyle: 'dashed', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  addPhotoText: { color: colors.textDim, fontSize: font.small, fontWeight: '700' },
  multiline: { minHeight: 76, textAlignVertical: 'top', paddingTop: 10 },
  footHint: { color: colors.textFaint, fontSize: font.small, textAlign: 'center', marginTop: space.sm },
});
