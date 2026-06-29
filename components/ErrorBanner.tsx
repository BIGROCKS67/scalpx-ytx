export default function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-100 flex items-center gap-2"
    >
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-rose-300 hover:text-white shrink-0 px-1"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
