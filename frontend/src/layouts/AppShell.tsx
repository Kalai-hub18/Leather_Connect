import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { humanize } from '../api/types';

const NAV: Record<string, { to: string; label: string }[]> = {
  STUDENT: [
    { to: '/student/jobs', label: 'Job Board' },
    { to: '/student/applications', label: 'My Applications' },
  ],
  HR: [{ to: '/hr/jobs', label: 'Job Postings' }],
  PLACEMENT_OFFICER: [
    { to: '/officer/approvals', label: 'Job Approvals' },
    { to: '/officer/applications', label: 'Drive Progress' },
    { to: '/officer/results', label: 'Results to Release' },
    { to: '/officer/roster', label: 'Drive Roster' },
  ],
  COLLEGE_ADMIN: [
    { to: '/officer/approvals', label: 'Job Approvals' },
    { to: '/officer/applications', label: 'Drive Progress' },
    { to: '/officer/results', label: 'Results to Release' },
  ],
  STUDENT_COORDINATOR: [{ to: '/cell/roster', label: 'Drive Roster' }],
  ALUMNI: [{ to: '/alumni/endorse', label: 'Endorse a Candidate' }],
  SUPER_ADMIN: [{ to: '/officer/approvals', label: 'Job Approvals' }],
};

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const nav = NAV[user.role] ?? [];
  const current = nav.find((n) => location.pathname.startsWith(n.to));

  const initials = user.fullName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">LC</div>
          <div className="brand-text">
            <div className="name">LeatherConnect</div>
            <div className="tag">Placements</div>
          </div>
        </div>

        <nav className="sidebar-nav" style={{ paddingTop: 'var(--space-4)' }}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-dot" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: '100%' }}
            onClick={() => {
              signOut();
              navigate('/login', { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-crumbs">
            {humanize(user.role)} <span style={{ opacity: 0.4 }}>/</span>{' '}
            <strong>{current?.label ?? 'Overview'}</strong>
          </div>
          <div className="topbar-user">
            <div style={{ textAlign: 'right' }}>
              <div className="topbar-name">{user.fullName}</div>
              <div className="topbar-role">{user.email}</div>
            </div>
            <div className="avatar">{initials}</div>
          </div>
        </header>

        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
