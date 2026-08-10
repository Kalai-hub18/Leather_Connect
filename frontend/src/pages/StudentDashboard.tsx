import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { Badge, StatusBadge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { Icon } from '../components/Icon';
import { useAsync } from '../hooks/useAsync';
import { analyticsApi, applicationsApi } from '../api/endpoints';
import { humanize, type ApplicationStatus } from '../api/types';
import { useAuth } from '../auth/AuthContext';

/** How far along the fixed pipeline each stage sits, for the progress dots. */
const STAGE_INDEX: Record<string, number> = {
  APPLIED: 1,
  SCREENING: 2,
  SHORTLISTED: 3,
  WRITTEN_TEST: 4,
  TECHNICAL_INTERVIEW: 4,
  HR_INTERVIEW: 5,
  SELECTED: 6,
  JOINED: 6,
};

const PIPELINE_LENGTH = 6;

const CLOSED: ApplicationStatus[] = ['REJECTED', 'WITHDRAWN', 'JOINED'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function StudentDashboard() {
  const { user } = useAuth();
  const overview = useAsync(() => analyticsApi.student(), []);
  const apps = useAsync(() => applicationsApi.mine(), []);

  const d = overview.data;
  const firstName = user?.fullName.split(' ')[0] ?? 'there';

  const live = (apps.data ?? []).filter((a) => !CLOSED.includes(a.status));
  const recent = (apps.data ?? []).slice(0, 5);

  return (
    <div className="stack">
      <AsyncBlock loading={overview.loading} error={overview.error} onRetry={overview.reload}>
        {d && (
          <>
            <div className="hero-panel">
              <div>
                <div className="hero-greeting">
                  {greeting()}, {firstName}.
                </div>
                <p className="hero-sub">
                  {d.applications.total === 0
                    ? `${d.openDrives} drive${d.openDrives === 1 ? '' : 's'} open right now. Nothing applied to yet — the job board is the place to start.`
                    : d.upcoming.length > 0
                      ? `You have ${d.upcoming.length} interview${d.upcoming.length === 1 ? '' : 's'} coming up and ${d.applications.active} application${d.applications.active === 1 ? '' : 's'} still in play.`
                      : `${d.applications.active} application${d.applications.active === 1 ? '' : 's'} in play. Nothing scheduled — you'll be told the moment a round is set.`}
                </p>
              </div>

              {!d.placementReady ? (
                <Link to="/student/profile" className="btn btn-primary">
                  Finish your profile
                </Link>
              ) : (
                <Link to="/student/jobs" className="btn btn-primary">
                  Browse drives
                </Link>
              )}
            </div>

            {!d.placementReady && (
              <Card>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--space-3)',
                    alignItems: 'flex-start',
                  }}
                >
                  <div className="metric-icon warning">
                    <Icon name="user" size={17} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>
                      You can't apply yet
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      Your placement officer approves your profile before applications open up. You
                      can still browse everything in the meantime.
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <div className="stat-grid">
              <Link to="/student/jobs" className="metric">
                <div className="metric-top">
                  <span className="metric-value mono">{d.openDrives}</span>
                  <span className="metric-icon accent">
                    <Icon name="briefcase" size={17} />
                  </span>
                </div>
                <div>
                  <div className="metric-label">Open drives</div>
                  <div className="metric-hint">Matched to your profile</div>
                </div>
              </Link>

              <Link to="/student/applications" className="metric">
                <div className="metric-top">
                  <span className="metric-value mono">{d.applications.active}</span>
                  <span className="metric-icon neutral">
                    <Icon name="file" size={17} />
                  </span>
                </div>
                <div>
                  <div className="metric-label">In play</div>
                  <div className="metric-hint">{d.applications.total} applied in total</div>
                </div>
              </Link>

              <div className="metric">
                <div className="metric-top">
                  <span className="metric-value mono">{d.applications.interviewing}</span>
                  <span className="metric-icon warning">
                    <Icon name="users" size={17} />
                  </span>
                </div>
                <div>
                  <div className="metric-label">Interviewing</div>
                  <div className="metric-hint">Reached a round</div>
                </div>
              </div>

              <div className="metric">
                <div className="metric-top">
                  <span className="metric-value mono">{d.applications.offers}</span>
                  <span className="metric-icon success">
                    <Icon name="check" size={17} />
                  </span>
                </div>
                <div>
                  <div className="metric-label">Offers</div>
                  <div className="metric-hint">
                    {d.applications.offers > 0 ? 'Congratulations' : 'None yet'}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid-2">
              <Card
                title="Where you stand"
                subtitle="Live applications and how far each has moved"
                action={
                  <Link to="/student/applications" className="link" style={{ fontSize: '0.8125rem' }}>
                    See all
                  </Link>
                }
              >
                <AsyncBlock
                  loading={apps.loading}
                  error={apps.error}
                  empty={live.length === 0}
                  emptyIcon="file"
                  emptyTitle="Nothing in play"
                  emptyMessage="Apply to a drive and you'll be able to track it from here."
                  emptyAction={
                    <Link to="/student/jobs" className="btn btn-primary btn-sm">
                      Browse drives
                    </Link>
                  }
                  onRetry={apps.reload}
                >
                  <div>
                    {live.map((a) => {
                      const reached = STAGE_INDEX[a.status] ?? 1;
                      return (
                        <div key={a.id} className="pipeline-row">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {a.job.title}
                            </div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                              {a.job.company?.name}
                            </div>
                          </div>

                          <div className="pipeline-dots" aria-hidden="true">
                            {Array.from({ length: PIPELINE_LENGTH }, (_, i) => (
                              <span
                                key={i}
                                className={`pipeline-dot${i < reached ? ' filled' : ''}`}
                              />
                            ))}
                          </div>

                          {a.resultPending ? (
                            <Badge tone="warning">Under review</Badge>
                          ) : (
                            <StatusBadge status={humanize(a.status)} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </AsyncBlock>
              </Card>

              <Card title="Coming up" subtitle="Interviews already scheduled">
                {d.upcoming.length === 0 ? (
                  <div className="empty-state" style={{ padding: 'var(--space-6) var(--space-4)' }}>
                    <div className="empty-state-icon">
                      <Icon name="users" size={20} />
                    </div>
                    <div className="empty-state-title">Nothing scheduled</div>
                    <div className="empty-state-body">
                      Once a recruiter sets a round, the date and venue land here and in your
                      notifications.
                    </div>
                  </div>
                ) : (
                  <div className="timeline">
                    {d.upcoming.map((u, i) => {
                      const date = new Date(u.scheduledAt);
                      return (
                        <div key={i} className="timeline-item">
                          <div className="timeline-date">
                            <div className="timeline-day mono">{date.getDate()}</div>
                            <div className="timeline-month">
                              {date.toLocaleString(undefined, { month: 'short' })}
                            </div>
                          </div>
                          <div className="timeline-body">
                            <div className="timeline-title">{u.jobTitle}</div>
                            <div className="timeline-meta">
                              {u.company} · Round {u.sequence} · {humanize(u.type)}
                            </div>
                            <div className="timeline-meta">
                              {date.toLocaleTimeString(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                              {u.where ? ` · ${u.where}` : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {recent.length > 0 && (
              <Card title="Recent activity" subtitle="The latest change on each application">
                <div>
                  {recent.map((a) => {
                    const latest = a.history[0];
                    if (!latest) return null;
                    return (
                      <div key={a.id} className="card-list-row">
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.875rem' }}>
                            <strong>{a.job.company?.name}</strong>
                            <span style={{ color: 'var(--text-muted)' }}> · {a.job.title}</span>
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            {latest.fromStatus
                              ? `Moved to ${humanize(latest.toStatus).toLowerCase()}`
                              : 'Application submitted'}
                            {latest.note ? ` — ${latest.note}` : ''}
                          </div>
                        </div>
                        <span
                          className="mono"
                          style={{ fontSize: '0.75rem', color: 'var(--text-faint)', flexShrink: 0 }}
                        >
                          {new Date(latest.createdAt).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
