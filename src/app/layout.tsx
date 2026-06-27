import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "あおば整骨院 給与管理",
  description: "あおば整骨院 スタッフ情報・給与管理システム",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${notoSansJP.variable} h-full antialiased`}
      style={{ fontFamily: 'var(--font-noto-sans-jp), sans-serif', colorScheme: 'light' }}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
