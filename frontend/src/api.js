const BASE = import.meta.env.VITE_API_BASE ?? '';

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `${response.status} ${response.statusText}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  health: () => request('/health'),
  documents: () => request('/api/documents'),
  upload: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/api/documents', { method: 'POST', body: form });
  },
  deleteDocument: (id) => request(`/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  search: (question, document_id = null) => request('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, document_id }),
  }),
};
