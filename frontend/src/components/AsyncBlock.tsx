import { Icon } from './Icon';

export function AsyncBlock({
  loading,
  error,
  empty,
  emptyMessage = 'Nothing here yet.',
  emptyTitle,
  emptyIcon = 'file',
  emptyAction,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  emptyMessage?: string;
  emptyTitle?: string;
  emptyIcon?: string;
  emptyAction?: React.ReactNode;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ height: 56 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ color: 'var(--critical)' }}>
          <Icon name="file" size={20} />
        </div>
        <div className="empty-state-title">Couldn't load this</div>
        <div className="empty-state-body">{error}</div>
        {onRetry && (
          <button className="btn btn-secondary btn-sm" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Icon name={emptyIcon} size={20} />
        </div>
        {emptyTitle && <div className="empty-state-title">{emptyTitle}</div>}
        <div className="empty-state-body">{emptyMessage}</div>
        {emptyAction}
      </div>
    );
  }

  return <>{children}</>;
}
