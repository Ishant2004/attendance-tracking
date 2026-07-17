import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { usePingLoop } from '../hooks/usePingLoop';

// Nav links per role — only what each role needs.
const NAV = {
  employee: [{ to: '/me', label: 'My Attendance' }],
  manager: [
    { to: '/me', label: 'My Attendance' },
    { to: '/team', label: 'Team' },
  ],
  leadership: [
    { to: '/me', label: 'My Attendance' },
    { to: '/leadership', label: 'Organization' },
  ],
  admin: [
    { to: '/me', label: 'My Attendance' },
    { to: '/admin', label: 'Admin' },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  // Directory is available to everyone; role-specific links come first.
  const links = [...(NAV[user.role] || []), { to: '/org', label: 'Directory' }];
  const tracking = usePingLoop(!!user);

  const trackLabel =
    { active: 'Tracking', denied: 'Location off', unsupported: 'No GPS', error: 'Unavailable' }[tracking] ||
    'Locating…';
  const trackDot =
    tracking === 'active'
      ? 'bg-green-500'
      : tracking === 'denied' || tracking === 'error'
      ? 'bg-amber-500'
      : tracking === 'unsupported'
      ? 'bg-slate-400'
      : 'bg-slate-300 animate-pulse';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-md text-sm font-medium ${
      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
    }`;
  const mobileNavClass = ({ isActive }) =>
    `block px-3 py-2 rounded-md text-sm font-medium ${
      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
    }`;

  const roleBadge = (
    <span className="inline-block rounded bg-slate-100 text-slate-500 px-2 py-0.5 text-xs">{user.role}</span>
  );
  const trackingPill = (
    <span className="flex items-center gap-1.5 text-xs text-slate-500" title="Location tracking">
      <span className={`inline-block w-2 h-2 rounded-full ${trackDot}`} />
      {trackLabel}
    </span>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-indigo-600">Attendance</span>
            {/* Desktop nav */}
            <nav className="hidden md:flex gap-1">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className={navClass}>
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Desktop right side */}
          <div className="hidden md:flex items-center gap-4">
            {trackingPill}
            <NavLink to="/change-password" className="text-sm text-slate-600 flex items-center gap-2 hover:text-indigo-600" title="Change password">
              {user.name}
              {roleBadge}
            </NavLink>
            <button onClick={handleLogout} className="text-sm rounded-md bg-slate-800 text-white px-3 py-1.5 hover:bg-slate-700">
              Log out
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md text-slate-600 hover:bg-slate-100"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 px-4 py-3 space-y-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={mobileNavClass} onClick={() => setMenuOpen(false)}>
                {l.label}
              </NavLink>
            ))}
            <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
              <NavLink
                to="/change-password"
                onClick={() => setMenuOpen(false)}
                className="text-sm text-slate-700 flex items-center gap-2"
              >
                {user.name}
                {roleBadge}
              </NavLink>
              {trackingPill}
            </div>
            <button
              onClick={handleLogout}
              className="w-full mt-2 text-sm rounded-md bg-slate-800 text-white px-3 py-2 hover:bg-slate-700"
            >
              Log out
            </button>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
