import { AlertCircle, ArrowRight, Inbox } from "lucide-react";

export function LoadingState({ label = "Loading your workspace", compact = false }) {
  return (
    <div className={compact ? "loading-state loading-state-compact" : "loading-state"} role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title = "Nothing here yet",
  description = "Your items will appear here when you add them.",
  actionLabel,
  onAction,
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon"><Icon size={17} aria-hidden="true" /></span>
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && onAction && (
        <button type="button" className="text-button" onClick={onAction}>
          {actionLabel} <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}

export function ErrorState({
  title = "We couldn't load this",
  description = "Check your connection and try again.",
  onRetry,
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={17} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
        {onRetry && <button type="button" className="text-button" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  );
}
