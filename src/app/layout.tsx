import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import ScrollReveal from "@/components/ScrollReveal";

// Self-hosted (served from our own origin, cached by the service worker) instead
// of a render-blocking request to fonts.googleapis.com on every cold open.
const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rubik",
  display: "swap",
});

// Mark the root ready for scroll-reveal BEFORE first paint, but only when the
// viewer allows motion — so reveal-hidden elements never flash, and no-JS /
// reduced-motion users always see the content.
const REVEAL_READY = `try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('reveal-ready')}}catch(e){}`;

export const metadata: Metadata = {
  title: "קהילת עצמונה-שומריה — מידע ושירות לתושב",
  description: "מידע ושירות לחברי קהילת עצמונה-שומריה: פנייה לצוות החצר ומידע שימושי לתושב.",
  applicationName: "שומריה",
  appleWebApp: { capable: true, title: "שומריה", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png?v=2", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#25654a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable}>
      <head>
        {/* Warm up the GovMap connection so the map (SDK + tiles) loads faster,
            especially on mobile. */}
        <link rel="preconnect" href="https://www.govmap.gov.il" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.govmap.gov.il" />
        <script dangerouslySetInnerHTML={{ __html: REVEAL_READY }} />
      </head>
      <body className="min-h-screen">
        {children}
        <ScrollReveal />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
