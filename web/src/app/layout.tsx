import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AION 2 Announce · Control center",
  description: "Minimal control center for an AION 2 Announce bot instance.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
