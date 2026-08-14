import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MbT Stock",
    template: "%s | MbT Stock",
  },
  description: "Mercedes-Benz workshop inventory and tool-custody prototype.",
  robots: {
    index: false,
    follow: false,
  },
  other: {
    "codex-preview": "development",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
