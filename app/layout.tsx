import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DealPilot — Keep every deal moving",
  description:
    "A calm, focused workspace for proposal follow-ups and healthier sales pipelines.",
  applicationName: "DealPilot"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
