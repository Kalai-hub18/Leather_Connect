import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { useAsync } from '../hooks/useAsync';
import { applicationsApi, jobsApi } from '../api/endpoints';

type Filter = 'all' | 'applied' | 'pending';

export function CellRoster() {
  const jobs = useAsync(() => jobsApi.published(), []);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [filter, setFilter] = useState<Filter>('pending');

  const jobList = jobs.data ?? [];
  const activeJobId = selectedJobId || jobList[0]?.id || '';

  const roster = useAsync(
    () => (activeJobId ? applicationsApi.roster(activeJobId) : Promise.resolve([])),
    [activeJobId],
  );

  const rows = roster.data ?? [];
  const applied = rows.filter((r) => r.hasApplied);
  const pending = rows.filter((r) => !r.hasApplied);

  const visible = filter === 'applied' ? applied : filter === 'pending' ? pending : rows;
  const activeJob = jobList.find((j) => j.id === activeJobId);

  const daysLeft = activeJob
    ? Math.ceil((new Date(activeJob.deadline).getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Drive Roster</h1>
          <p className="page-sub">
            Who has and hasn't applied, so you can chase the stragglers before the deadline.
          </p>
        </div>
      </div>

      <AsyncBlock
        loading={jobs.loading}
        error={jobs.error}
        empty={jobList.length === 0}
        emptyMessage="No open drives right now."
        onRetry={jobs.reload}
      >
        <label className="field" style={{ maxWidth: 460 }}>
          <span>Drive</span>
          <select value={activeJobId} onChange={(e) => setSelectedJobId(e.target.value)}>
            {jobList.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} — {j.company?.name}
              </option>
            ))}
          </select>
        </label>

        <div className="stat-grid">
          <div className="stat-tile">
            <div className="stat-label">Eligible Students</div>
            <div className="stat-value mono">{rows.length}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Applied</div>
            <div className="stat-value mono">{applied.length}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Yet to Apply</div>
            <div className="stat-value mono">{pending.length}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Deadline</div>
            <div className="stat-value mono">
              {daysLeft === null ? '—' : daysLeft > 0 ? `${daysLeft}d` : 'Closed'}
            </div>
          </div>
        </div>

        <Card padded={false}>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              padding: 'var(--space-4) var(--space-5)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            {(
              [
                ['pending', `Yet to apply (${pending.length})`],
                ['applied', `Applied (${applied.length})`],
                ['all', `Everyone (${rows.length})`],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <AsyncBlock
            loading={roster.loading}
            error={roster.error}
            empty={visible.length === 0}
            emptyMessage={
              filter === 'pending'
                ? 'Everyone eligible has applied.'
                : 'Nobody here yet.'
            }
            onRetry={roster.reload}
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 'var(--space-5)' }}>Roll No.</th>
                    <th>Student</th>
                    <th>Batch</th>
                    <th style={{ paddingRight: 'var(--space-5)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.studentProfileId}>
                      <td className="mono cell-muted" style={{ paddingLeft: 'var(--space-5)' }}>
                        {r.rollNumber}
                      </td>
                      <td className="cell-primary">{r.fullName}</td>
                      <td className="mono cell-muted">{r.batchYear}</td>
                      <td style={{ paddingRight: 'var(--space-5)' }}>
                        {r.hasApplied ? (
                          <Badge tone="success">Applied</Badge>
                        ) : (
                          <Badge tone="warning">Yet to apply</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncBlock>
        </Card>

        <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)', margin: 0 }}>
          Marks, resumes and interview outcomes aren't shown here — those stay with the placement
          officer.
        </p>
      </AsyncBlock>
    </div>
  );
}
