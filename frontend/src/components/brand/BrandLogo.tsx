import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  xs: "h-8 sm:h-9 w-auto max-w-[128px] sm:max-w-[150px]",
  sm: "h-9 sm:h-11 w-auto max-w-[144px] sm:max-w-[180px]",
  md: "h-16 sm:h-20 w-auto max-w-full",
  lg: "h-20 sm:h-28 w-auto max-w-full",
};

export function BrandLogo({ size = "sm", className }: BrandLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-2xl bg-white px-2 sm:px-2.5 py-1 shadow-xs border border-[#24334D]/8 shrink-0 max-w-full",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/littlesteps-logo.jpg"
        alt="LittleSteps — Small Steps, Big Discoveries."
        className={cn("object-contain select-none", SIZE_CLASSES[size])}
      />
    </span>
  );
}
