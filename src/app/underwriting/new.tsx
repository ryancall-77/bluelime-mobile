import React from 'react';
import { SubmitUnderwritingForm } from '@/components/SubmitUnderwritingForm';

// New Underwriting (modal route) — opened from deep links / report-ready pushes.
// The Submit tab renders the same form.
export default function NewUnderwriting() {
  return <SubmitUnderwritingForm />;
}
