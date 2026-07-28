import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState } from '@/components/ui';
import { colors, space } from '@/lib/theme';

// Buyers — the disposition side: buyers who saved, inquired, or made offers on
// YOUR listings. (Live data lands in the fast-follow; the buyer-interest
// endpoint is being wired next.)
export default function Buyers() {
  const router = useRouter();
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <View style={styles.fill}>
        <EmptyState
          title="No buyer activity yet"
          body="When buyers save, message, or make offers on your listings, they’ll show up here so you can work your dispo in one place."
          action={<Button title="View your listings" onPress={() => router.push('/(underwriting)/listings')} />}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: space.lg },
  fill: { flex: 1, justifyContent: 'center' },
});
