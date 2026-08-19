import React from 'react';
import { useRouter } from 'expo-router';
import { SubmitUnderwritingForm } from '@/components/SubmitUnderwritingForm';

// Submit tab — run a new underwriting straight from the phone.
export default function Submit() {
  // Land on Reports once the run is registered — the row appears there as a
  // 'processing' card, which is the confirmation that the submit took. The banner
  // tracks it from wherever they go next. (Ryan, 2026-08-19.)
  const router = useRouter();
  return <SubmitUnderwritingForm onSubmitted={() => router.replace('/(underwriting)/reports')} />;
}
