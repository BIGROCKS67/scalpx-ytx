import { withBasePath } from "@/lib/basePath";

const LOGO_SRC = withBasePath("/ytx-logo.png");

export function YtxLogoMark({
  className = "h-8 w-auto",
}: {
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={LOGO_SRC} alt="YTX" className={`object-contain shrink-0 ${className}`} />
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
