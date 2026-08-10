import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { companiesApi } from '../api/endpoints';
import { useAsync } from '../hooks/useAsync';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function RecruiterSignup() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const companies = useAsync(() => companiesApi.directory(), []);
  const colleges = useAsync(() => companiesApi.colleges(), []);

  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    collegeId: '',
    companyId: '',
    companyName: '',
    industry: '',
    website: '',
    location: '',
    description: '',
  });

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await companiesApi.register({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        collegeId: form.collegeId,
        ...(mode === 'existing'
          ? { companyId: form.companyId }
          : {
              company: {
                name: form.companyName,
                industry: form.industry || undefined,
                website: form.website || undefined,
                location: form.location || undefined,
                description: form.description || undefined,
              },
            }),
      });

      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server');
    } finally {
      setBusy(false);
    }
  }

  async function signInNow() {
    try {
      await signIn(form.email, form.password);
      navigate('/hr/home', { replace: true });
    } catch {
      navigate('/login', { replace: true });
    }
  }

  if (done) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-mark">LC</div>
            <div>
              <div className="login-title">Request sent</div>
              <div className="login-tag">Awaiting college approval</div>
            </div>
          </div>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
            The placement officer has been notified. You can sign in now and set up a posting, but
            it won't reach students until they approve your company.
          </p>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={signInNow}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 480 }}>
        <div className="login-brand">
          <div className="brand-mark">LC</div>
          <div>
            <div className="login-title">Hire from LeatherConnect</div>
            <div className="login-tag">Recruiter registration</div>
          </div>
        </div>

        <form onSubmit={submit} className="login-form">
          <div className="field-row">
            <label className="field">
              <span>Your name</span>
              <input value={form.fullName} onChange={set('fullName')} required minLength={2} />
            </label>
            <label className="field">
              <span>Work email</span>
              <input type="email" value={form.email} onChange={set('email')} required />
            </label>
          </div>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </label>

          <label className="field">
            <span>College you want to hire from</span>
            <select value={form.collegeId} onChange={set('collegeId')} required>
              <option value="">{colleges.loading ? 'Loading…' : 'Select a college'}</option>
              {(colleges.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>Your company</div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <button
                type="button"
                className={`btn btn-sm ${mode === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('existing')}
              >
                Already listed
              </button>
              <button
                type="button"
                className={`btn btn-sm ${mode === 'new' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('new')}
              >
                Add a new one
              </button>
            </div>

            {mode === 'existing' ? (
              <label className="field">
                <span>Company</span>
                <select value={form.companyId} onChange={set('companyId')} required>
                  <option value="">
                    {companies.loading ? 'Loading…' : 'Select your company'}
                  </option>
                  {(companies.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.industry ? ` — ${c.industry}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="stack-sm">
                <label className="field">
                  <span>Company name</span>
                  <input
                    value={form.companyName}
                    onChange={set('companyName')}
                    required
                    minLength={2}
                  />
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>Industry</span>
                    <input
                      value={form.industry}
                      onChange={set('industry')}
                      placeholder="Footwear manufacturing"
                    />
                  </label>
                  <label className="field">
                    <span>Location</span>
                    <input value={form.location} onChange={set('location')} placeholder="Ambur" />
                  </label>
                </div>
                <label className="field">
                  <span>Website</span>
                  <input
                    type="url"
                    value={form.website}
                    onChange={set('website')}
                    placeholder="https://"
                  />
                </label>
                <label className="field">
                  <span>What you do</span>
                  <textarea
                    value={form.description}
                    onChange={set('description')}
                    placeholder="Helps the placement officer verify you faster."
                  />
                </label>
              </div>
            )}
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Sending…' : 'Request access'}
          </button>
        </form>

        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 'var(--space-4)',
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          Already registered?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
