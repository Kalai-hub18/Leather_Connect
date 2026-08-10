import { useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { useToast } from '../components/Toast';
import { useAsync } from '../hooks/useAsync';
import { applicationsApi, jobsApi, studentsApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { humanize, type Job } from '../api/types';

type SortKey = 'deadline' | 'package' | 'newest';

const TYPE_FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'GRADUATE_TRAINEE', label: 'Graduate trainee' },
  { key: 'FULL_TIME', label: 'Full time' },
  { key: 'INTERNSHIP', label: 'Internship' },
];

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function StudentJobs() {
  const { notify } = useToast();
  const jobs = useAsync(() => jobsApi.published(), []);
  const mine = useAsync(() => applicationsApi.mine(), []);
  const profile = useAsync(() => studentsApi.me(), []);

  const [applying, setApplying] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('ALL');
  const [sort, setSort] = useState<SortKey>('deadline');

  const appliedJobIds = useMemo(
    () => new Set((mine.data ?? []).map((a) => a.job.id)),
    [mine.data],
  );

  const visible = useMemo(() => {
    let list = jobs.data ?? [];

    if (type !== 'ALL') list = list.filter((j) => j.type === type);

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company?.name.toLowerCase().includes(q) ||
          j.location?.toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => {
      if (sort === 'package') return Number(b.packageLpa ?? 0) - Number(a.packageLpa ?? 0);
      if (sort === 'newest')
        return new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime();
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [jobs.data, query, type, sort]);

  async function apply(jobId: string) {
    setApplying(jobId);
    try {
      await applicationsApi.apply(jobId);
      notify('Application submitted', 'success');
      await Promise.all([mine.reload(), jobs.reload()]);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not apply', 'error');
    } finally {
      setApplying(null);
    }
  }

  const p = profile.data;
  const closingSoon = (jobs.data ?? []).filter((j) => daysUntil(j.deadline) <= 7).length;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Job Board</h1>
          <p className="page-sub">
            {jobs.data?.length ?? 0} drive{(jobs.data?.length ?? 0) === 1 ? '' : 's'} open
            {closingSoon > 0 && ` · ${closingSoon} closing this week`}
          </p>
        </div>
        {p && !p.placementReady && <Badge tone="warning">Profile not approved</Badge>}
      </div>

      <div className="toolbar">
        <div className="search-input">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search role, company or place"
            aria-label="Search drives"
          />
        </div>

        <div className="filter-group">
          {TYPE_FILTERS.map((f) => {
            const count =
              f.key === 'ALL'
                ? (jobs.data ?? []).length
                : (jobs.data ?? []).filter((j) => j.type === f.key).length;
            if (count === 0 && f.key !== 'ALL') return null;
            return (
              <button
                key={f.key}
                className={`filter-pill${type === f.key ? ' active' : ''}`}
                onClick={() => setType(f.key)}
              >
                {f.label}
                <span className="filter-count">{count}</span>
              </button>
            );
          })}
        </div>

        <select
          className="role-select"
          style={{ width: 'auto', minWidth: 150, marginLeft: 'auto' }}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort drives"
        >
          <option value="deadline">Closing soonest</option>
          <option value="package">Highest package</option>
          <option value="newest">Recently posted</option>
        </select>
      </div>

      <AsyncBlock
        loading={jobs.loading}
        error={jobs.error}
        empty={visible.length === 0}
        emptyIcon="briefcase"
        emptyTitle={query || type !== 'ALL' ? 'Nothing matches' : 'No open drives'}
        emptyMessage={
          query || type !== 'ALL'
            ? 'Try a different search or clear the filters.'
            : "Nothing is published right now. You'll be notified the moment a drive opens."
        }
        emptyAction={
          query || type !== 'ALL' ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setQuery('');
                setType('ALL');
              }}
            >
              Clear filters
            </button>
          ) : undefined
        }
        onRetry={jobs.reload}
      >
        <div className="stack-sm">
          {visible.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              applied={appliedJobIds.has(job.id)}
              busy={applying === job.id}
              blocked={Boolean(p && !p.placementReady)}
              cgpa={p ? Number(p.cgpa) : null}
              backlogs={p?.activeBacklogs ?? null}
              skills={p?.skills ?? []}
              onApply={() => apply(job.id)}
            />
          ))}
        </div>
      </AsyncBlock>
    </div>
  );
}

