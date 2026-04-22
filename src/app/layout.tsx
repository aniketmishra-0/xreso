import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import AuthProvider from "@/components/AuthProvider";
import ThemeProviderWrapper from "@/components/ThemeProvider";
import GlobalSearchHotkey from "@/components/GlobalSearchHotkey";
import { SITE_URL } from "@/lib/site";
import Script from "next/script";
import CookieConsent from "@/components/CookieConsent/CookieConsent";
import PostHogPageView from "@/components/PostHogProvider";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F6FF" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0A1A" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "xreso — The Programmer's Library",
    template: "%s | xreso",
  },
  description:
    "Access, read, and share handwritten programming notes for SQL, Python, JavaScript, and more. A community-driven educational resource platform.",
  keywords: [
    "programming notes",
    "handwritten notes",
    "SQL notes",
    "Python notes",
    "JavaScript notes",
    "study resources",
    "coding notes",
    "open source education",
  ],
  authors: [{ name: "xreso", url: SITE_URL }],
  creator: "xreso",
  openGraph: {
    title: "xreso — The Programmer's Library",
    description:
      "Access, read, and share handwritten programming notes. A community-driven educational resource platform.",
    url: SITE_URL,
    siteName: "xreso",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "xreso — The Programmer's Library",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "xreso — The Programmer's Library",
    description: "Access, read, and share handwritten programming notes.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [{ url: "/icon.png?v=4", type: "image/png", sizes: "32x32" }],
    shortcut: [{ url: "/icon.png?v=4", type: "image/png" }],
    apple: [{ url: "/apple-icon.png?v=4", type: "image/png", sizes: "180x180" }],
  },
  manifest: "/manifest.json?v=4",
};

// JSON-LD structured data for the whole site
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "xreso",
  url: SITE_URL,
  description:
    "A community-driven platform for sharing handwritten programming notes.",
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <meta name="google-adsense-account" content="ca-pub-1546731712124834" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1546731712124834"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProviderWrapper>
          <AuthProvider>
            <GlobalSearchHotkey />
            <Suspense fallback={null}>
              <Navbar />
            </Suspense>
            <main>{children}</main>
            <Footer />
            <CookieConsent />
            <Suspense fallback={null}>
              <PostHogPageView />
            </Suspense>
          </AuthProvider>
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
