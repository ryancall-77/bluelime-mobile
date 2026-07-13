import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Screen, Button } from '@/components/ui';
import { colors, font, space } from '@/lib/theme';
import { TERMS_URL, SUPPORT_EMAIL } from '@/lib/config';

// In-app summary + link to the full hosted Terms/EULA. Kept in the app so the
// EULA is reachable without leaving (Apple UGC requirement).
export default function Terms() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>Terms & EULA</Text>
        <Text style={styles.p}>
          Bluelime Deals connects real-estate buyers with off-market deals. All property numbers
          (ARV, rehab, profit) are Bluelime-verified estimates, not guarantees. Do your own diligence
          before making an offer.
        </Text>
        <Text style={styles.h2}>Community rules (zero tolerance)</Text>
        <Text style={styles.p}>
          Messaging other users is a privilege. There is zero tolerance for objectionable, abusive,
          fraudulent, or harassing content. Use the Report control on any message or listing, or Block
          a user, at any time. Reported content is reviewed within 24 hours and violators are removed.
        </Text>
        <Text style={styles.h2}>Support</Text>
        <Text style={styles.p}>Questions or safety concerns: {SUPPORT_EMAIL}</Text>
        <Button title="Read the full Terms & EULA" onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} style={{ marginTop: space.lg }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg },
  h1: { color: colors.text, fontSize: font.h1, fontWeight: '800', marginBottom: space.md },
  h2: { color: colors.text, fontSize: font.h3, fontWeight: '700', marginTop: space.lg, marginBottom: space.sm },
  p: { color: colors.textDim, fontSize: font.body, lineHeight: 22 },
});
