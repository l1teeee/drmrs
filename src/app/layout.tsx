import type { Metadata, Viewport } from "next";
import { Courier_Prime, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const maquina = Courier_Prime({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-maquina",
});

const siteTitle =
  "drmrs archive · Archivo 001 · crewnecks numerados hechos a mano en Querétaro";
const siteDescription =
  "Archivo 001 de drmr: 50 crewnecks numerados y personalizados a mano en Querétaro. Regístrate gratis y entra 24 h antes al drop del 04.12.";

const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://drmr.com.mx");

export const metadata: Metadata = {
  metadataBase: siteUrl,
  ...(siteUrl.hostname !== "drmr.com.mx" ? { robots: { index: false, follow: false } } : {}),
  title: { default: siteTitle, template: "%s · drmrs archive" },
  description: siteDescription,
  keywords: [
    "drmr",
    "drmrs archive",
    "Archivo 001",
    "streetwear Querétaro",
    "crewneck numerado",
    "ropa hecha a mano México",
    "drop 04.12",
  ],
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "drmrs archive",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#182AE1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX" className={`${inter.variable} ${maquina.variable}`}>
      <body>{children}</body>
    </html>
  );
}
