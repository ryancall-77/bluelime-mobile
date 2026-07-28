import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState } from '@/components/ui';
import { colors, space } from '@/lib/theme';

// Offers — the offers you've made on marketplace deals + their status. (Live
// data lands in the fast-follow; the buyer-offers list endpoint is being wired
// next. You can still make an offer from any deal's page today.)
export default function Offers() {
  const router = useRouter();
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <View style={styles.fill}>
        <EmptyState
          title="No offers yet"
          body="Offers you make on deals will appear here with their status. Find a deal you like and tap “Make an offer”."
          action={<Button title="Browse deals" onPress={() => router.push('/(marketplace)')} />}
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
