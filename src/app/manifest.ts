import type { MetadataRoute } from "next";

/** PWA manifest — makes the site installable ("Add to Home Screen") on Android and iOS. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "קהילת עצמונה-שומריה",
    short_name: "שומריה",
    description: "מידע ושירות לתושבי קהילת עצמונה-שומריה: פנייה לצוות החצר ומידע שימושי.",
    lang: "he",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#25654a",
    icons: [
      { src: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
