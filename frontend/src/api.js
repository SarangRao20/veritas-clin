const BASE = import.meta.env.VITE_API_BASE ?? '';

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => r.statusText);
    let detail = msg;
    try { detail = JSON.parse(msg).detail ?? msg; } catch {}
    throw new Error(detail);
  }
  return r.json();
}

export const api = {
  health:        () => get('/health'),
  patients:      () => get('/api/patients'),
  patient:       (id) => get(`/api/patients/${id}`),
  timeline:      (id) => get(`/api/patients/${id}/timeline`),
  search:        (query, patient_id, retriever, top_k) =>
                   post('/api/search', { query, patient_id, retriever, top_k }),
  compare:       (query, patient_id, top_k) =>
                   post('/api/search/compare', { query, patient_id, top_k }),
  symptoms:      () => get('/api/symptoms'),
  dataset:       () => get('/api/dataset'),
  trainStatus:   () => get('/api/train-status'),
  train:         (model) => post('/api/train', { model }),
  evaluate:      () => get('/api/evaluate'),
  results:       () => get('/api/results'),
  neighbors:     (model, word, n = 10) => post('/api/neighbors', { model, word, top_n: n }),
  predict:       (text, model) => post('/api/predict', { text, model }),
  explain:       (text, model) => post('/api/explain', { text, model }),
  batch:         (notes, model) => post('/api/batch', { notes, model }),
  qa:            (question, patient_id = null, top_k = 6, provider = null, api_key = null) =>
                   post('/api/qa', { question, patient_id, top_k, provider, api_key }),
  deidentify:    (text, mode = 'mask') =>
                   post('/api/deidentify', { text, mode }),
};
