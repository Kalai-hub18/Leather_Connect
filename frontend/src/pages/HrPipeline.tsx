import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { Badge, StatusBadge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAsync } from '../hooks/useAsync';
import { applicationsApi, interviewsApi, jobsApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { humanize, type InterviewRound, type InterviewRoundType } from '../api/types';

export function HrPipeline() {
  const { jobId } = useParams();
  const { notify } = useToast();

  const jobs = useAsync(() => jobsApi.mine(), []);
  const applicants = useAsync(() => (jobId ? applicationsApi.forJob(jobId) : Promise.resolve([])), [jobId]);
  const rounds = useAsync(() => (jobId ? interviewsApi.rounds(jobId) : Promise.resolve([])), [jobId]);

  const [showRoundForm, setShowRoundForm] = useState(false);
  const job = (jobs.data ?? []).find((j) => j.id === jobId);

  async function shortlist(applicationId: string, current: string) {
    try {
      // Screening is the mandatory stop between Applied and Shortlisted.
      if (current === 'APPLIED') {
        await applicationsApi.setStatus(applicationId, 'SCREENING');
      }
      await applicationsApi.setStatus(applicationId, 'SHORTLISTED', 'Shortlisted by HR');
      notify('Candidate shortlisted', 'success');
      await applicants.reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not shortlist', 'error');
    }
  }

  async function reject(applicationId: string) {
    try {
      await applicationsApi.setStatus(applicationId, 'REJECTED', 'Not taken forward');
      notify('Candidate rejected', 'success');
      await applicants.reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not reject', 'error');
    }
  }

  const rows = applicants.data ?? [];
  const counts = {
    total: rows.length,
    shortlisted: rows.filter((r) => r.status === 'SHORTLISTED').length,
    inInterview: rows.filter((r) =>
      ['WRITTEN_TEST', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW'].includes(r.status),
    ).length,
    selected: rows.filter((r) => ['SELECTED', 'JOINED'].includes(r.status)).length,
  };

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{job?.title ?? 'Applicant Pipeline'}</h1>
          <p className="page-sub">
            {job?.college?.name} · {counts.total} applicant{counts.total === 1 ? '' : 's'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowRoundForm(true)}>
          Create Interview Round
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="stat-label">Applicants</div>
          <div className="stat-value mono">{counts.total}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Shortlisted</div>
          <div className="stat-value mono">{counts.shortlisted}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">In Interview</div>
          <div className="stat-value mono">{counts.inInterview}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Selected</div>
          <div className="stat-value mono">{counts.selected}</div>
        </div>
      </div>

      <Card title="Applicants" padded={false}>
        <AsyncBlock
          loading={applicants.loading}
          error={applicants.error}
          empty={rows.length === 0}
          emptyMessage="No one has applied yet."
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
                  <th>Stage</th>
                  <th style={{ paddingRight: 'var(--space-5)' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ paddingLeft: 'var(--space-5)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div className="avatar">
                          {row.student.user.fullName
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')}
                        </div>
                        <div>
                          <div className="cell-primary">{row.student.user.fullName}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-faint)' }}>
                            {row.student.rollNumber} · Batch {row.student.batchYear}
                          </div>
                        </div>
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
                    <td>
                      <StatusBadge status={humanize(row.status)} />
                    </td>
                    <td style={{ paddingRight: 'var(--space-5)', textAlign: 'right' }}>
                      {['APPLIED', 'SCREENING'].includes(row.status) && (
                        <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                          <button className="btn btn-danger-outline btn-sm" onClick={() => reject(row.id)}>
                            Reject
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => shortlist(row.id, row.status)}
                          >
                            Shortlist
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncBlock>
      </Card>

      <AsyncBlock loading={rounds.loading} error={rounds.error} onRetry={rounds.reload}>
        {(rounds.data ?? []).map((round) => (
          <RoundCard
            key={round.id}
            round={round}
            onChanged={async () => {
              await Promise.all([rounds.reload(), applicants.reload()]);
            }}
          />
        ))}
      </AsyncBlock>

      {showRoundForm && jobId && (
        <RoundForm
          jobId={jobId}
          nextSequence={(rounds.data ?? []).length + 1}
          onClose={() => setShowRoundForm(false)}
          onCreated={async () => {
            setShowRoundForm(false);
            notify('Interview round created', 'success');
            await Promise.all([rounds.reload(), applicants.reload()]);
          }}
        />
      )}
    </div>
  );
}

function RoundCard({ round, onChanged }: { round: InterviewRound; onChanged: () => Promise<void> }) {
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const published = Boolean(round.resultsPublishedAt);

  async function setOutcome(applicationId: string, outcome: 'ADVANCED' | 'REJECTED') {
    try {
      await interviewsApi.recordResult(round.id, applicationId, {
        attendance: 'PRESENT',
        outcome,
        rating: outcome === 'ADVANCED' ? 4 : 2,
      });
      notify('Feedback recorded', 'success');
      await onChanged();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not record feedback', 'error');
    }
  }

  async function markAbsent(applicationId: string) {
    try {
      await interviewsApi.recordResult(round.id, applicationId, {
        attendance: 'ABSENT',
        outcome: 'REJECTED',
      });
      notify('Marked absent', 'success');
      await onChanged();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not mark absent', 'error');
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const summary = await interviewsApi.publish(round.id);
      notify(`Published — ${summary.advanced} advanced, ${summary.rejected} rejected`, 'success');
      await onChanged();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not publish', 'error');
    } finally {
      setBusy(false);
    }
  }

  const allDecided = round.results.every((r) => r.outcome !== 'PENDING');

  return (
    <Card
      title={`Round ${round.sequence} · ${humanize(round.type)}`}
      subtitle={`${new Date(round.scheduledAt).toLocaleString()}${round.venue ? ` · ${round.venue}` : ''}`}
      action={
        published ? (
          round.resultsReleasedAt ? (
            <Badge tone="success">Released to students</Badge>
          ) : (
            <Badge tone="warning">Awaiting officer release</Badge>
          )
        ) : (
          <button className="btn btn-primary btn-sm" disabled={!allDecided || busy} onClick={publish}>
            {busy ? 'Publishing…' : 'Publish results'}
          </button>
        )
      }
    >
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Attendance</th>
              <th>Outcome</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {round.results.map((r) => (
              <tr key={r.id}>
                <td className="cell-primary">{r.application.student.user.fullName}</td>
                <td className="cell-muted">{humanize(r.attendance)}</td>
                <td>
                  <Badge
                    tone={
                      r.outcome === 'ADVANCED' ? 'success' : r.outcome === 'REJECTED' ? 'critical' : 'neutral'
                    }
                  >
                    {humanize(r.outcome)}
                  </Badge>
                </td>
                <td style={{ textAlign: 'right' }}>
                  {!published && (
                    <div style={{ display: 'inline-flex', gap: 'var(--space-2)' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => markAbsent(r.applicationId)}>
                        Absent
                      </button>
                      <button
                        className="btn btn-danger-outline btn-sm"
                        onClick={() => setOutcome(r.applicationId, 'REJECTED')}
                      >
                        Reject
                      </button>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => setOutcome(r.applicationId, 'ADVANCED')}
                      >
                        Advance
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RoundForm({
  jobId,
  nextSequence,
  onClose,
  onCreated,
}: {
  jobId: string;
  nextSequence: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<InterviewRoundType>('TECHNICAL');
  const [scheduledAt, setScheduledAt] = useState('');
  const [venue, setVenue] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await interviewsApi.createRound(jobId, {
        sequence: nextSequence,
        type,
        scheduledAt: new Date(scheduledAt).toISOString(),
        venue: venue || undefined,
        interviewers: [],
      });
      onCreated();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not create the round', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Create Round ${nextSequence}`} onClose={onClose}>
      <form onSubmit={submit} className="login-form">
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
          {nextSequence === 1
            ? 'Every shortlisted candidate is added to this round.'
            : 'Candidates the previous round advanced are added to this round.'}
        </p>

        <label className="field">
          <span>Round type</span>
          <select value={type} onChange={(e) => setType(e.target.value as InterviewRoundType)}>
            <option value="WRITTEN_TEST">Written Test</option>
            <option value="TECHNICAL">Technical</option>
            <option value="HR">HR (final)</option>
            <option value="MANAGERIAL">Managerial (final)</option>
          </select>
        </label>

        <label className="field">
          <span>Scheduled at</span>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>Venue or link</span>
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Farida Leathers, Ambur" />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create round'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
