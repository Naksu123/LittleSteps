import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  xs: "h-9 w-auto",
  sm: "h-12 w-auto",
  md: "h-20 w-auto",
  lg: "h-28 w-auto",
};

export function BrandLogo({ size = "sm", className }: BrandLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-2xl bg-white px-2.5 py-1 shadow-xs border border-[#24334D]/8",
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
