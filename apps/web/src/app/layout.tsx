import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/sw-registrar";

export const metadata: Metadata = {
  title: { default: "Rosie", template: "%s · Rosie" },
  description: "Always-on AI marketing operator for local service businesses.",
  manifest: "/manifest.json",
  applicationName: "Rosie",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rosie",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icon.svg", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#5b21b6" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b14" },
  ],
  width: "device-width",
  initialScale: 1,
  // Tells iOS to use the full screen edge-to-edge under the notch.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
