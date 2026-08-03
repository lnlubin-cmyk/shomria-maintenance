import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "קהילת עצמונה-שומריה — מידע ושירות לתושב",
  description: "מידע ושירות לחברי קהילת עצמונה-שומריה: פנייה לצוות החצר ומידע שימושי לתושב.",
  applicationName: "שומריה",
  appleWebApp: { capable: true, title: "שומריה", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#25654a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Warm up the GovMap connection so the map (SDK + tiles) loads faster,
            especially on mobile. */}
        <link rel="preconnect" href="https://www.govmap.gov.il" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.govmap.gov.il" />
      </head>
      <body className="min-h-screen">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
