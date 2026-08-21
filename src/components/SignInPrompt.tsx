// The in-place "you need an account for this" panel — what a gated SCREEN renders
// instead of its content, where requireAuth() is what a gated TAP calls.
//
// Deliberately a thin wrapper over EmptyState rather than a new design: a guest
// hitting Favorites should see the same shape as a signed-in user with nothing
// saved, so the app reads as "nothing here yet" rather than "you are locked out".

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState } from '@/components/ui';
import { GATE_COPY, type GateReason } from '@/lib/gate';
import { space } from '@/lib/theme';

export function SignInPrompt({ title, reason, body }: { title: string; reason: GateReason; body?: string }) {
  const router = useRouter();
  return (
    <EmptyState
      title={title}
      body={body ?? GATE_COPY[reason]}
      action={
        <View style={styles.actions}>
          <Button
            title="Create free account"
            variant="accent"
            onPress={() => router.push({ pathname: '/(auth)/signup', params: { reason } })}
          />
          <Button
            title="Log in"
            variant="outline"
            onPress={() => router.push({ pathname: '/(auth)/login', params: { reason } })}
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  // Stretch, not hug: EmptyState centers its action slot, and two buttons of
  // different label widths would otherwise sit at two different widths.
  actions: { alignSelf: 'stretch', minWidth: 260, gap: space.md },
});
