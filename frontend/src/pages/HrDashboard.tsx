import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { useAsync } from '../hooks/useAsync';
import { analyticsApi } from '../api/endpoints';
import { humanize } from '../api/types';

export function HrDashboard() {
  const overview = useAsync(() => analyticsApi.recruiter(), []);
  const d = overview.data;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hiring overview</h1>
          <p className="page-sub">Every drive you're running, across colleges.</p>
        </div>
        <Link to="/hr/jobs" className="btn btn-primary">
          Manage postings
        </Link>
      </div>

      <AsyncBlock loading={overview.loading} error={overview.error} onRetry={overview.reload}>
        {d && (
          <>
            {d.applications.needsAction > 0 && (
              <Card>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      <span className="mono">{d.applications.needsAction}</span> candidate
                      {d.applications.needsAction === 1 ? '' : 's'} waiting on you
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      Shortlist or pass on them so students aren't left guessing.
                    </div>
                  </div>
                  <Link to="/hr/jobs" className="btn btn-primary">
                    Open pipeline
                  </Link>
                </div>
              </Card>
            )}

            <div className="stat-grid">
              <div className="stat-tile">
                <div className="stat-label">Live Postings</div>
                <div className="stat-value mono">{d.jobs.published}</div>
                <div className="stat-delta flat">
                  {d.jobs.pendingApproval > 0
                    ? `${d.jobs.pendingApproval} awaiting approval`
                    : `${d.jobs.total} in total`}
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Applicants</div>
                <div className="stat-value mono">{d.applications.total}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Shortlisted</div>
                <div className="stat-value mono">{d.applications.shortlisted}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Selected</div>
                <div className="stat-value mono">{d.applications.selected}</div>
              </div>
            </div>

            <Card title="Upcoming rounds">
              {d.upcoming.length === 0 ? (
                <div className="state-block">
                  No interviews scheduled. Create a round once you've shortlisted.
                </div>
              ) : (
                <div className="stack-sm">
                  {d.upcoming.map((u, i) => (
                    <div key={i} className="card-list-row">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.jobTitle}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>
                          Round {u.sequence} · {humanize(u.type)} · {u.candidates} candidate
                          {u.candidates === 1 ? '' : 's'}
                          {u.where ? ` · ${u.where}` : ''}
                        </div>
                      </div>
                      <Badge tone="accent">
                        {new Date(u.scheduledAt).toLocaleString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
