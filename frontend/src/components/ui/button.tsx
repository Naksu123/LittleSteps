import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24334D] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-[#24334D] text-white hover:bg-[#1a263a] shadow-sm rounded-2xl",
        secondary:
          "bg-[#78C8F5] text-[#24334D] hover:bg-[#60bcf0] shadow-sm rounded-2xl",
        coral:
          "bg-[#FF9C8C] text-[#24334D] hover:bg-[#ff8a77] shadow-sm rounded-2xl",
        mint: "bg-[#9BE7C4] text-[#24334D] hover:bg-[#84dfb5] shadow-sm rounded-2xl",
        sunshine:
          "bg-[#FFE58A] text-[#24334D] hover:bg-[#ffdc66] shadow-sm rounded-2xl",
        outline:
          "border-2 border-[#24334D]/15 bg-white text-[#24334D] hover:bg-[#FFF9F0] rounded-2xl",
        ghost: "text-[#24334D] hover:bg-[#24334D]/5 rounded-2xl",
        kids: "bg-[#FFE58A] text-[#24334D] border-b-4 border-[#e5c453] hover:bg-[#ffdf70] rounded-3xl shadow-md font-display",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        kid: "min-h-14 px-7 py-3.5 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
);
Button.displayName = "Button";
