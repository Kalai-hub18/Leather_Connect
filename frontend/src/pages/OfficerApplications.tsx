import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge, StatusBadge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { useAsync } from '../hooks/useAsync';
import { applicationsApi, jobsApi } from '../api/endpoints';
import { humanize } from '../api/types';

/**
 * Oversight only. Recruiters screen and shortlist their own candidates — the
 * officer's gate is on job approval and on releasing results, not here.
 */
export function OfficerApplications() {
  const jobs = useAsync(() => jobsApi.published(), []);
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  const jobList = jobs.data ?? [];
  const activeJobId = selectedJobId || jobList[0]?.id || '';

  const applicants = useAsync(
    () => (activeJobId ? applicationsApi.forJob(activeJobId) : Promise.resolve([])),
    [activeJobId],
  );

  const rows = applicants.data ?? [];

  const stageCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Drive Progress</h1>
          <p className="page-sub">
            Where every applicant stands. Recruiters run their own shortlisting — you step in at
            job approval and when results are released.
          </p>
        </div>
      </div>

      <AsyncBlock
        loading={jobs.loading}
        error={jobs.error}
        empty={jobList.length === 0}
        emptyMessage="No published drives yet."
        onRetry={jobs.reload}
      >
        <label className="field" style={{ maxWidth: 420 }}>
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
            <div className="stat-label">Applicants</div>
            <div className="stat-value mono">{rows.length}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Shortlisted</div>
            <div className="stat-value mono">{stageCounts.SHORTLISTED ?? 0}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">In Interview</div>
            <div className="stat-value mono">
              {(stageCounts.WRITTEN_TEST ?? 0) +
                (stageCounts.TECHNICAL_INTERVIEW ?? 0) +
                (stageCounts.HR_INTERVIEW ?? 0)}
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Selected</div>
            <div className="stat-value mono">
              {(stageCounts.SELECTED ?? 0) + (stageCounts.JOINED ?? 0)}
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Rejected</div>
            <div className="stat-value mono">{stageCounts.REJECTED ?? 0}</div>
          </div>
        </div>

        <Card padded={false}>
          <AsyncBlock
            loading={applicants.loading}
            error={applicants.error}
            empty={rows.length === 0}
            emptyMessage="No applications for this drive yet."
            onRetry={applicants.reload}
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 'var(--space-5)' }}>Candidate</th>
                    <th>CGPA</th>
                    <th>Backlogs</th>
                    <th>Endorsed</th>
                    <th>Applied</th>
                    <th style={{ paddingRight: 'var(--space-5)' }}>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ paddingLeft: 'var(--space-5)' }}>
                        <div className="cell-primary">{row.student.user.fullName}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-faint)' }}>
                          {row.student.rollNumber} · {row.student.skills.join(', ')}
                        </div>
                      </td>
                      <td className="mono">{row.cgpaSnapshot}</td>
                      <td className="mono cell-muted">{row.student.activeBacklogs}</td>
                      <td>
                        {row.recommendations.length > 0 ? (
                          <Badge tone="accent">{row.recommendations[0].alumni.fullName}</Badge>
                        ) : (
                          <span style={{ color: 'var(--text-faint)' }}>—</span>
                        )}
                      </td>
                      <td className="mono cell-muted">
                        {new Date(row.appliedAt).toLocaleDateString()}
                      </td>
                      <td style={{ paddingRight: 'var(--space-5)' }}>
                        <StatusBadge status={humanize(row.status)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncBlock>
        </Card>
      </AsyncBlock>
    </div>
  );
}
