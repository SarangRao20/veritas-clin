import { useEffect, useState } from 'react';
import { api } from '../api';
import { AlertCircle, Check, Loader2, User } from 'lucide-react';

const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-800',
  clinician: 'bg-teal-100 text-teal-800',
  viewer: 'bg-slate-100 text-slate-700',
};

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Password change form
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    api.me()
      .then(setProfile)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const changePassword = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    setPwBusy(true);
    setPwError('');
    setPwSuccess(false);
    try {
      await api.updateMe({ password: newPw });
      setPwSuccess(true);
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
    </div>
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Your profile</h1>
        <p className="mt-1 text-sm text-slate-500">Account details and settings</p>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {profile && (
        <>
          {/* Profile card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
                <User className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-slate-900">{profile.username}</p>
                <p className="text-sm text-slate-500">{profile.email}</p>
              </div>
              <span className={`ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[profile.role]}`}>
                {profile.role}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
              <div>
                <dt className="text-xs text-slate-400">Account created</dt>
                <dd className="mt-0.5 text-slate-700">{fmtDate(profile.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Last login</dt>
                <dd className="mt-0.5 text-slate-700">{fmtDate(profile.last_login_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Status</dt>
                <dd className="mt-0.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${profile.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {profile.is_active ? 'Active' : 'Deactivated'}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Change password */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Change password</h2>

            {pwSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <Check className="h-4 w-4" />
                Password updated successfully.
              </div>
            )}
            {pwError && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{pwError}</span>
              </div>
            )}

            <form onSubmit={changePassword} className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600">New password</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Confirm new password</span>
                <input
                  type="password"
                  required
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                />
              </label>
              <button
                type="submit"
                disabled={pwBusy || !newPw || !confirmPw}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition-colors"
              >
                {pwBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Update password
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
