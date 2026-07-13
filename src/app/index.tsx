import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Loading } from '@/components/ui';

// Entry route. The root navigator's gate also enforces this, but redirecting
// here avoids a blank initial frame.
export default function Index() {
  const { ready, signedIn } = useAuth();
  if (!ready) return <Loading />;
  return <Redirect href={signedIn ? '/(tabs)' : '/(auth)/login'} />;
}
