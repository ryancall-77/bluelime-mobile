import React from 'react';
import { useRouter } from 'expo-router';
import { SubmitUnderwritingForm } from '@/components/SubmitUnderwritingForm';

// New Underwriting (modal route) — opened from deep links / report-ready pushes.
// The Submit tab renders the same form.
export default function NewUnderwriting() {
  // Dismiss the modal once the run is registered — the banner takes it from here.
  // The Submit TAB passes no callback and simply stays put, so both entry points are
  // right without guessing at canGoBack().
  const router = useRouter();
  return <SubmitUnderwritingForm onSubmitted={() => router.back()} />;
}
