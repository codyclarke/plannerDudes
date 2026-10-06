import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { cookies } from "next/headers";
import { APP_NAME } from "@/lib/app";
import { THEME_COLORS, THEME_COOKIE, parseTheme } from "@/lib/theme";
import "./globals.css";

// Fredoka for headings (rounded, playful), Nunito for body text.
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Plan events and find a time that works for everyone",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-512.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
};

async function currentTheme() {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await currentTheme();
  return {
    // Browser bar / phone status bar color follows the chosen theme.
    themeColor:
      theme === "system"
        ? [
            { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
            { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
          ]
        : THEME_COLORS[theme],
    // Lets the bottom tab bar extend under the iPhone home indicator; the bar
    // pads itself with env(safe-area-inset-bottom).
    viewportFit: "cover",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Rendered server-side from the cookie so the first paint is already in the
  // right theme (no flash). No attribute = follow the device setting.
  const theme = await currentTheme();
  return (
    <html
      lang="en"
      data-theme={theme === "system" ? undefined : theme}
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
