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
  const links = NAV[user.role] || [];
  const tracking = usePingLoop(!!user);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-indigo-600">Attendance</span>
            <nav className="flex gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <span className="text-xs flex items-center gap-1.5 text-slate-500" title="Location tracking">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                tracking === 'active'
                  ? 'bg-green-500'
                  : tracking === 'denied'
                  ? 'bg-amber-500'
                  : 'bg-slate-300'
              }`}
            />
            {tracking === 'active'
              ? 'Tracking'
              : tracking === 'denied'
              ? 'Location off'
              : tracking === 'unsupported'
              ? 'No GPS'
              : '…'}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">
              {user.name}
              <span className="ml-2 inline-block rounded bg-slate-100 text-slate-500 px-2 py-0.5 text-xs">
                {user.role}
              </span>
            </span>
            <button
              onClick={handleLogout}
              className="text-sm rounded-md bg-slate-800 text-white px-3 py-1.5 hover:bg-slate-700"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}