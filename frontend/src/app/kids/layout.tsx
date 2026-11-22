import type { ReactNode } from "react";
import { KidsMusicController } from "@/components/kids/KidsMusicController";

export default function KidsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <KidsMusicController />
      {children}
    </>
  );
}
