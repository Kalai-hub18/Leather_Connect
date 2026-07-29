import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge, StatusBadge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAsync } from '../hooks/useAsync';
import { applicationsApi, jobsApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { humanize } from '../api/types';

export function AlumniEndorse() {
  const jobs = useAsync(() => jobsApi.published(), []);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [endorsing, setEndorsing] = useState<{ id: string; name: string } | null>(null);
  const { notify } = useToast();

  const jobList = jobs.data ?? [];
  const activeJobId = selectedJobId || jobList[0]?.id || '';

  const applicants = useAsync(
    () => (activeJobId ? applicationsApi.forJob(activeJobId) : Promise.resolve([])),
    [activeJobId],
  );

  const rows = applicants.data ?? [];

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Endorse a Candidate</h1>
          <p className="page-sub">
            Your endorsement sits alongside the application when the recruiter reviews it.
          </p>
        </div>
      </div>

      <AsyncBlock
        loading={jobs.loading}
        error={jobs.error}
        empty={jobList.length === 0}
        emptyMessage="No open drives at your college right now."
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

        <Card padded={false}>
          <AsyncBlock
            loading={applicants.loading}
            error={applicants.error}
            empty={rows.length === 0}
            emptyMessage="No applicants on this drive yet."
            onRetry={applicants.reload}
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 'var(--space-5)' }}>Candidate</th>
                    <th>Batch</th>
                    <th>Stage</th>
                    <th>Endorsement</th>
                    <th style={{ paddingRight: 'var(--space-5)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const endorsed = row.recommendations.length > 0;
                    return (
                      <tr key={row.id}>
                        <td className="cell-primary" style={{ paddingLeft: 'var(--space-5)' }}>
                          {row.student.user.fullName}
                        </td>
                        <td className="mono cell-muted">{row.student.batchYear}</td>
                        <td>
                          <StatusBadge status={humanize(row.status)} />
                        </td>
                        <td>
                          {endorsed ? (
                            <Badge tone="accent">{row.recommendations[0].alumni.fullName}</Badge>
                          ) : (
                            <span style={{ color: 'var(--text-faint)' }}>—</span>
                          )}
                        </td>
                        <td style={{ paddingRight: 'var(--space-5)', textAlign: 'right' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={endorsed}
                            onClick={() =>
                              setEndorsing({ id: row.id, name: row.student.user.fullName })
                            }
                          >
                            {endorsed ? 'Endorsed' : 'Endorse'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AsyncBlock>
        </Card>
      </AsyncBlock>

      {endorsing && (
        <EndorseForm
          applicationId={endorsing.id}
          candidateName={endorsing.name}
          onClose={() => setEndorsing(null)}
          onDone={async () => {
            setEndorsing(null);
            notify('Endorsement recorded', 'success');
            await applicants.reload();
          }}
        />
      )}
    </div>
  );
}

function EndorseForm({
  applicationId,
  candidateName,
  onClose,
  onDone,
}: {
  applicationId: string;
  candidateName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { notify } = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await applicationsApi.recommend(applicationId, note);
      onDone();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not endorse', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Endorse ${candidateName}`} onClose={onClose}>
      <form onSubmit={submit} className="login-form">
        <label className="field">
          <span>What should the recruiter know?</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            minLength={3}
            placeholder="Worked with them on a college tannery project — strong on process control."
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Sending…' : 'Endorse'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
