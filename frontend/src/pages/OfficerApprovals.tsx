import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAsync } from '../hooks/useAsync';
import { jobsApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { humanize } from '../api/types';

export function OfficerApprovals() {
  const { notify } = useToast();
  const queue = useAsync(() => jobsApi.pendingApproval(), []);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function approve(jobId: string) {
    setBusy(jobId);
    try {
      const result = await jobsApi.approve(jobId);
      notify(
        `Published — ${result.eligibleCount} eligible student${result.eligibleCount === 1 ? '' : 's'} matched`,
        'success',
      );
      await queue.reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not approve', 'error');
    } finally {
      setBusy(null);
    }
  }

  const jobs = queue.data ?? [];

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Job Approvals</h1>
          <p className="page-sub">
            Approving publishes the posting and notifies every eligible student in your department.
          </p>
        </div>
        <Badge tone={jobs.length ? 'warning' : 'success'}>
          {jobs.length ? `${jobs.length} awaiting` : 'All clear'}
        </Badge>
      </div>

      <AsyncBlock
        loading={queue.loading}
        error={queue.error}
        empty={jobs.length === 0}
        emptyMessage="Nothing waiting for review."
        onRetry={queue.reload}
      >
        <div className="stack-sm">
          {jobs.map((job) => {
            const e = job.eligibility;
            return (
              <Card key={job.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 300 }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 6 }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{job.title}</h3>
                      <Badge tone="neutral">{humanize(job.type)}</Badge>
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      {job.company?.name}
                      {job.location ? ` · ${job.location}` : ''}
                      {job.packageLpa ? ` · ₹${job.packageLpa}L` : ''}
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 'var(--space-3) 0 0', lineHeight: 1.5 }}>
                      {job.description}
                    </p>

                    <div style={{ marginTop: 'var(--space-4)' }}>
                      <div className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Eligibility rules</div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        {e?.minCgpa && <Badge tone="neutral">CGPA ≥ {e.minCgpa}</Badge>}
                        {e?.maxBacklogs != null && (
                          <Badge tone="neutral">
                            {e.maxBacklogs === 0 ? 'No backlogs' : `≤ ${e.maxBacklogs} backlogs`}
                          </Badge>
                        )}
                        {e?.batchYears?.map((y) => <Badge key={y} tone="neutral">Batch {y}</Badge>)}
                        {e?.requiredSkills?.map((s) => <Badge key={s} tone="accent">{s}</Badge>)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-faint)' }}>
                      Closes {new Date(job.deadline).toLocaleDateString()}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button className="btn btn-danger-outline" onClick={() => setRejecting(job.id)}>
                        Request changes
                      </button>
                      <button
                        className="btn btn-success"
                        disabled={busy === job.id}
                        onClick={() => approve(job.id)}
                      >
                        {busy === job.id ? 'Publishing…' : 'Approve & publish'}
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </AsyncBlock>

      {rejecting && (
        <RejectForm
          jobId={rejecting}
          onClose={() => setRejecting(null)}
          onDone={async () => {
            setRejecting(null);
            notify('Sent back to the recruiter', 'success');
            await queue.reload();
          }}
        />
      )}
    </div>
  );
}

function RejectForm({
  jobId,
  onClose,
  onDone,
}: {
  jobId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { notify } = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await jobsApi.reject(jobId, reason);
      onDone();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not send it back', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Request changes" onClose={onClose}>
      <form onSubmit={submit} className="login-form">
        <label className="field">
          <span>What needs to change?</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
            placeholder="The CGPA cut-off excludes most of the batch — please reconsider."
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Sending…' : 'Send back'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
