"use client";

import { motion } from "framer-motion";

interface MascotProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

export function Mascot({ message, size = "md" }: MascotProps) {
  const dims =
    size === "sm" ? "w-16 h-16" : size === "lg" ? "w-28 h-28" : "w-20 h-20";

  return (
    <div className="inline-flex items-center gap-4">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className={dims}
      >
        <svg
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Pip the LittleSteps Owl Mascot"
          className="h-full w-full drop-shadow-sm"
        >
          <circle cx="60" cy="64" r="44" fill="#78C8F5" />
          <ellipse cx="60" cy="76" rx="28" ry="26" fill="#FFF9F0" />
          <path d="M26 36L40 20L46 38Z" fill="#78C8F5" />
          <path d="M94 36L80 20L74 38Z" fill="#78C8F5" />
          <circle cx="44" cy="52" r="13" fill="#FFFFFF" />
          <circle cx="76" cy="52" r="13" fill="#FFFFFF" />
          <circle cx="45" cy="52" r="6" fill="#24334D" />
          <circle cx="75" cy="52" r="6" fill="#24334D" />
          <circle cx="47" cy="50" r="2" fill="#FFFFFF" />
          <circle cx="77" cy="50" r="2" fill="#FFFFFF" />
          <path d="M54 60L60 69L66 60Z" fill="#FFE58A" stroke="#24334D" strokeWidth="2" />
          <ellipse cx="22" cy="70" rx="9" ry="18" fill="#5CB6EA" />
          <ellipse cx="98" cy="70" rx="9" ry="18" fill="#5CB6EA" />
          <circle cx="34" cy="62" r="5" fill="#FF9C8C" fillOpacity="0.65" />
          <circle cx="86" cy="62" r="5" fill="#FF9C8C" fillOpacity="0.65" />
        </svg>
      </motion.div>
      {message && (
        <div className="relative rounded-3xl bg-white px-5 py-3 shadow-sm border-2 border-[#78C8F5]/40 text-sm sm:text-base font-semibold text-[#24334D] max-w-md">
          {message}
        </div>
      )}
    </div>
  );
}
