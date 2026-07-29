import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { useToast } from '../components/Toast';
import { useAsync } from '../hooks/useAsync';
import { applicationsApi, jobsApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { humanize } from '../api/types';

export function StudentJobs() {
  const { notify } = useToast();
  const jobs = useAsync(() => jobsApi.published(), []);
  const mine = useAsync(() => applicationsApi.mine(), []);
  const [applying, setApplying] = useState<string | null>(null);

  const appliedJobIds = new Set((mine.data ?? []).map((a) => a.job.id));

  async function apply(jobId: string) {
    setApplying(jobId);
    try {
      await applicationsApi.apply(jobId);
      notify('Application submitted', 'success');
      await mine.reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not apply', 'error');
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Job Board</h1>
          <p className="page-sub">
            Openings matched against your CGPA, backlogs, department and batch year.
          </p>
        </div>
      </div>

      <AsyncBlock
        loading={jobs.loading}
        error={jobs.error}
        empty={(jobs.data ?? []).length === 0}
        emptyMessage="No published openings right now. Check back once a drive opens."
        onRetry={jobs.reload}
      >
        <div className="stack-sm">
          {(jobs.data ?? []).map((job) => {
            const already = appliedJobIds.has(job.id);
            const e = job.eligibility;
            const criteria = [
              e?.minCgpa ? `CGPA ≥ ${e.minCgpa}` : null,
              e?.maxBacklogs === 0 ? 'No active backlogs' : e?.maxBacklogs != null ? `≤ ${e.maxBacklogs} backlogs` : null,
              e?.batchYears?.length ? `Batch ${e.batchYears.join(', ')}` : null,
              e?.requiredSkills?.length ? `Skills: ${e.requiredSkills.join(', ')}` : null,
            ].filter(Boolean);

            return (
              <Card key={job.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 6 }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{job.title}</h3>
                      <Badge tone="neutral">{humanize(job.type)}</Badge>
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                      {job.company?.name}
                      {job.location ? ` · ${job.location}` : ''}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>
                      {criteria.length ? criteria.join(' · ') : 'Open to all placement-ready students'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-2)', minWidth: 170 }}>
                    <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                      {job.packageLpa ? `₹${job.packageLpa}L` : job.stipend ?? '—'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-faint)' }}>
                      Closes {new Date(job.deadline).toLocaleDateString()}
                      {job._count ? ` · ${job._count.applications} applied` : ''}
                    </div>
                    <button
                      className={`btn ${already ? 'btn-secondary' : 'btn-primary'}`}
                      disabled={already || applying === job.id}
                      onClick={() => apply(job.id)}
                    >
                      {already ? 'Applied' : applying === job.id ? 'Applying…' : 'Apply'}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </AsyncBlock>
    </div>
  );
}
