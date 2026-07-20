import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "קהילת עצמונה-שומריה — מידע ושירות לתושב",
  description: "מידע ושירות לחברי קהילת עצמונה-שומריה: פנייה לצוות החצר ומידע שימושי לתושב.",
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
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
