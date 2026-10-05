/**
 * Public base URL of the app, for links that leave the site (emails, push
 * notifications, calendar files). Server-only — in the browser use
 * window.location.origin.
 *
 * Nothing needs configuring:
 * - Production on Vercel uses VERCEL_PROJECT_PRODUCTION_URL, a system
 *   variable Vercel sets to the project's production domain (custom domain if
 *   one is added, else <project>.vercel.app).
 * - Everywhere else (local dev, Vercel preview deployments) uses the origin
 *   the request came in on, so links work on localhost and from a phone on
 *   your LAN alike.
 * SITE_URL can still override all of this if ever needed.
 */
export function siteUrl(request?: Request): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");

  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (request) return new URL(request.url).origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
