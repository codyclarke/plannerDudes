// 🪵 Pergola mode: an easter egg (tap the header logo 5 times) that re-skins
// the app as a backyard — cedar, vines and string lights. Remembered per
// device in a cookie so the server renders it from the first paint, like the
// light/dark theme.

export const PERGOLA_COOKIE = "pergola";

export function isPergola(value: string | undefined) {
  return value === "1";
}

/** Browser/status-bar colors in Pergola mode; must match globals.css. */
export const PERGOLA_COLORS = { light: "#f8efe3", dark: "#1d150e" } as const;
