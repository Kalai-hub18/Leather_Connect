import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge, StatusBadge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { useToast } from '../components/Toast';
import { useAsync } from '../hooks/useAsync';
import { applicationsApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { humanize } from '../api/types';

const WITHDRAWABLE = new Set(['APPLIED', 'SCREENING']);

export function StudentApplications() {
  const { notify } = useToast();
  const apps = useAsync(() => applicationsApi.mine(), []);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function withdraw(id: string) {
    try {
      await applicationsApi.withdraw(id);
      notify('Application withdrawn', 'success');
      await apps.reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not withdraw', 'error');
    }
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Applications</h1>
          <p className="page-sub">Every stage is recorded with who changed it and when.</p>
        </div>
      </div>

      <AsyncBlock
        loading={apps.loading}
        error={apps.error}
        empty={(apps.data ?? []).length === 0}
        emptyMessage="You haven't applied to anything yet. Head to the Job Board."
        onRetry={apps.reload}
      >
        <div className="stack-sm">
          {(apps.data ?? []).map((app) => (
            <Card key={app.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{app.job.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {app.job.company?.name} · applied {new Date(app.appliedAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  {app.resultPending ? (
                    <Badge tone="warning">Result under review</Badge>
                  ) : (
                    <StatusBadge status={humanize(app.status)} />
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setExpanded(expanded === app.id ? null : app.id)}
                  >
                    {expanded === app.id ? 'Hide timeline' : 'Timeline'}
                  </button>
                  {WITHDRAWABLE.has(app.status) && (
                    <button className="btn btn-danger-outline btn-sm" onClick={() => withdraw(app.id)}>
                      Withdraw
                    </button>
                  )}
                </div>
              </div>

              {expanded === app.id && (
                <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)' }}>
                  {app.resultPending && (
                    <div
                      style={{
                        background: 'var(--warning-wash)',
                        color: 'var(--warning)',
                        borderRadius: 'var(--radius-sm)',
                        padding: 'var(--space-3)',
                        fontSize: '0.8rem',
                        marginBottom: 'var(--space-3)',
                      }}
                    >
                      Your latest round has been assessed. The placement officer is reviewing the
                      results before they're shared.
                    </div>
                  )}
                  {app.history.map((h) => (
                    <div key={h.id} className="card-list-row">
                      <div style={{ fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--text-faint)' }}>
                          {h.fromStatus ? humanize(h.fromStatus) : 'Submitted'}
                        </span>
                        <span style={{ color: 'var(--text-faint)' }}> → </span>
                        <span style={{ fontWeight: 600 }}>{humanize(h.toStatus)}</span>
                        {h.note && (
                          <span style={{ color: 'var(--text-faint)' }}> · {h.note}</span>
                        )}
                      </div>
                      <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                        {new Date(h.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </AsyncBlock>
    </div>
  );
}
