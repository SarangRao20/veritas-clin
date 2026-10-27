/**
 * API layer. Every function hits the live FastAPI service — no mocked data.
 * Errors are surfaced as plain `Error` with the server's detail when present.
 */
export async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch { /* not json */ }
    throw new Error(detail);
  }
  return res.json();
}

export const getHealth = () => getJSON('/health');
export const getNotes = () => getJSON('/api/notes');
export const getMetrics = () => getJSON('/api/metrics');

export const getZipf = () => getJSON('/api/nlp/zipf');
export const getParadox = () => getJSON('/api/nlp/negation-paradox');
export const getBPE = (word) =>
  getJSON(`/api/nlp/bpe?word=${encodeURIComponent(word)}`);
export async function getTfIdf(query, noteText) {
  const res = await fetch('/api/nlp/tfidf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, note_text: noteText }),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch { /* not json */ }
    throw new Error(detail);
  }
  return res.json();
}

export async function runExtract(noteId, noteText) {
  const res = await fetch('/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note_id: noteId, note_text: noteText }),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch { /* not json */ }
    throw new Error(detail);
  }
  return res.json();
}
