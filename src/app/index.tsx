import { Redirect } from 'expo-router';

// Entry route -> the home screen (Ryan, 2026-08-28).
//
// This used to redirect straight into /(marketplace), so a cold install opened on
// a map of pins with nothing anywhere saying what the app is. /home is the plain-
// language introduction with the two doors on it; the Home|Deals|Underwrite
// segment in TopBar and the logo tap both come back here, so it costs one tap and
// is never a wall you have to get past.
//
// Still no session to wait on — /home is public, like everything it links to.
export default function Index() {
  return <Redirect href="/home" />;
}