function JobRow({
  job,
  applied,
  busy,
  blocked,
  cgpa,
  backlogs,
  skills,
  onApply,
}: {
  job: Job;
  applied: boolean;
  busy: boolean;
  blocked: boolean;
  cgpa: number | null;
  backlogs: number | null;
  skills: string[];
  onApply: () => void;
}) {
  const e = job.eligibility;
  const left = daysUntil(job.deadline);

  // Each criterion is scored against the student's own profile, so they can see
  // why they'd be turned away before clicking rather than after.
  const criteria: { label: string; state: 'met' | 'unmet' | 'neutral' }[] = [];

  if (e?.minCgpa) {
    criteria.push({
      label: `CGPA ${e.minCgpa}+`,
      state: cgpa === null ? 'neutral' : cgpa >= Number(e.minCgpa) ? 'met' : 'unmet',
    });
  }
  if (e?.maxBacklogs != null) {
    criteria.push({
      label: e.maxBacklogs === 0 ? 'No backlogs' : `≤${e.maxBacklogs} backlogs`,
      state: backlogs === null ? 'neutral' : backlogs <= e.maxBacklogs ? 'met' : 'unmet',
    });
  }
  for (const skill of e?.requiredSkills ?? []) {
    criteria.push({
      label: skill,
      state: skills.some((s) => s.toLowerCase() === skill.toLowerCase()) ? 'met' : 'unmet',
    });
  }
  for (const year of e?.batchYears ?? []) {
    criteria.push({ label: `Batch ${year}`, state: 'neutral' });
  }

  const ineligible = criteria.some((c) => c.state === 'unmet');

  return (
    <div className="job-card">
      <div className="job-logo">{job.company?.name.charAt(0) ?? '?'}</div>

      <div className="job-main">
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="job-title">{job.title}</span>
          <Badge tone="neutral">{humanize(job.type)}</Badge>
        </div>

        <div className="job-company">
          {job.company?.name}
          {job.location ? ` · ${job.location}` : ''}
          {job._count ? ` · ${job._count.applications} applied` : ''}
        </div>

        {job.description && <p className="job-desc">{job.description}</p>}

        {criteria.length > 0 && (
          <div className="job-criteria">
            {criteria.map((c, i) => (
              <span key={i} className={`criterion${c.state === 'neutral' ? '' : ` ${c.state}`}`}>
                {c.state === 'met' && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
                {c.state === 'unmet' && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                )}
                {c.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="job-side">
        <div>
          <div className="job-package">
            {job.packageLpa ? (
              <>
                ₹{job.packageLpa}
                <span className="job-package-unit"> LPA</span>
              </>
            ) : job.stipend ? (
              <span style={{ fontSize: '1rem' }}>{job.stipend}</span>
            ) : (
              <span className="job-package-unit">Not disclosed</span>
            )}
          </div>
          <div className={`job-deadline${left <= 7 ? ' urgent' : ''}`}>
            {left < 0
              ? 'Closed'
              : left === 0
                ? 'Closes today'
                : `${left} day${left === 1 ? '' : 's'} left`}
          </div>
        </div>

        {applied ? (
          <span className="badge badge-success">Applied</span>
        ) : (
          <button
            className="btn btn-primary"
            disabled={busy || blocked || ineligible}
            onClick={onApply}
            title={
              blocked
                ? 'Your profile needs approval first'
                : ineligible
                  ? "You don't meet every criterion"
                  : undefined
            }
          >
            {busy ? 'Applying…' : ineligible ? 'Not eligible' : 'Apply'}
          </button>
        )}
      </div>
    </div>
  );
}
