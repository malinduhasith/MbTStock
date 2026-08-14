import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MbT Stock",
  description: "Workshop tool inventory and check-out register.",
  other: {
    "codex-preview": "development",
  },
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
