import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { Button, EmptyState, Screen } from '@/components/ui';

// There was no +not-found route until browsing went open. A guest tapping a stale
// or malformed link — a shared deal that has since sold, a truncated URL out of an
// email — used to land on expo-router's raw "Unmatched Route" developer screen,
// which is both unbranded and a dead end on device.
export default function NotFound() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen edges={['left', 'right']}>
        <EmptyState
          title="We couldn’t find that page"
          body="The link may be out of date, or the deal is no longer listed."
          action={
            <Button
              title="Browse deals"
              variant="accent"
              onPress={() => router.replace('/(marketplace)')}
            />
          }
        />
      </Screen>
    </>
  );
}
