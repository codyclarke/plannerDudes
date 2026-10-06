// Light/dark preference. Stored per device in a cookie (not the account) so
// the server can render the right theme on the very first paint — including
// the login screen — with no flash. "system" follows the device setting.

export const THEME_COOKIE = "theme";
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export function parseTheme(value: string | undefined): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "system";
}

/** Browser/status-bar colors; must match --background in globals.css. */
export const THEME_COLORS = { light: "#fbf7ff", dark: "#120b1f" } as const;
