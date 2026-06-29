export function YtxLogoMark({
  className = "h-8 w-auto",
}: {
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 42"
      fill="none"
      role="img"
      aria-label="YTX"
      className={`shrink-0 ${className}`}
    >
      <text
        x="0"
        y="34"
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
        fontSize="36"
        fontWeight="800"
        letterSpacing="-0.04em"
      >
        <tspan fill="#E6EBE6">YT</tspan>
        <tspan fill="#48FF9F">X</tspan>
      </text>
    </svg>
  );
}

export function YtxLogo({
  className = "",
  showTagline = false,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <YtxLogoMark className="h-7 sm:h-8 w-auto" />
      {showTagline ? (
        <p className="text-[9px] text-dim uppercase tracking-[0.2em] hidden sm:block">
          YouTube lifecycle
        </p>
      ) : null}
    </div>
  );
}
