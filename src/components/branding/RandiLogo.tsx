import Link from "next/link";

interface RandiLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "with-text" | "icon-only";
  href?: string;
  animated?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { width: 62, height: 62, textSize: "text-xl" },
  md: { width: 80, height: 80, textSize: "text-2xl" },
  lg: { width: 120, height: 120, textSize: "text-3xl" },
  xl: { width: 164, height: 164, textSize: "text-5xl" },
};

export function RandiLogo({
  size = "md",
  variant = "default",
  href,
  animated = false,
  className = "",
}: RandiLogoProps) {
  const { width, height, textSize } = sizeMap[size];
  const showText = variant === "default" || variant === "with-text";

  const logoContent = (
    <div
      className={`flex items-center gap-3 group ${animated ? "transition-transform duration-200 hover:scale-105" : ""} ${className}`}
    >
      <div
        className="relative flex items-center justify-center transition-all duration-200"
        style={{ width, height }}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-full h-full text-primary"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Futuristic Robot/Agent Icon */}
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v4" />
          <line x1="8" y1="16" x2="8" y2="16" />
          <line x1="16" y1="16" x2="16" y2="16" />
          <path d="M7 21l-1 2" />
          <path d="M17 21l1 2" />
          <path d="M2 13l-1-1" />
          <path d="M22 13l1-1" />
        </svg>
      </div>
      {showText && (
        <span
          className={`font-bold text-foreground tracking-tight transition-colors duration-200 group-hover:text-primary ${textSize}`}
        >
          Randi
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}
