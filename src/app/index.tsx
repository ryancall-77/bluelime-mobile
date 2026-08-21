import { Redirect } from 'expo-router';

// Entry route. Unconditional now that the marketplace is browsable signed-out —
// there is no session to wait on and no reason to branch, so this no longer holds
// a Loading frame while auth resolves. Anything a guest cannot do prompts at the
// tap (see lib/gate.ts), and the root navigator still backstops private routes.
export default function Index() {
  return <Redirect href="/(marketplace)" />;
}
