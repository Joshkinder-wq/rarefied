import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Rarefied — An Index of Rarity",
  description: "Where do you sit on the curve? An honest reckoning across the metrics that quietly stratify men.",
  openGraph: {
    title: "Rarefied — An Index of Rarity",
    description: "Where do you sit on the curve?",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#0a0908" }}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
