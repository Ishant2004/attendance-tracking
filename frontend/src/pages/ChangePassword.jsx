import { useState } from 'react';
import { authApi } from '../api/auth';
import { Card, PasswordInput } from '../components/ui';

export default function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setDone(false);
    if (form.newPassword.length < 6) return setError('New password must be at least 6 characters');
    if (form.newPassword !== form.confirm) return setError('New passwords do not match');

    setSaving(true);
    try {
      await authApi.changePassword(form.currentPassword, form.newPassword);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-800 mb-4 text-center">Change password</h1>
        <Card>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-500">
            Your account was created by an admin — set your own password here.
          </p>
          {error && <div className="rounded bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
          {done && <div className="rounded bg-green-50 text-green-700 text-sm px-3 py-2">Password changed successfully.</div>}

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Current password</label>
            <PasswordInput required value={form.currentPassword} onChange={set('currentPassword')} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">New password</label>
            <PasswordInput required value={form.newPassword} onChange={set('newPassword')} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Confirm new password</label>
            <PasswordInput required value={form.confirm} onChange={set('confirm')} />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Change password'}
          </button>
        </form>
        </Card>
      </div>
    </div>
  );
}
