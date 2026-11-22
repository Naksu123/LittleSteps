import { AVATAR_META, cn } from "@/lib/utils";

interface ChildAvatarProps {
  avatarKey: string;
  colorHex?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function ChildAvatar({
  avatarKey,
  colorHex,
  size = "md",
  className,
}: ChildAvatarProps) {
  const meta = AVATAR_META[avatarKey] || AVATAR_META.bunny;
  const sizes = {
    sm: "h-10 w-10 text-xl",
    md: "h-12 w-12 text-2xl",
    lg: "h-16 w-16 text-4xl",
    xl: "h-24 w-24 text-5xl",
  }[size];

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full border-4 border-white shadow-sm select-none",
        sizes,
        className
      )}
      style={{ backgroundColor: colorHex || meta.bg }}
      aria-label={`${meta.label} avatar`}
    >
      <span role="img" aria-hidden="true">
        {meta.emoji}
      </span>
    </div>
  );
}
