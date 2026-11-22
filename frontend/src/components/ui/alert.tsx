import * as React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "info" | "success" | "warning";
  title?: string;
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
  ...props
}: AlertProps) {
  const styles = {
    info: "bg-[#DCF2FD] border-[#78C8F5] text-[#184B69]",
    success: "bg-[#DDF8EC] border-[#9BE7C4] text-[#166041]",
    warning: "bg-[#FFE3DE] border-[#FF9C8C] text-[#842D1F]",
  }[tone];

  const Icon =
    tone === "success" ? CheckCircle2 : tone === "warning" ? AlertCircle : Info;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-2xl border-2 p-4 text-sm",
        styles,
        className
      )}
      {...props}
    >
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        {title && <p className="font-bold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
