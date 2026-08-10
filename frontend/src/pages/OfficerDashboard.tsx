import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { Icon } from '../components/Icon';
import { useAsync } from '../hooks/useAsync';
import { analyticsApi, interviewsApi } from '../api/endpoints';
import { humanize } from '../api/types';
import { useAuth } from '../auth/AuthContext';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function OfficerDashboard() {
  const { user } = useAuth();
  const overview = useAsync(() => analyticsApi.college(), []);
  const pending = useAsync(() => interviewsApi.awaitingRelease(), []);

  const d = overview.data;
  const overdue = (pending.data ?? []).filter((r) => r.overdue).length;

  const actions = d
    ? [
        {
          count: d.actionable.jobsAwaitingApproval,
          label: 'Job postings',
          hint: 'Waiting on your approval',
          to: '/officer/approvals',
          urgent: false,
        },
        {
          count: d.actionable.resultsAwaitingRelease,
          label: 'Interview results',
          hint: overdue > 0 ? `${overdue} over 48 hours` : 'Students are waiting',
          to: '/officer/results',
          urgent: overdue > 0,
        },
        {
          count: d.actionable.recruitersAwaitingApproval,
          label: 'Recruiter requests',
          hint: 'Companies wanting access',
          to: '/officer/recruiters',
          urgent: false,
        },
        {
          count: d.actionable.profilesAwaitingReview,
          label: 'Student profiles',
          hint: "They can't apply until you approve",
          to: '/officer/profiles',
          urgent: false,
        },
      ].filter((a) => a.count > 0)
    : [];

  const totalWaiting = actions.reduce((sum, a) => sum + a.count, 0);
  const lastName = user?.fullName.split(' ').slice(-1)[0] ?? '';

  return (
    <div className="stack">
      <AsyncBlock loading={overview.loading} error={overview.error} onRetry={overview.reload}>
        {d && (
          <>
            <div className="hero-panel">
              <div>
                <div className="hero-greeting">
                  {greeting()}, {lastName}.
                </div>
                <p className="hero-sub">
                  {totalWaiting === 0
                    ? `Nothing waiting on you. ${d.headline.activeDrives} drive${d.headline.activeDrives === 1 ? '' : 's'} running with ${d.headline.applications} application${d.headline.applications === 1 ? '' : 's'} in flight.`
                    : `${totalWaiting} thing${totalWaiting === 1 ? '' : 's'} need you today. ${d.headline.placed} of ${d.headline.placementReady} eligible students are placed so far.`}
                </p>
              </div>

              {overdue > 0 && <Badge tone="critical">{overdue} overdue</Badge>}
            </div>

            {actions.length > 0 && (
              <div className="action-queue">
                {actions.map((a) => (
                  <Link
                    key={a.to}
                    to={a.to}
                    className={`action-tile${a.urgent ? ' urgent' : ''}`}
                  >
                    <span className="action-tile-count">{a.count}</span>
                    <span>
                      <span className="action-tile-label">{a.label}</span>
                      <span className="action-tile-hint" style={{ display: 'block' }}>
                        {a.hint}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}

            <div className="stat-grid">
              <div className="metric">
                <div className="metric-top">
                  <span className="metric-value mono">{d.headline.placedPercent}%</span>
                  <span className="metric-icon success">
                    <Icon name="check" size={17} />
                  </span>
                </div>
                <div>
                  <div className="metric-label">Placed</div>
                  <div className="metric-hint">
                    {d.headline.placed} of {d.headline.placementReady} eligible
                  </div>
                </div>
              </div>

              <div className="metric">
                <div className="metric-top">
                  <span className="metric-value mono">{d.headline.activeDrives}</span>
                  <span className="metric-icon accent">
                    <Icon name="briefcase" size={17} />
                  </span>
                </div>
                <div>
                  <div className="metric-label">Active drives</div>
                  <div className="metric-hint">
                    {d.headline.applications} application
                    {d.headline.applications === 1 ? '' : 's'}
                  </div>
                </div>
              </div>

              <div className="metric">
                <div className="metric-top">
                  <span className="metric-value mono">
                    {d.packages.highest ? `₹${d.packages.highest}L` : '—'}
                  </span>
                  <span className="metric-icon neutral">
                    <Icon name="chart" size={17} />
                  </span>
                </div>
                <div>
                  <div className="metric-label">Highest package</div>
                  <div className="metric-hint">
                    {d.packages.average ? `₹${d.packages.average}L average` : 'No offers yet'}
                  </div>
                </div>
              </div>

              <div className="metric">
                <div className="metric-top">
                  <span className="metric-value mono">
                    {d.offerAcceptance === null ? '—' : `${d.offerAcceptance}%`}
                  </span>
                  <span className="metric-icon warning">
                    <Icon name="users" size={17} />
                  </span>
                </div>
                <div>
                  <div className="metric-label">Offer acceptance</div>
                  <div className="metric-hint">
                    {d.offerAcceptance === null ? 'No offers yet' : 'Of offers made'}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid-2">
              <Card
                title="Hiring funnel"
                subtitle="Everyone who ever reached each stage this season"
              >
                <Funnel stages={d.funnel} />
              </Card>

              <Card title="Top recruiters" subtitle="By offers made this season">
                {d.topCompanies.length === 0 ? (
                  <div className="empty-state" style={{ padding: 'var(--space-6) var(--space-4)' }}>
                    <div className="empty-state-icon">
                      <Icon name="building" size={20} />
                    </div>
                    <div className="empty-state-title">No offers yet</div>
                    <div className="empty-state-body">
                      This fills in once a recruiter selects someone.
                    </div>
                  </div>
                ) : (
                  <div>
                    {d.topCompanies.map((c, i) => {
                      const max = d.topCompanies[0].offers || 1;
                      return (
                        <div key={c.name} className="rank-row">
                          <span className="rank-num">{i + 1}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{c.name}</div>
                            <div className="rank-bar-track">
                              <div
                                className="rank-bar"
                                style={{ width: `${(c.offers / max) * 100}%` }}
                              />
                            </div>
                          </div>
                          <span className="mono" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                            {c.offers}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </AsyncBlock>
    </div>
  );
}

function Funnel({ stages }: { stages: { stage: string; count: number }[] }) {
  const top = stages[0]?.count ?? 0;

  if (top === 0) {
    return (
      <div className="empty-state" style={{ padding: 'var(--space-6) var(--space-4)' }}>
        <div className="empty-state-icon">
          <Icon name="chart" size={20} />
        </div>
        <div className="empty-state-title">No applications yet</div>
        <div className="empty-state-body">
          The funnel builds itself as students apply and move through drives.
        </div>
      </div>
    );
  }

  return (
    <div className="funnel">
      {stages.map((s, i) => {
        const previous = i > 0 ? stages[i - 1].count : null;
        // Drop-off is only meaningful when the stage above had anyone in it.
        const dropped = previous !== null && previous > 0 ? previous - s.count : 0;

        return (
          <div key={s.stage} className="funnel-stage">
            {i > 0 && dropped > 0 && (
              <div className="funnel-drop">
                <span className="funnel-drop-rule" />
                {dropped} dropped ({Math.round((dropped / previous!) * 100)}%)
              </div>
            )}

            <div className="funnel-bar-row">
              <span className="funnel-bar-label">{humanize(s.stage)}</span>
              <div className="funnel-bar-track">
                {s.count > 0 ? (
                  <div
                    className={`funnel-bar s${i}`}
                    style={{ width: `${Math.max((s.count / top) * 100, 6)}%` }}
                  >
                    {s.count}
                  </div>
                ) : (
                  <span className="funnel-empty">0</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
