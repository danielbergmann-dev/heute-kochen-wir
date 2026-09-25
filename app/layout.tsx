import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Heute kochen wir",
  description: "Gemeinsam nachhaltig und gesund kochen. Checklisten für zwei Klassen mit Online-Speicherung und Auswertung.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
