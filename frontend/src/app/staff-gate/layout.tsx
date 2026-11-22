import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Private Staff Access — LittleSteps",
  robots: {
    index: false,
    follow: false,
  },
};

export default function StaffGateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
