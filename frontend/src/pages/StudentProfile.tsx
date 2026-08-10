import { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { AsyncBlock } from '../components/AsyncBlock';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { useAsync } from '../hooks/useAsync';
import { studentsApi } from '../api/endpoints';
import { ApiError } from '../api/client';

interface FormState {
  phone: string;
  about: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  resumeUrl: string;
}

export function StudentProfile() {
  const { notify } = useToast();
  const profile = useAsync(() => studentsApi.me(), []);
  const p = profile.data;

  const [form, setForm] = useState<FormState>({
    phone: '',
    about: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    resumeUrl: '',
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!p) return;
    setForm({
      phone: p.phone ?? '',
      about: p.about ?? '',
      linkedinUrl: p.linkedinUrl ?? '',
      githubUrl: p.githubUrl ?? '',
      portfolioUrl: p.portfolioUrl ?? '',
      resumeUrl: p.resumeUrl ?? '',
    });
    setSkills(p.skills);
  }, [p]);

  const set =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  function addSkill(raw: string) {
    const value = raw.trim().replace(/,$/, '');
    if (!value) return;
    // Case-insensitive dedupe, so "tanning" doesn't join "Tanning".
    if (skills.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSkillDraft('');
      return;
    }
    setSkills((s) => [...s, value]);
    setSkillDraft('');
  }

  function onSkillKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(skillDraft);
    } else if (e.key === 'Backspace' && !skillDraft && skills.length) {
      setSkills((s) => s.slice(0, -1));
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await studentsApi.update({
        phone: form.phone || undefined,
        about: form.about || undefined,
        skills,
        linkedinUrl: form.linkedinUrl,
        githubUrl: form.githubUrl,
        portfolioUrl: form.portfolioUrl,
        resumeUrl: form.resumeUrl,
      });
      notify('Profile saved', 'success');
      await profile.reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      await studentsApi.submit();
      notify('Sent to your placement officer for approval', 'success');
      await profile.reload();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not submit', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const status = !p
    ? null
    : p.placementReady
      ? { tone: 'success' as const, label: 'Placement ready' }
      : p.submittedForReviewAt
        ? { tone: 'warning' as const, label: 'Awaiting approval' }
        : { tone: 'neutral' as const, label: 'Not submitted' };

  // Mirrors the server's scoring so the ring updates as the student types,
  // rather than only after a save round-trip.
  const checks = [
    { label: 'Contact number', done: Boolean(form.phone) },
    { label: 'Short intro', done: Boolean(form.about) },
    { label: 'At least 3 skills', done: skills.length >= 3 },
    { label: 'Resume link', done: Boolean(form.resumeUrl) },
    { label: 'LinkedIn or portfolio', done: Boolean(form.linkedinUrl) },
  ];
  const percent = Math.round((checks.filter((c) => c.done).length / checks.length) * 100);

  const initials = p
    ? p.user.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '';

  const links = p
    ? [
        { url: form.resumeUrl, label: 'Resume', icon: 'file' },
        { url: form.linkedinUrl, label: 'LinkedIn', icon: 'users' },
        { url: form.githubUrl, label: 'GitHub', icon: 'clipboard' },
        { url: form.portfolioUrl, label: 'Portfolio', icon: 'briefcase' },
      ].filter((l) => l.url)
    : [];

  return (
    <div className="stack">
      <AsyncBlock loading={profile.loading} error={profile.error} onRetry={profile.reload}>
        {p && (
          <>
            <div className="profile-hero">
              <div className="profile-cover" />

              <div className="profile-hero-body">
                <div className="profile-avatar">{initials}</div>

                <div className="profile-identity">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span className="profile-name">{p.user.fullName}</span>
                    {status && <Badge tone={status.tone}>{status.label}</Badge>}
                  </div>

                  <div className="profile-meta">
                    {p.department.name} · Batch {p.batchYear} · {p.user.email}
                  </div>

                  {links.length > 0 && (
                    <div className="profile-links">
                      {links.map((l) => (
                        <a
                          key={l.label}
                          className="profile-link-chip"
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Icon name={l.icon} size={14} />
                          {l.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="profile-facts">
                <div className="profile-fact">
                  <div className="profile-fact-label">Roll number</div>
                  <div className="profile-fact-value mono">{p.rollNumber}</div>
                </div>
                <div className="profile-fact">
                  <div className="profile-fact-label">CGPA</div>
                  <div className="profile-fact-value mono">{p.cgpa}</div>
                </div>
                <div className="profile-fact">
                  <div className="profile-fact-label">Active backlogs</div>
                  <div className="profile-fact-value mono">{p.activeBacklogs}</div>
                </div>
                <div className="profile-fact">
                  <div className="profile-fact-label">Skills listed</div>
                  <div className="profile-fact-value mono">{skills.length}</div>
                </div>
              </div>
            </div>

            {p.reviewNote && !p.placementReady && (
              <Card>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--space-3)',
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'var(--warning-wash)',
                      color: 'var(--warning)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="file" size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>
                      Your officer asked for changes
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {p.reviewNote}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <div className="grid-2">
              <Card title="Profile strength" subtitle="Recruiters see everything below when you apply">
                <div className="ring-wrap" style={{ marginBottom: 'var(--space-5)' }}>
                  <CompletenessRing percent={percent} />
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>
                      {percent === 100 ? 'Ready to submit' : `${5 - checks.filter((c) => c.done).length} things left`}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {percent === 100
                        ? 'Send it to your officer for approval.'
                        : 'Finish these to unlock applying.'}
                    </div>
                  </div>
                </div>

                <div className="check-list">
                  {checks.map((c) => (
                    <div key={c.label} className={`check-item${c.done ? ' done' : ''}`}>
                      <div className="check-mark">
                        {c.done && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>

                {!p.placementReady && (
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 'var(--space-5)' }}
                    disabled={percent < 100 || submitting || Boolean(p.submittedForReviewAt)}
                    onClick={submit}
                  >
                    {p.submittedForReviewAt
                      ? 'Waiting on your officer'
                      : submitting
                        ? 'Submitting…'
                        : 'Submit for approval'}
                  </button>
                )}
              </Card>

              <Card title="Your skills" subtitle="Type and press Enter. These drive job matching.">
                <div className="skill-editor">
                  {skills.map((s) => (
                    <span key={s} className="skill-chip">
                      {s}
                      <button
                        type="button"
                        aria-label={`Remove ${s}`}
                        onClick={() => setSkills((prev) => prev.filter((x) => x !== s))}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                  <input
                    value={skillDraft}
                    onChange={(e) => setSkillDraft(e.target.value)}
                    onKeyDown={onSkillKey}
                    onBlur={() => addSkill(skillDraft)}
                    placeholder={skills.length ? 'Add another…' : 'Tanning, Quality Control…'}
                    aria-label="Add a skill"
                  />
                </div>

                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-muted)',
                    margin: 'var(--space-3) 0 0',
                    lineHeight: 1.5,
                  }}
                >
                  Jobs list the skills they need. Anything you leave off here can rule you out of a
                  drive automatically.
                </p>
              </Card>
            </div>

            <Card>
              <form onSubmit={save}>
                <div className="form-section">
                  <div className="form-section-title">About you</div>
                  <div className="form-section-sub">
                    The first thing a recruiter reads. Two or three lines is plenty.
                  </div>

                  <label className="field">
                    <span>Short intro</span>
                    <textarea
                      value={form.about}
                      onChange={set('about')}
                      rows={3}
                      placeholder="Final-year Leather Technology student, strong on tanning chemistry and QC."
                    />
                  </label>
                </div>

                <div className="form-section" style={{ marginTop: 'var(--space-5)' }}>
                  <div className="form-section-title">How to reach you</div>
                  <div className="form-section-sub">
                    Shared with a recruiter only after you apply to their drive.
                  </div>

                  <div className="field-row">
                    <label className="field">
                      <span>Phone</span>
                      <input
                        value={form.phone}
                        onChange={set('phone')}
                        placeholder="+91 98765 43210"
                      />
                    </label>
                    <label className="field">
                      <span>Resume link</span>
                      <input
                        type="url"
                        value={form.resumeUrl}
                        onChange={set('resumeUrl')}
                        placeholder="https://drive.google.com/…"
                      />
                    </label>
                  </div>
                </div>

                <div className="form-section" style={{ marginTop: 'var(--space-5)' }}>
                  <div className="form-section-title">Links</div>
                  <div className="form-section-sub">
                    Optional, but a portfolio helps on design-track roles.
                  </div>

                  <div className="field-row">
                    <label className="field">
                      <span>LinkedIn</span>
                      <input
                        type="url"
                        value={form.linkedinUrl}
                        onChange={set('linkedinUrl')}
                        placeholder="https://linkedin.com/in/…"
                      />
                    </label>
                    <label className="field">
                      <span>GitHub</span>
                      <input type="url" value={form.githubUrl} onChange={set('githubUrl')} />
                    </label>
                  </div>

                  <label className="field" style={{ marginTop: 'var(--space-4)' }}>
                    <span>Portfolio</span>
                    <input type="url" value={form.portfolioUrl} onChange={set('portfolioUrl')} />
                  </label>
                </div>

                <div className="form-actions-bar">
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)', marginRight: 'auto' }}>
                    {p.placementReady
                      ? 'Editing an approved profile sends it back for review.'
                      : 'Saved changes are private until you submit.'}
                  </span>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            </Card>
          </>
        )}
      </AsyncBlock>
    </div>
  );
}

function CompletenessRing({ percent }: { percent: number }) {
  const size = 76;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="ring">
      <svg width={size} height={size}>
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
        />
      </svg>
      <div className="ring-label">{percent}%</div>
    </div>
  );
}
