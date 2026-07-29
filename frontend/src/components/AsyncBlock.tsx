export function AsyncBlock({
  loading,
  error,
  empty,
  emptyMessage = 'Nothing here yet.',
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  emptyMessage?: string;
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
      <div className="state-block error">
        <div className="state-title">Couldn't load this</div>
        <div>{error}</div>
        {onRetry && (
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-4)' }} onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }

  if (empty) {
    return <div className="state-block">{emptyMessage}</div>;
  }

  return <>{children}</>;
}
