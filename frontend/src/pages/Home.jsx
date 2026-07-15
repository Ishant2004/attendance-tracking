import { useAuth } from '../auth/AuthContext';

export default function Home() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-lg mx-auto bg-white rounded-xl shadow p-6 space-y-3">
        <h1 className="text-xl font-bold text-slate-800">Logged in ✅</h1>
        <p className="text-slate-600">Name: <b>{user.name}</b></p>
        <p className="text-slate-600">Email: {user.email}</p>
        <p className="text-slate-600">
          Role:{' '}
          <span className="inline-block rounded bg-indigo-100 text-indigo-700 px-2 py-0.5 text-sm">
            {user.role}
          </span>
        </p>
        <button onClick={logout} className="rounded-lg bg-slate-800 text-white px-4 py-2 text-sm">
          Log out
        </button>
      </div>
    </div>
  );
}