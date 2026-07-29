import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { useToast } from '../components/Toast';
import { useAsync } from '../hooks/useAsync';
import { interviewsApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { humanize } from '../api/types';

export function OfficerResults() {
  const { notify } = useToast();
  const pending = useAsync(() => interviewsApi.awaitingRelease(), []);
  const [busy, setBusy] = useState<string | null>(null);

  async function release(roundId: string) {
    setBusy(roundId);
    try {
      await interviewsApi.release(roundId);
      notify('Results are now visible to students', 'success');
      await pending.reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not release', 'error');
    } finally {
      setBusy(null);
    }
  }

  const rounds = pending.data ?? [];
  const overdue = rounds.filter((r) => r.overdue).length;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Results to Release</h1>
          <p className="page-sub">
            Recruiters have finished these rounds. Students see "Under review" until you release —
            so they don't stay in the dark, anything waiting over 48 hours is flagged.
          </p>
        </div>
        {overdue > 0 && <Badge tone="critical">{overdue} overdue</Badge>}
      </div>

      <AsyncBlock
        loading={pending.loading}
        error={pending.error}
        empty={rounds.length === 0}
        emptyMessage="Nothing waiting. Every published result has been released."
        onRetry={pending.reload}
      >
        <div className="stack-sm">
          {rounds.map((r) => (
            <Card key={r.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-5)',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 6 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{r.jobTitle}</h3>
                    <Badge tone="neutral">
                      Round {r.sequence} · {humanize(r.type)}
                    </Badge>
                    {r.overdue && <Badge tone="critical">{r.hoursWaiting}h waiting</Badge>}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    {r.companyName} · finished {new Date(r.publishedAt).toLocaleString()}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                    <Badge tone="success">{r.advanced} advancing</Badge>
                    <Badge tone="critical">{r.rejected} rejected</Badge>
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  disabled={busy === r.id}
                  onClick={() => release(r.id)}
                >
                  {busy === r.id ? 'Releasing…' : 'Release to students'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      </AsyncBlock>
    </div>
  );
}
