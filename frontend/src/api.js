import { parseApiResponse } from './apiResponse.js';

const BASE = import.meta.env.VITE_API_BASE ?? '';

// Token getter — set by AuthProvider so api.js doesn't need to import context
let _getToken = () => null;
let _onUnauthorized = () => {};

export function configureAuth(getToken, onUnauthorized) {
  _getToken = getToken;
  _onUnauthorized = onUnauthorized;
}

async function request(path, options = {}) {
  const token = _getToken();
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response = await fetch(`${BASE}${path}`, { ...options, headers });

  // If unauthorized and not an auth call itself, attempt transparent refresh
  if (response.status === 401 && !path.startsWith('/auth/')) {
    try {
      const stored = JSON.parse(localStorage.getItem('veritas_auth') || '{}');
      if (stored?.refresh_token) {
        const refreshRes = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: stored.refresh_token }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          stored.access_token = data.access_token;
          localStorage.setItem('veritas_auth', JSON.stringify(stored));
          headers['Authorization'] = `Bearer ${data.access_token}`;
          // Retry the original failed request
          response = await fetch(`${BASE}${path}`, { ...options, headers });
        }
      }
    } catch {
      // Refresh failed, proceed to logout handler
    }
  }

  if (response.status === 401) {
    _onUnauthorized();
    throw new Error('Session expired. Please log in again.');
  }

  return parseApiResponse(response, path);
}

export const api = {
  health: () => request('/health'),

  // Auth (no token required)
  register: (email, username, password) => request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  }),
  login: (email, password) => request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }),
  logout: (refresh_token) => request('/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  }),

  // Users
  me: () => request('/users/me'),
  updateMe: (data) => request('/users/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  adminListUsers: (limit = 50, offset = 0) =>
    request(`/admin/users?limit=${limit}&offset=${offset}`),
  adminPatchUser: (id, data) => request(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  adminDeleteUser: (id) => request(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminAuditLog: (limit = 100) => request(`/admin/audit-log?limit=${limit}`),

  // Patients / Case Review
  patients: () => request('/api/patients'),
  getPatient: (patientId) => request(`/api/patients/${encodeURIComponent(patientId)}`),
  patientSentiment: (patientId) => request(`/api/patients/${encodeURIComponent(patientId)}/sentiment`),
  patientTimeline: (patientId) => request(`/api/patients/${encodeURIComponent(patientId)}/timeline`),
  patientDocuments: (patientId) => request(`/api/patients/${encodeURIComponent(patientId)}/documents`),
  patientPassages: (patientId) => request(`/api/patients/${encodeURIComponent(patientId)}/passages`),
  patientWorkflowTrace: (patientId) => request(`/api/patients/${encodeURIComponent(patientId)}/workflow-trace`),
  patientInsights: (patientId, top_k = 8) => request(`/api/patients/${encodeURIComponent(patientId)}/insights?top_k=${top_k}`),
  patientFlags: (patientId) => request(`/api/patients/${encodeURIComponent(patientId)}/flags`),
  patientTrace: (patientId, flagId) => request(`/api/patients/${encodeURIComponent(patientId)}/trace/${encodeURIComponent(flagId)}`),

  // Prescriptions & Entity Tokenization
  tokenizePrescription: (data) => request('/api/prescriptions/tokenize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  savePrescription: (data) => request('/api/prescriptions/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),

  // Documents
  documents: (patient_id = null) => patient_id ? request(`/api/documents?patient_id=${encodeURIComponent(patient_id)}`) : request('/api/documents'),
  getDocument: (id) => request(`/api/documents/${encodeURIComponent(id)}`),
  upload: (file, patient_id = null) => {
    const form = new FormData();
    form.append('file', file);
    if (patient_id) form.append('patient_id', patient_id);
    return request('/api/documents', { method: 'POST', body: form });
  },
  deleteDocument: (id) => request(`/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  generateDocument: () => request('/api/admin/documents/generate', { method: 'POST' }),

  // Search & Analysis
  analyse: (patient_id = null, question = null, document_id = null) => request('/analyse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id, question, document_id }),
  }),
  search: (question, document_id = null, top_k = 6, min_confidence = 0.005, patient_id = null) => request('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, document_id, top_k, min_confidence, patient_id }),
  }),
};
