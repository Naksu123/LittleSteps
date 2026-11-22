"use client";

import Link from "next/link";
import {
  Award,
  BookOpen,
  Gamepad2,
  Home,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { GrownUpGate } from "@/components/layout/GrownUpGate";

export type KidsTabKey = "home" | "learn" | "play" | "stories" | "rewards";

interface KidsNavProps {
  activeTab: KidsTabKey;
  onSelectTab: (tab: KidsTabKey) => void;
  exitHref?: string;
}

const KIDS_TABS: Array<{
  key: KidsTabKey;
  label: string;
  icon: typeof Home;
  bg: string;
}> = [
  { key: "home", label: "Home", icon: Home, bg: "#78C8F5" },
  { key: "learn", label: "Learn", icon: BookOpen, bg: "#9BE7C4" },
  { key: "play", label: "Play", icon: Gamepad2, bg: "#FFE58A" },
  { key: "stories", label: "Stories", icon: Sparkles, bg: "#B8A5F5" },
  { key: "rewards", label: "My Rewards", icon: Award, bg: "#FF9C8C" },
];

export function KidsNav({
  activeTab,
  onSelectTab,
  exitHref = "/parent",
}: KidsNavProps) {
  return (
    <header className="w-full rounded-3xl bg-white px-3 sm:px-4 py-2.5 sm:py-3 shadow-md border-2 border-[#78C8F5]/30">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <Link href="/kids" className="flex items-center shrink-0">
          <BrandLogo size="xs" />
        </Link>

        <nav
          aria-label="Kids Navigation"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 gap-1 bg-white/95 backdrop-blur-md border-t-2 border-[#78C8F5]/30 px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(36,51,77,0.08)] md:static md:inset-auto md:z-auto md:flex md:flex-wrap md:items-center md:justify-center md:gap-2 md:bg-transparent md:backdrop-blur-none md:border-t-0 md:p-0 md:shadow-none"
        >
          {KIDS_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onSelectTab(tab.key)}
                className={cn(
                  "min-w-0 flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 rounded-2xl md:rounded-3xl min-h-[50px] md:min-h-12 lg:min-h-14 px-1 md:px-4 lg:px-5 py-1.5 md:py-2 font-display text-[11px] sm:text-xs md:text-base font-semibold transition-all cursor-pointer",
                  active
                    ? "text-[#24334D] shadow-sm md:scale-[1.03] ring-2 ring-[#24334D]"
                    : "bg-[#FFF9F0] text-[#24334D]/80 hover:bg-[#FFF5CF]"
                )}
                style={active ? { backgroundColor: tab.bg } : undefined}
              >
                <Icon className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                <span className="truncate max-w-full">
                  {tab.key === "rewards" ? (
                    <>
                      <span className="sr-only sm:not-sr-only">My </span>
                      Rewards
                    </>
                  ) : (
                    tab.label
                  )}
                </span>
              </button>
            );
          })}
        </nav>

        <GrownUpGate exitHref={exitHref} />
      </div>
    </header>
  );
}
