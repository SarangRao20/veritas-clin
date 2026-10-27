import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, Building2, UserCircle, ArrowRight, Zap } from 'lucide-react';

export default function AuthView({ onLoginSuccess }) {
  const [tab, setTab] = useState('signin');
  const [email, setEmail] = useState('sarang.rao@hospital.org');
  const [password, setPassword] = useState('••••••••••••');
  const [role, setRole] = useState('physician');
  const [institution, setInstitution] = useState('Mount Sinai Health System');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLoginSuccess({
      name: email.split('@')[0].replace('.', ' ').toUpperCase(),
      email,
      role,
      institution,
    });
  };

  const handleFastTrack = () => {
    onLoginSuccess({
      name: 'DR. S. RAO (EXAMINER)',
      email: 'sarang.rao@hospital.org',
      role: 'Clinical NLP Lead / Viva Examiner',
      institution: 'Mount Sinai Health System',
    });
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-8 shadow-sm">
        
        {/* Header Icon */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Clinical Staff Authentication</h2>
          <p className="text-xs text-slate-500 font-mono mt-1">EHR Audit & Safety Guardrail Access</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => setTab('signin')}
            className={`flex-1 pb-3 text-xs font-semibold text-center border-b-2 transition-all ${
              tab === 'signin'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Physician Sign In
          </button>
          <button
            onClick={() => setTab('register')}
            className={`flex-1 pb-3 text-xs font-semibold text-center border-b-2 transition-all ${
              tab === 'register'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Register Hospital Staff
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>Hospital Email</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-none focus:border-sky-600 focus:bg-white transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Clinical Passcode</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-none focus:border-sky-600 focus:bg-white transition-colors"
              required
            />
          </div>

          {tab === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Affiliated Hospital / Health System</span>
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-none focus:border-sky-600 focus:bg-white transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <UserCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>Clinical Role</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-none focus:border-sky-600 focus:bg-white transition-colors"
                >
                  <option value="physician">Attending Physician / Nephrologist</option>
                  <option value="researcher">Clinical NLP Researcher / Viva Examiner</option>
                  <option value="cmio">Chief Medical Information Officer (CMIO)</option>
                  <option value="pharmacist">Clinical Pharmacist</option>
                </select>
              </div>
            </>
          )}

          <button
            type="submit"
            className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm py-2.5 rounded-lg shadow-sm transition-all"
          >
            <span>{tab === 'signin' ? 'Authenticate & Open Studio' : 'Register & Enter Studio'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* 1-Click Examiner Viva Fast Track */}
        <div className="mt-6 pt-5 border-t border-slate-200 text-center">
          <p className="text-xs font-medium text-slate-500 mb-2">Examiner Viva Fast-Track:</p>
          <button
            type="button"
            onClick={handleFastTrack}
            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold py-2 rounded-lg transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span>1-Click Examiner Demo Sign-In (Bypass)</span>
          </button>
        </div>

      </div>
    </div>
  );
}
