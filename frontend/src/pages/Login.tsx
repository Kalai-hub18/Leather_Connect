import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HOME_BY_ROLE, useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

const DEMO_ACCOUNTS = [
  { label: 'Student', email: 'priya@annauniv.edu', detail: 'Priya Sharma · CGPA 8.4' },
  { label: 'HR', email: 'hr@faridagroup.com', detail: 'Farida Leathers' },
  { label: 'Placement Officer', email: 'officer@annauniv.edu', detail: 'Dr. Deepa Krishnan' },
  { label: 'Student Coordinator', email: 'coord1@annauniv.edu', detail: 'Nithya Balan' },
  { label: 'Alumni', email: 'vikram@bata.com', detail: 'Vikram Nair · 2019' },
];

const DEMO_PASSWORD = 'Passw0rd!';

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await signIn(email, password);
      navigate(HOME_BY_ROLE[user.role], { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">LC</div>
          <div>
            <div className="login-title">LeatherConnect</div>
            <div className="login-tag">Placements Platform</div>
          </div>
        </div>

        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@college.edu"
              required
              autoFocus
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-demo">
          <div className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Demo accounts</div>
          <div className="demo-grid">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                className="demo-account"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(DEMO_PASSWORD);
                }}
              >
                <span className="demo-role">{a.label}</span>
                <span className="demo-detail">{a.detail}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
