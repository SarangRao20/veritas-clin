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
    throw new Error(msg || `${r.status}`);
  }
  return r.json();
}

export const api = {
  health:       () => get('/health'),
  overview:     () => get('/api/overview'),
  corpus:       () => get('/api/corpus'),
  train:        (model) => post('/api/train', { model }),
  neighbors:    (model, word, n = 10) => post('/api/neighbors', { model, word, top_n: n }),
  noteVector:   (model, text) => post('/api/note-vector', { model, text }),
  evaluation:   () => get('/api/evaluation'),
  trainStatus:  () => get('/api/train-status'),
};
