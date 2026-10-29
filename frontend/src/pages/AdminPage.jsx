import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Activity, AlertCircle, Check,
  FileText, Loader2, Plus, ShieldCheck, Trash2, User, Users,
} from 'lucide-react';
import { fmtDate } from '../utils/clinicalFormatters';

function StatusDot({ active }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-400'}`}
      title={active ? 'Active' : 'Deactivated'} />
  );
}

function UsersTab({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null); // user_id being patched

  const load = () => {
    setLoading(true);
    api.adminListUsers()
      .then(setUsers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const patch = async (userId, data) => {
    setBusy(userId);
    try {
      const updated = await api.adminPatchUser(userId, data);
      setUsers(prev => prev.map(u => u.user_id === userId ? updated : u));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (userId) => {
    if (!window.confirm('Permanently delete this user?')) return;
    setBusy(userId);
    try {
      await api.adminDeleteUser(userId);
      setUsers(prev => prev.filter(u => u.user_id !== userId));
    } catch (e) {
      setError(e.message);
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Registered</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => {
                const isSelf = u.user_id === currentUserId;
                const isProcessing = busy === u.user_id;
                return (
                  <tr key={u.user_id} className={isSelf ? 'bg-teal-50/30' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400 shrink-0" />
                        <div>
                          <p className="font-medium text-slate-800">
                            {u.username}
                            {isSelf && <span className="ml-1.5 text-xs text-teal-600">(you)</span>}
                          </p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={isProcessing || isSelf}
                        onChange={e => patch(u.user_id, { role: e.target.value })}
                        className="rounded border border-slate-200 px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-600 disabled:opacity-50"
                      >
                        <option value="admin">admin</option>
                        <option value="clinician">clinician</option>
                        <option value="viewer">viewer</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled={isProcessing || isSelf}
                        onClick={() => patch(u.user_id, { is_active: !u.is_active })}
                        className="flex items-center gap-1.5 text-xs disabled:opacity-50 hover:underline"
                      >
                        <StatusDot active={u.is_active} />
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {isProcessing ? (
                        <Loader2 className="ml-auto h-4 w-4 animate-spin text-slate-400" />
                      ) : (
                        <button
                          disabled={isSelf}
                          onClick={() => remove(u.user_id)}
                          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SystemTab() {
  const [health, setHealth] = useState(null);
  const [docs, setDocs] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
    api.documents().then(setDocs).catch(() => {});
  }, []);

  const generate = async () => {
    setGenerating(true);
    setGenMsg('');
    setError('');
    try {
      const doc = await api.generateDocument();
      setGenMsg(`Generated: ${doc.filename}`);
      const updated = await api.documents();
      setDocs(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const syntheticCount = docs.filter(d => d.is_synthetic).length;
  const userCount = docs.filter(d => !d.is_synthetic).length;

  return (
    <div className="space-y-5">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {genMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <Check className="h-4 w-4" />
          {genMsg}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total documents', value: docs.length, icon: FileText },
          { label: 'User-uploaded', value: userCount, icon: User },
          { label: 'Synthetic demos', value: syntheticCount, icon: ShieldCheck },
          { label: 'LLM', value: health?.llm_enabled ? health.llm_provider : 'Off', icon: Activity },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <stat.icon className="h-4 w-4 text-teal-600 mb-2" />
            <p className="text-lg font-bold text-slate-900">{stat.value}</p>
            <p className="text-xs text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {health && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">System info</h3>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-slate-400">Embedding model</dt><dd className="font-mono text-xs text-slate-700">{health.embedding_model}</dd></div>
            <div><dt className="text-xs text-slate-400">LLM provider</dt><dd className="text-slate-700">{health.llm_provider || 'None (deterministic)'}</dd></div>
            {health.response_model && (
              <div><dt className="text-xs text-slate-400">Response model</dt><dd className="font-mono text-xs text-slate-700">{health.response_model}</dd></div>
            )}
          </dl>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Generate synthetic document</h3>
        <p className="text-sm text-slate-600">Create a new auto-generated synthetic clinical note from the medical reference data. Useful for testing retrieval across different conditions and medications.</p>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 transition-colors"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Generate document
        </button>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'system', label: 'System', icon: Activity },
];

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('users');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Admin panel</h1>
        <p className="mt-1 text-sm text-slate-500">Manage users, monitor the system, and generate demo data.</p>
      </header>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-teal-700 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab currentUserId={user?.user_id} />}
      {tab === 'system' && <SystemTab />}
    </div>
  );
}
