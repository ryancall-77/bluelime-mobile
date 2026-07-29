import React, { useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  Share, StyleSheet, Text, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button, Field, Pill } from '@/components/ui';
import { prepareAndPublish } from '@/lib/api';
import { uploadListingPhoto } from '@/lib/upload';
import { colors, radius, space, font } from '@/lib/theme';

// Deal types offered on the prepare form (mirrors the website's select).
const DEAL_TYPES = [
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'novation', label: 'Novation' },
  { value: 'subject_to', label: 'Subject-to' },
  { value: 'creative', label: 'Creative' },
];

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

  // Listing copy — full parity with the rz-crm marketing payload and the website
  // prepare page. (The CRM's property-spec block is intentionally omitted: it's a
  // gap-filler for listings with no analysis, and the verified analysis wins here.)
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [highlights, setHighlights] = useState('');
  const [dealType, setDealType] = useState('');
  const [conditionNotes, setConditionNotes] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [offerTerms, setOfferTerms] = useState('');
  const [showings, setShowings] = useState('');
  const [offer, setOffer] = useState('');
  const [agentInstructions, setAgentInstructions] = useState('');
  const [contactUrl, setContactUrl] = useState('');
  const [contactLabel, setContactLabel] = useState('Make an Offer');
  const [contactTextLine, setContactTextLine] = useState('');

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
        headline: headline.trim(),
        description: description.trim(),
        highlights: highlights.trim(),
        deal_type: dealType,
        contact_url: contactUrl.trim(),
        contact_label: contactLabel.trim() || 'Make an Offer',
        contact_text_line: contactTextLine.trim(),
      });
      const shareUrl = res.listing_url || res.buyer_url;
      try {
        await Share.share({
          message: `${params.address ? params.address + ' — ' : ''}View this deal on Bluelime: ${shareUrl}`,
          url: shareUrl,
        });
      } catch { /* user cancelled the share sheet */ }
      const listed = !!res.listing_url;
      Alert.alert(
        listed ? 'Live on the Marketplace' : 'Buyer link published',
        listed
          ? 'Your deal is listed on the Marketplace and matching buyers have been alerted.'
          : res.listing?.error
            ? `The buyer link is live, but the Marketplace listing failed: ${res.listing.error}`
            : 'The buyer link is live. Add an offer price to list it on the Marketplace.',
        [{ text: 'Done', onPress: () => router.back() }],
      );
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

        {/* Listing copy — rz-crm marketing parity */}
        <Text style={styles.section}>Listing copy</Text>
        <Field
          label="Headline"
          value={headline}
          onChangeText={setHeadline}
          placeholder="3/2 with new roof — under market, quick close"
        />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="About this deal — the pitch buyers read first…"
          multiline
          style={styles.multiline}
        />
        <Field
          label="Highlights (one per line)"
          value={highlights}
          onChangeText={setHighlights}
          placeholder={'New roof (2024)\nNo HOA\nTenant in place'}
          multiline
          style={styles.multiline}
        />
        <Text style={styles.label}>Deal type</Text>
        <View style={styles.pillRow}>
          {DEAL_TYPES.map((dt) => (
            <Pill
              key={dt.value}
              label={dt.label}
              active={dealType === dt.value}
              onPress={() => setDealType(dealType === dt.value ? '' : dt.value)}
            />
          ))}
        </View>
        {dealType === 'assignment' ? (
          <Text style={styles.assignNote}>
            Buyers see an “Assignment of Contract — direct buyers only” banner.
          </Text>
        ) : null}

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
        <Field
          label="Call / text line"
          value={contactTextLine}
          onChangeText={setContactTextLine}
          placeholder="(904) 555-0123"
          keyboardType="phone-pad"
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
  label: { color: colors.textDim, fontSize: font.small, fontWeight: '600', marginBottom: space.xs },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  assignNote: { color: colors.warn, fontSize: font.small, marginTop: -space.sm, marginBottom: space.md },
  footHint: { color: colors.textFaint, fontSize: font.small, textAlign: 'center', marginTop: space.sm },
});
