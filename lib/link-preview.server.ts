// Fetches a pasted link's share-preview info (og:title / og:image / …), the
// same data iMessage and Slack use for link previews.
//
// The server fetches URLs that users paste, so it's guarded against being
// pointed at private/internal addresses (SSRF): only http(s), hostnames must
// resolve to public IPs, every redirect hop is re-checked, and the whole
// fetch is capped in time and size.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const TOTAL_TIMEOUT_MS = 8000;
const MAX_BYTES = 768 * 1024;
const MAX_REDIRECTS = 3;
const USER_AGENT = "Mozilla/5.0 (compatible; DudePlannerLinkPreview/1.0)";

export type LinkPreview = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string;
};

/** Thrown for links we refuse outright (not http(s), or a private address). */
export class BlockedUrlError extends Error {}

function isPrivateIPv4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast / reserved
  );
}

function isPrivateIPv6(ip: string) {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (/^f[cd]/.test(v)) return true; // unique local
  if (/^fe[89ab]/.test(v)) return true; // link-local
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIPv4(mapped[1]) : false;
}

export function isPrivateAddress(ip: string) {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // not an IP at all: treat as unsafe
}

/**
 * Parses and vets a URL. (A DNS answer could in theory change between this
 * check and the fetch; acceptable for a friend-group app, and every redirect
 * is re-checked.)
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError("That doesn't look like a link.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BlockedUrlError("Only http(s) links are supported.");
  }
  if (url.username || url.password) throw new BlockedUrlError("Links with logins aren't supported.");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^localhost$|\.(localhost|local|internal)$/i.test(host)) {
    throw new BlockedUrlError("That link points to a private address.");
  }
  let addresses: { address: string }[];
  try {
    addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  } catch {
    throw new BlockedUrlError("That website doesn't seem to exist.");
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new BlockedUrlError("That link points to a private address.");
  }
  return url;
}

/** Fetches the start of an HTML page (up to </head>), following safe redirects. */
async function fetchHead(start: URL): Promise<{ url: URL; html: string } | null> {
  const signal = AbortSignal.timeout(TOTAL_TIMEOUT_MS);
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html") || !res.body) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (bytes > MAX_BYTES || /<\/head>/i.test(html)) {
        await reader.cancel();
        break;
      }
    }
    return { url, html };
  }
  return null; // too many redirects
}

// Named entities that show up in listing titles/descriptions (· – — … ’ etc.).
const NAMED_ENTITIES: Record<string, string> = {
  quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", middot: "·", bull: "•",
  ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  star: "☆", times: "×", deg: "°", euro: "€", pound: "£", copy: "©", reg: "®", trade: "™",
};

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .replace(/&amp;/g, "&"); // last, so "&amp;lt;" stays the text "&lt;"
}

/** <meta property|name="…" content="…"> values from the page's <head>, first wins. */
export function parseMetaTags(html: string) {
  const head = html.split(/<\/head>/i)[0];
  const meta = new Map<string, string>();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3];
    }
    const key = (attrs.property ?? attrs.name)?.toLowerCase();
    if (key && attrs.content && !meta.has(key)) meta.set(key, decodeEntities(attrs.content).trim());
  }
  const title = head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  return { meta, title: title ? decodeEntities(title).trim() : null };
}

const clamp = (s: string | null | undefined, n: number) =>
  s ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : null;

/**
 * Preview for a pasted link. Throws BlockedUrlError for links we refuse;
 * otherwise never throws — if the site can't be fetched (blocked, slow,
 * not HTML) you get just the site name, and the card falls back to that.
 */
export async function fetchLinkPreview(raw: string): Promise<LinkPreview> {
  const url = await assertPublicUrl(raw);
  const fallbackSite = url.hostname.replace(/^www\./, "");

  let page: { url: URL; html: string } | null = null;
  try {
    page = await fetchHead(url);
  } catch (err) {
    if (err instanceof BlockedUrlError) throw err; // a redirect into a private address
    page = null; // network error / timeout: fall back
  }
  if (!page) return { title: null, description: null, imageUrl: null, siteName: fallbackSite };

  const { meta, title } = parseMetaTags(page.html);
  const pick = (...keys: string[]) => keys.map((k) => meta.get(k)).find(Boolean) ?? null;

  let imageUrl: string | null = null;
  const rawImage = pick("og:image:secure_url", "og:image", "og:image:url", "twitter:image");
  if (rawImage) {
    try {
      const resolved = new URL(rawImage, page.url);
      if (resolved.protocol === "https:" || resolved.protocol === "http:") imageUrl = resolved.toString();
    } catch {
      // ignore unparseable image URLs
    }
  }

  return {
    title: clamp(pick("og:title", "twitter:title") ?? title, 200),
    description: clamp(pick("og:description", "twitter:description", "description"), 500),
    imageUrl: clamp(imageUrl, 2000),
    siteName: clamp(pick("og:site_name"), 80) ?? fallbackSite,
  };
}
