interface ShapeIconProps {
  shape?: string;
  color?: string;
  size?: number;
}

export function ShapeIcon({
  shape = "circle",
  color = "#78C8F5",
  size = 56,
}: ShapeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      {shape === "square" && (
        <rect
          x="10"
          y="10"
          width="44"
          height="44"
          rx="8"
          fill={color}
          stroke="#24334D"
          strokeWidth="3"
        />
      )}
      {shape === "rectangle" && (
        <rect
          x="6"
          y="16"
          width="52"
          height="32"
          rx="6"
          fill={color}
          stroke="#24334D"
          strokeWidth="3"
        />
      )}
      {shape === "triangle" && (
        <polygon
          points="32,8 56,54 8,54"
          fill={color}
          stroke="#24334D"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      )}
      {shape === "star" && (
        <polygon
          points="32,6 39,23 58,24 43,36 48,55 32,45 16,55 21,36 6,24 25,23"
          fill={color}
          stroke="#24334D"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      )}
      {shape === "heart" && (
        <path
          d="M32 54C32 54 10 40 10 24C10 16.5 16 11 23 11C27.5 11 30.5 13.5 32 16.5C33.5 13.5 36.5 11 41 11C48 11 54 16.5 54 24C54 40 32 54 32 54Z"
          fill={color}
          stroke="#24334D"
          strokeWidth="3"
        />
      )}
      {(!shape || shape === "circle") && (
        <circle
          cx="32"
          cy="32"
          r="23"
          fill={color}
          stroke="#24334D"
          strokeWidth="3"
        />
      )}
    </svg>
  );
}
