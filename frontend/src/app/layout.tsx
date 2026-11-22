import type { Metadata, Viewport } from "next";
import "@fontsource/fredoka/400.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import { AuthProvider } from "@/hooks/useAuth";
import "./globals.css";

export const metadata: Metadata = {
  title: "LittleSteps — Cloud Kindergarten Learning Management System",
  description:
    "Interactive, child-safe early childhood learning for ages 4–6, empowering parents, guardians, and kindergarten teachers.",
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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
