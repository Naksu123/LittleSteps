import type { Metadata, Viewport } from "next";
import "@fontsource/fredoka/latin-400.css";
import "@fontsource/fredoka/latin-600.css";
import "@fontsource/fredoka/latin-700.css";
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ServiceWorkerRegistrar } from "@/components/layout/ServiceWorkerRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "LittleSteps — Cloud Kindergarten Learning Management System",
  description:
    "Interactive, child-safe early childhood learning for Pre-School learners, empowering parents, guardians, and teachers.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/images/littlesteps-logo.jpg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFF9F0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overflow-x-clip">
      <body className="min-h-dvh bg-[#FFF9F0] text-[#24334D] antialiased overflow-x-clip">
        <AuthProvider>
          <ServiceWorkerRegistrar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
