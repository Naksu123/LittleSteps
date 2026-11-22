import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const WRAPPER_SIZE_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  xs: "max-w-[136px] sm:max-w-[160px]",
  sm: "max-w-[156px] sm:max-w-[192px]",
  md: "max-w-[240px] sm:max-w-[280px]",
  lg: "max-w-[280px] sm:max-w-[340px]",
};

const SIZE_CLASSES: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  xs: "h-8 sm:h-9 w-auto max-w-full",
  sm: "h-9 sm:h-11 w-auto max-w-full",
  md: "h-16 sm:h-20 w-auto max-w-full",
  lg: "h-20 sm:h-28 w-auto max-w-full",
};

const INTRINSIC_DIMS: Record<
  NonNullable<BrandLogoProps["size"]>,
  { width: number; height: number }
> = {
  xs: { width: 120, height: 36 },
  sm: { width: 148, height: 44 },
  md: { width: 220, height: 80 },
  lg: { width: 280, height: 112 },
};

export function BrandLogo({ size = "sm", className }: BrandLogoProps) {
  const dims = INTRINSIC_DIMS[size];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded-2xl bg-white px-2 sm:px-2.5 py-1 shadow-xs border border-[#24334D]/8 shrink-0 max-w-full",
        WRAPPER_SIZE_CLASSES[size],
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/littlesteps-logo.jpg"
        alt="LittleSteps — Small Steps, Big Discoveries."
        width={dims.width}
        height={dims.height}
        className={cn("object-contain select-none", SIZE_CLASSES[size])}
      />
    </span>
  );
}
