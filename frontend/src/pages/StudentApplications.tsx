import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { useToast } from '../components/Toast';
import { useAsync } from '../hooks/useAsync';
import { applicationsApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { humanize, type Application, type ApplicationStatus } from '../api/types';

/** The pipeline as students see it — interview rounds collapse into one node. */
const STAGES: { key: string; label: string; matches: ApplicationStatus[] }[] = [
  { key: 'applied', label: 'Applied', matches: ['APPLIED'] },
  { key: 'screening', label: 'Screening', matches: ['SCREENING'] },
  { key: 'shortlisted', label: 'Shortlisted', matches: ['SHORTLISTED'] },
  {
    key: 'interview',
    label: 'Interviews',
    matches: ['WRITTEN_TEST', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW'],
  },
  { key: 'offer', label: 'Offer', matches: ['SELECTED', 'JOINED'] },
];

const CLOSED: ApplicationStatus[] = ['REJECTED', 'WITHDRAWN', 'JOINED'];
const WITHDRAWABLE: ApplicationStatus[] = ['APPLIED', 'SCREENING'];

type Filter = 'active' | 'closed' | 'all';

export function StudentApplications() {
  const { notify } = useToast();
  const apps = useAsync(() => applicationsApi.mine(), []);
  const [filter, setFilter] = useState<Filter>('active');

  const all = apps.data ?? [];
  const active = all.filter((a) => !CLOSED.includes(a.status));
  const closed = all.filter((a) => CLOSED.includes(a.status));

  const visible = useMemo(
    () => (filter === 'active' ? active : filter === 'closed' ? closed : all),
    [filter, all, active, closed],
  );

  async function withdraw(id: string) {
    try {
      await applicationsApi.withdraw(id);
      notify('Application withdrawn', 'success');
      await apps.reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not withdraw', 'error');
    }
  }

  const offers = all.filter((a) => a.status === 'SELECTED' || a.status === 'JOINED').length;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Applications</h1>
          <p className="page-sub">
            {all.length} application{all.length === 1 ? '' : 's'} · {active.length} still in play
            {offers > 0 && ` · ${offers} offer${offers === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      <div className="toolbar">
        <div className="filter-group">
          {(
            [
              ['active', 'In play', active.length],
              ['closed', 'Closed', closed.length],
              ['all', 'Everything', all.length],
            ] as [Filter, string, number][]
          ).map(([key, label, count]) => (
            <button
              key={key}
              className={`filter-pill${filter === key ? ' active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
              <span className="filter-count">{count}</span>
            </button>
          ))}
        </div>
      </div>

      <AsyncBlock
        loading={apps.loading}
        error={apps.error}
        empty={visible.length === 0}
        emptyIcon="file"
        emptyTitle={
          all.length === 0
            ? 'No applications yet'
            : filter === 'active'
              ? 'Nothing in play'
              : 'Nothing closed'
        }
        emptyMessage={
          all.length === 0
            ? 'Once you apply to a drive, every stage it moves through shows up here.'
            : filter === 'active'
              ? 'All your applications have been closed out.'
              : "You haven't had an application closed yet."
        }
        emptyAction={
          all.length === 0 ? (
            <Link to="/student/jobs" className="btn btn-primary btn-sm">
              Browse the job board
            </Link>
          ) : undefined
        }
        onRetry={apps.reload}
      >
        <div className="stack-sm">
          {visible.map((app) => (
            <ApplicationCard key={app.id} app={app} onWithdraw={() => withdraw(app.id)} />
          ))}
        </div>
      </AsyncBlock>
    </div>
  );
}

function ApplicationCard({
  app,
  onWithdraw,
}: {
  app: Application;
  onWithdraw: () => void;
}) {
  const rejected = app.status === 'REJECTED';
  const withdrawn = app.status === 'WITHDRAWN';

  // Walk the ledger once and pin each stage to the entry that reached it —
  // the rail then carries the dates and notes itself, so there's no separate
  // history list repeating the same transitions.
  const reached = new Map<string, { date: string; note: string | null }>();

  for (const h of [...app.history].reverse()) {
    const stage = STAGES.find((s) => s.matches.includes(h.toStatus));
    if (!stage) continue;
    // Later entries win, so a second interview round updates the node.
    reached.set(stage.key, { date: h.createdAt, note: h.note });
  }

  const currentIndex = STAGES.reduce(
    (furthest, s, i) => (reached.has(s.key) ? i : furthest),
    0,
  );

  const rejectionNote = rejected
    ? (app.history.find((h) => h.toStatus === 'REJECTED')?.note ?? null)
    : null;

  return (
    <div className="app-card">
      <div className="app-card-head">
        <div className="app-logo">{app.job.company?.name.charAt(0) ?? '?'}</div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', letterSpacing: '-0.01em' }}>
            {app.job.title}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {app.job.company?.name} · applied{' '}
            {new Date(app.appliedAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
            })}
            {app.job.packageLpa ? ` · ₹${app.job.packageLpa} LPA` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          {app.resultPending ? (
            <Badge tone="warning">Under review</Badge>
          ) : rejected ? (
            <Badge tone="critical">Not selected</Badge>
          ) : withdrawn ? (
            <Badge tone="neutral">Withdrawn</Badge>
          ) : app.status === 'SELECTED' || app.status === 'JOINED' ? (
            <Badge tone="success">{humanize(app.status)}</Badge>
          ) : (
            <Badge tone="accent">{humanize(app.status)}</Badge>
          )}

          {WITHDRAWABLE.includes(app.status) && (
            <button className="btn btn-secondary btn-sm" onClick={onWithdraw}>
              Withdraw
            </button>
          )}
        </div>
      </div>

      {!withdrawn && (
        <>
          <div className="stage-rail">
            {STAGES.map((stage, i) => {
              const done = i < currentIndex;
              const current = i === currentIndex;
              const failedHere = rejected && current;

              return (
                <div key={stage.key} className="stage-node">
                  <div
                    className={`stage-pip${
                      failedHere ? ' failed' : done ? ' done' : current ? ' current' : ''
                    }`}
                  >
                    {done && !failedHere && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                    {failedHere && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  {i < STAGES.length - 1 && (
                    <div className={`stage-line${done ? ' done' : ''}`} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="stage-labels">
            {STAGES.map((s, i) => {
              const hit = reached.get(s.key);
              const failedHere = rejected && i === currentIndex;

              return (
                <span
                  key={s.key}
                  className={`stage-label${hit ? ' reached' : ''}${
                    failedHere ? ' failed' : i === currentIndex ? ' current' : ''
                  }`}
                >
                  <span className="stage-label-name">
                    {failedHere ? 'Not selected' : s.label}
                  </span>
                  {hit && (
                    <span className="stage-label-date">
                      {new Date(hit.date).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}
                  {(failedHere ? rejectionNote : hit?.note) && (
                    <span className="stage-label-note">
                      {failedHere ? rejectionNote : hit?.note}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </>
      )}

      {app.resultPending && (
        <div className="app-timeline">
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              alignItems: 'center',
              fontSize: '0.8125rem',
              color: 'var(--warning)',
            }}
          >
            <span className="badge badge-warning">Under review</span>
            Your latest round has been assessed. The placement officer is reviewing the results
            before they're shared.
          </div>
        </div>
      )}
    </div>
  );
}
