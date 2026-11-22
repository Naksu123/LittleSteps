import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold",
  {
    variants: {
      variant: {
        sky: "bg-[#DCF2FD] text-[#175B82]",
        sunshine: "bg-[#FFF5CF] text-[#785700]",
        mint: "bg-[#DDF8EC] text-[#166041]",
        coral: "bg-[#FFE3DE] text-[#8E3022]",
        lavender: "bg-[#EDE7FE] text-[#4C328B]",
        neutral: "bg-[#24334D]/8 text-[#24334D]",
      },
    },
    defaultVariants: {
      variant: "sky",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
