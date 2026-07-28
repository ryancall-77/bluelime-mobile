import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState } from '@/components/ui';
import { colors, space } from '@/lib/theme';

// Messages — your conversations with sellers/buyers. (Live inbox lands in the
// fast-follow; the thread-list endpoint is being wired next. Per-deal threads
// already work from a deal's page today.)
export default function Messages() {
  const router = useRouter();
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <View style={styles.fill}>
        <EmptyState
          title="No messages yet"
          body="When you message a seller about a deal (or a buyer messages you), the conversation shows up here."
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
