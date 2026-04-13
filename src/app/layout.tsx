import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import AuthProvider from "@/components/AuthProvider";
import ThemeProviderWrapper from "@/components/ThemeProvider";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://xreso.dev";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "xreso — Community Programming Notes",
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
  authors: [{ name: "xreso", url: APP_URL }],
  creator: "xreso",
  openGraph: {
    title: "xreso — Community Programming Notes",
    description:
      "Access, read, and share handwritten programming notes. A community-driven educational resource platform.",
    url: APP_URL,
    siteName: "xreso",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "xreso — Community Programming Notes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "xreso — Community Programming Notes",
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
  manifest: "/manifest.json",
};

// JSON-LD structured data for the whole site
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "xreso",
  url: APP_URL,
  description:
    "A community-driven platform for sharing handwritten programming notes.",
  potentialAction: {
    "@type": "SearchAction",
    target: `${APP_URL}/browse?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0F0A1A" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <ThemeProviderWrapper>
          <AuthProvider>
            <Navbar />
            <main>{children}</main>
            <Footer />
          </AuthProvider>
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
