import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GIF search for the chat's 🎞️ picker, proxied so the GIPHY key stays on the
// server (and only signed-in members can use it). Empty query = trending.
// ?q=<search>&offset=<n>

const LIMIT = 24;
/** GIPHY content rating cap: g, pg, pg-13 or r. */
const RATING = "pg-13";

type GiphyImage = { url?: string; webp?: string; width?: string; height?: string };
type GiphyGif = {
  id: string;
  title?: string;
  images: { fixed_width?: GiphyImage; fixed_width_downsampled?: GiphyImage };
};

export type GifResult = {
  id: string;
  title: string;
  /** Small, low-framerate version for the picker grid. */
  preview: { url: string; width: number; height: number };
  /** What gets posted in the chat. */
  full: { url: string; width: number; height: number };
};

function image(img: GiphyImage | undefined) {
  const url = img?.webp || img?.url;
  const width = Number(img?.width);
  const height = Number(img?.height);
  return url && width > 0 && height > 0 ? { url, width, height } : null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GIFs aren't set up yet." }, { status: 503 });
  }

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 50);
  const offset = Math.min(Math.max(Number(params.get("offset")) || 0, 0), 4999);

  const giphy = new URL(`https://api.giphy.com/v1/gifs/${q ? "search" : "trending"}`);
  giphy.search = new URLSearchParams({
    api_key: apiKey,
    limit: String(LIMIT),
    offset: String(offset),
    rating: RATING,
    bundle: "messaging_non_clips",
    ...(q && { q, lang: "en" }),
  }).toString();

  const res = await fetch(giphy, { next: { revalidate: 300 } }).catch(() => null);
  if (!res?.ok) {
    return NextResponse.json({ error: "Couldn't reach GIPHY — try again." }, { status: 502 });
  }
  const { data } = (await res.json()) as { data: GiphyGif[] };

  const results: GifResult[] = [];
  for (const g of data ?? []) {
    const full = image(g.images.fixed_width);
    const preview = image(g.images.fixed_width_downsampled) ?? full;
    if (full && preview) results.push({ id: g.id, title: g.title ?? "", preview, full });
  }
  return NextResponse.json(
    { results, nextOffset: data?.length === LIMIT ? offset + LIMIT : null },
    { headers: { "Cache-Control": "private, max-age=60" } }
  );
}
