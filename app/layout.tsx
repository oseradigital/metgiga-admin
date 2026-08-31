import type { Metadata } from "next";
import { Cormorant_Garamond, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Same two families/brand tokens as portal.metgiga.com and metgiga.com —
// one brand across surfaces, even though this app's audience and density
// are different (see docs/release-1-architecture.md).
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Metgiga Admin",
  description: "Internal CRM for Metgiga.",
  // Internal tool, never a public surface.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${cormorant.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-full flex flex-col font-sans bg-bone text-midnight">{children}</body>
    </html>
  );
}
