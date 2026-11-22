"use client";

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
    <nav
      aria-label="Kids Navigation"
      className="w-full rounded-3xl bg-white p-3 shadow-md border-2 border-[#78C8F5]/30 flex flex-wrap items-center justify-between gap-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <BrandLogo size="xs" className="mr-1 hidden sm:inline-flex" />
        {KIDS_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelectTab(tab.key)}
              className={cn(
                "min-h-14 px-5 py-2.5 rounded-2xl flex items-center gap-2.5 font-display text-base sm:text-lg font-semibold transition-all cursor-pointer",
                active
                  ? "text-[#24334D] shadow-sm scale-[1.03] ring-2 ring-[#24334D]"
                  : "bg-[#FFF9F0] text-[#24334D]/80 hover:bg-[#FFF5CF]"
              )}
              style={active ? { backgroundColor: tab.bg } : undefined}
            >
              <Icon className="h-5 w-5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <GrownUpGate exitHref={exitHref} />
    </nav>
  );
}
