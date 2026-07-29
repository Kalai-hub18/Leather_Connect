export function Card({
  title,
  subtitle,
  action,
  children,
  padded = true,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={`card${padded ? ' card-pad' : ''}`}>
      {title && (
        <header className="card-header">
          <div>
            <div className="card-title">{title}</div>
            {subtitle && <div className="card-title-sub">{subtitle}</div>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  delta,
  trend = 'flat',
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
}) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value mono">{value}</div>
      {delta && <div className={`stat-delta ${trend}`}>{delta}</div>}
    </div>
  );
}
