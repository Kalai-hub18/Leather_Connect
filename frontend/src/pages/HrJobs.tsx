import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAsync } from '../hooks/useAsync';
import { jobsApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { humanize, type JobStatus } from '../api/types';

const STATUS_TONE: Record<JobStatus, 'success' | 'warning' | 'neutral' | 'critical'> = {
  PUBLISHED: 'success',
  PENDING_APPROVAL: 'warning',
  DRAFT: 'neutral',
  CLOSED: 'neutral',
  CANCELLED: 'critical',
};

export function HrJobs() {
  const { notify } = useToast();
  const jobs = useAsync(() => jobsApi.mine(), []);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Job Postings</h1>
          <p className="page-sub">
            New postings go to the placement coordinator for review before students see them.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          Post a Job
        </button>
      </div>

      <AsyncBlock
        loading={jobs.loading}
        error={jobs.error}
        empty={(jobs.data ?? []).length === 0}
        emptyMessage="No postings yet. Create your first one."
        onRetry={jobs.reload}
      >
        <Card padded={false}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 'var(--space-5)' }}>Role</th>
                  <th>Type</th>
                  <th>Package</th>
                  <th>Applicants</th>
                  <th>Closes</th>
                  <th>Status</th>
                  <th style={{ paddingRight: 'var(--space-5)' }}></th>
                </tr>
              </thead>
              <tbody>
                {(jobs.data ?? []).map((job) => (
                  <tr key={job.id}>
                    <td style={{ paddingLeft: 'var(--space-5)' }}>
                      <div className="cell-primary">{job.title}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-faint)' }}>
                        {job.college?.name}
                      </div>
                    </td>
                    <td className="cell-muted">{humanize(job.type)}</td>
                    <td className="mono">{job.packageLpa ? `₹${job.packageLpa}L` : '—'}</td>
                    <td className="mono">{job._count?.applications ?? 0}</td>
                    <td className="mono cell-muted">{new Date(job.deadline).toLocaleDateString()}</td>
                    <td>
                      <Badge tone={STATUS_TONE[job.status]}>{humanize(job.status)}</Badge>
                    </td>
                    <td style={{ paddingRight: 'var(--space-5)', textAlign: 'right' }}>
                      {job.status === 'PUBLISHED' && (
                        <Link to={`/hr/jobs/${job.id}/pipeline`} className="btn btn-secondary btn-sm">
                          Pipeline
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </AsyncBlock>

      {showForm && (
        <JobForm
          onClose={() => setShowForm(false)}
          onCreated={async () => {
            setShowForm(false);
            notify('Job submitted for coordinator approval', 'success');
            await jobs.reload();
          }}
        />
      )}
    </div>
  );
}

function JobForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { notify } = useToast();
  const colleges = useAsync(() => jobsApi.targetColleges(), []);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    collegeId: '',
    title: '',
    description: '',
    type: 'GRADUATE_TRAINEE',
    location: '',
    packageLpa: '',
    deadline: '',
    minCgpa: '',
    maxBacklogs: '',
    batchYears: '2026',
    requiredSkills: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // HR accounts aren't scoped to a college — the posting names its target,
      // and only colleges with an approved company link are offered.
      const collegeId = form.collegeId || colleges.data?.[0]?.id;
      if (!collegeId) {
        notify('Your company is not approved to post to any college yet', 'error');
        return;
      }

      await jobsApi.create({
        collegeId,
        title: form.title,
        description: form.description,
        type: form.type,
        location: form.location || undefined,
        packageLpa: form.packageLpa ? Number(form.packageLpa) : undefined,
        deadline: new Date(form.deadline).toISOString(),
        eligibility: {
          minCgpa: form.minCgpa ? Number(form.minCgpa) : undefined,
          maxBacklogs: form.maxBacklogs ? Number(form.maxBacklogs) : undefined,
          departmentIds: [],
          batchYears: form.batchYears
            ? form.batchYears.split(',').map((y) => Number(y.trim())).filter(Boolean)
            : [],
          requiredSkills: form.requiredSkills
            ? form.requiredSkills.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        },
      });
      onCreated();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not create the job', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Post a Job" onClose={onClose}>
      <form onSubmit={submit} className="login-form">
        <label className="field">
          <span>Target college</span>
          <select value={form.collegeId} onChange={set('collegeId')} required>
            <option value="">
              {colleges.loading ? 'Loading…' : 'Select a college'}
            </option>
            {(colleges.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Title</span>
          <input value={form.title} onChange={set('title')} required placeholder="Graduate Trainee — Tanning Operations" />
        </label>

        <label className="field">
          <span>Description</span>
          <textarea value={form.description} onChange={set('description')} required minLength={10} />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Type</span>
            <select value={form.type} onChange={set('type')}>
              <option value="GRADUATE_TRAINEE">Graduate Trainee</option>
              <option value="FULL_TIME">Full Time</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="CONTRACT">Contract</option>
            </select>
          </label>
          <label className="field">
            <span>Package (LPA)</span>
            <input type="number" step="0.1" value={form.packageLpa} onChange={set('packageLpa')} placeholder="5.4" />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Location</span>
            <input value={form.location} onChange={set('location')} placeholder="Ambur, Tamil Nadu" />
          </label>
          <label className="field">
            <span>Deadline</span>
            <input type="date" value={form.deadline} onChange={set('deadline')} required />
          </label>
        </div>

        <div className="eyebrow" style={{ marginTop: 'var(--space-2)' }}>Eligibility</div>

        <div className="field-row">
          <label className="field">
            <span>Min CGPA</span>
            <input type="number" step="0.1" min="0" max="10" value={form.minCgpa} onChange={set('minCgpa')} placeholder="7.0" />
          </label>
          <label className="field">
            <span>Max backlogs</span>
            <input type="number" min="0" value={form.maxBacklogs} onChange={set('maxBacklogs')} placeholder="0" />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Batch years</span>
            <input value={form.batchYears} onChange={set('batchYears')} placeholder="2026" />
          </label>
          <label className="field">
            <span>Required skills</span>
            <input value={form.requiredSkills} onChange={set('requiredSkills')} placeholder="Tanning, QC" />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit for approval'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
