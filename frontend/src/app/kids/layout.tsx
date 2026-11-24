import type { ReactNode } from "react";
import { KidsMusicController } from "@/components/kids/KidsMusicController";
import { ScreenTimeGuard } from "@/components/kids/ScreenTimeGuard";

export default function KidsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <KidsMusicController />
      <ScreenTimeGuard />
      {children}
    </>
  );
}
