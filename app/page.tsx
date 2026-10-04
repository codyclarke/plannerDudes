// Unauthenticated visitors are redirected to /login and authenticated
// visitors to /dashboard by proxy.ts, so this rarely renders — it's a
// fallback for the moment before that redirect resolves.
export default function Home() {
  return null;
}
