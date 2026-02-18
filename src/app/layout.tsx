import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "DC Bus Route - Davao City Bus Guide",
    template: "%s | DC Bus Route",
  },
  description:
    "A web-based application that shows DC Bus routes and bus stops in Davao City. Helps commuters know where to board and where to get off.",
  keywords: [
    "DC Bus",
    "Davao City",
    "bus route",
    "bus stop",
    "public transportation",
    "commute",
    "Philippines",
  ],
  authors: [
    { name: "Antonio De Jesus" },
    { name: "Kieffer Devera" },
  ],
  creator: "Antonio De Jesus & Kieffer Devera",
  openGraph: {
    type: "website",
    locale: "en_PH",
    siteName: "DC Bus Route",
    title: "DC Bus Route - Davao City Bus Guide",
    description:
      "Find bus routes and stops in Davao City. Know where to board and where to get off.",
  },
  twitter: {
    card: "summary_large_image",
    title: "DC Bus Route - Davao City Bus Guide",
    description:
      "Find bus routes and stops in Davao City. Know where to board and where to get off.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-md"
        >
          Skip to main content
        </a>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
