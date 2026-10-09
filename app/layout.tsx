import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Camino – Spanisch lernen",
  description: "Dein Weg zu Spanisch: kurze Lektionen, kluge Wiederholung, ohne Paywall.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
