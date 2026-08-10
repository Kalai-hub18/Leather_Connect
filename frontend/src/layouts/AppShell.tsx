import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NotificationBell } from '../components/NotificationBell';
import { Icon } from '../components/Icon';
import { humanize } from '../api/types';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV: Record<string, NavItem[]> = {
  STUDENT: [
    { to: '/student/home', label: 'Overview', icon: 'home' },
    { to: '/student/jobs', label: 'Job Board', icon: 'briefcase' },
    { to: '/student/applications', label: 'My Applications', icon: 'file' },
    { to: '/student/profile', label: 'My Profile', icon: 'user' },
  ],
  HR: [
    { to: '/hr/home', label: 'Overview', icon: 'home' },
    { to: '/hr/jobs', label: 'Job Postings', icon: 'briefcase' },
  ],
  PLACEMENT_OFFICER: [
    { to: '/officer/home', label: 'Overview', icon: 'home' },
    { to: '/officer/approvals', label: 'Job Approvals', icon: 'check' },
    { to: '/officer/results', label: 'Results to Release', icon: 'send' },
    { to: '/officer/recruiters', label: 'Recruiter Access', icon: 'building' },
    { to: '/officer/profiles', label: 'Student Profiles', icon: 'user' },
    { to: '/officer/applications', label: 'Drive Progress', icon: 'chart' },
    { to: '/officer/roster', label: 'Drive Roster', icon: 'clipboard' },
  ],
  COLLEGE_ADMIN: [
    { to: '/officer/home', label: 'Overview', icon: 'home' },
    { to: '/officer/approvals', label: 'Job Approvals', icon: 'check' },
    { to: '/officer/results', label: 'Results to Release', icon: 'send' },
    { to: '/officer/applications', label: 'Drive Progress', icon: 'chart' },
  ],
  STUDENT_COORDINATOR: [{ to: '/cell/roster', label: 'Drive Roster', icon: 'clipboard' }],
  ALUMNI: [{ to: '/alumni/endorse', label: 'Endorse a Candidate', icon: 'users' }],
  SUPER_ADMIN: [{ to: '/officer/home', label: 'Overview', icon: 'home' }],
};

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Navigating on a phone should dismiss the drawer, not leave it covering
  // the page the user just asked for.
  useEffect(() => setMenuOpen(false), [location.pathname]);

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
      {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
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
              <Icon name={item.icon} />
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
          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="topbar-crumbs">
            {humanize(user.role)} <span style={{ opacity: 0.4 }}>/</span>{' '}
            <strong>{current?.label ?? 'Overview'}</strong>
          </div>
          <div className="topbar-user">
            <NotificationBell />
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
