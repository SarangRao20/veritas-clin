import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { AlertCircle, FileText, Loader2, Search, Trash2, Upload } from 'lucide-react';

function ErrorNotice({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export default function WorkbenchPage() {
  const [documents, setDocuments] = useState([]);
  const [documentId, setDocumentId] = useState('');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refreshDocuments = useCallback(async () => {
    try {
      const next = await api.documents();
      setDocuments(next);
      setDocumentId(current => current && next.some(doc => doc.document_id === current) ? current : '');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refreshDocuments();
    api.health().then(setHealth).catch(() => {});
  }, [refreshDocuments]);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const document = await api.upload(file);
      await refreshDocuments();
      setDocumentId(document.document_id);
      setResult(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (document) => {
    if (!window.confirm(`Delete “${document.filename}” and its stored passages?`)) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteDocument(document.document_id);
      if (documentId === document.document_id) setDocumentId('');
      setResult(null);
      await refreshDocuments();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const search = async (event) => {
    event.preventDefault();
    if (!question.trim() || busy) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await api.search(question.trim(), documentId || null));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8 sm:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Document-grounded NLP</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Report & prescription search</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
          Upload documents, then search their passages with BM25 and local semantic embeddings.
          Answers show the retrieved source evidence; ranking signals are not clinical confidence.
        </p>
      </header>

      <ErrorNotice>{error}</ErrorNotice>

      <section aria-labelledby="documents-title" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="documents-title" className="text-base font-semibold text-slate-900">Documents</h2>
            <p className="mt-1 text-xs text-slate-500">PDF or TXT · stored in local SQLite until deleted · 5 MB maximum</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 focus-within:ring-2 focus-within:ring-teal-600 focus-within:ring-offset-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
            <span>{busy ? 'Working…' : 'Upload document'}</span>
            <input className="sr-only" type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={upload} disabled={busy} />
          </label>
        </div>

        {documents.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            No documents yet. Add a report or prescription to begin.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {documents.map(document => (
              <li key={document.document_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <FileText className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{document.filename}</p>
                  <p className="text-xs text-slate-500">
                    {document.passage_count} passages · {document.is_synthetic ? 'Synthetic demo' : 'Uploaded'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(document)}
                  disabled={busy}
                  aria-label={`Delete ${document.filename}`}
                  className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="search-title" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 id="search-title" className="text-base font-semibold text-slate-900">Ask about the documents</h2>
          <p className="mt-1 text-xs text-slate-500">Search uses lexical BM25 and semantic vector similarity.</p>
        </div>
        <form onSubmit={search} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Document scope</span>
            <select
              value={documentId}
              onChange={event => setDocumentId(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <option value="">All documents</option>
              {documents.map(document => (
                <option key={document.document_id} value={document.document_id}>
                  {document.filename}{document.is_synthetic ? ' · synthetic demo' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Question</span>
            <textarea
              value={question}
              onChange={event => setQuestion(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="e.g. What does the report say about sleep?"
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
            Search evidence
          </button>
        </form>
      </section>

      {result && (
        <section aria-labelledby="results-title" aria-live="polite" className="space-y-4">
          <div>
            <h2 id="results-title" className="text-lg font-semibold text-slate-900">
              {result.status === 'NO_EVIDENCE' ? 'No supporting evidence found' : 'Retrieved evidence'}
            </h2>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{result.answer}</p>
          </div>
          {result.evidence.map(hit => (
            <article key={hit.passage_id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-900">{hit.filename}</span>
                {hit.is_synthetic && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">Synthetic demo</span>}
                {hit.page !== null && <span className="text-slate-500">Page {hit.page}</span>}
                <span className="text-slate-500">Passage {hit.ordinal + 1}</span>
              </div>
              <blockquote className="border-l-2 border-teal-600 pl-4 text-sm leading-relaxed text-slate-800">
                {hit.passage}
              </blockquote>
              <dl className="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
                <div className="flex gap-1"><dt>BM25 rank:</dt><dd>{hit.bm25_rank ?? '—'}</dd></div>
                <div className="flex gap-1"><dt>Vector similarity:</dt><dd>{hit.vector_score.toFixed(3)}</dd></div>
                <div className="flex gap-1"><dt>Fused rank signal:</dt><dd>{hit.fused_score.toFixed(4)}</dd></div>
              </dl>
            </article>
          ))}
        </section>
      )}

      <p className="text-xs leading-relaxed text-slate-500">
        Research prototype only — not for diagnosis or treatment. Uploaded documents remain in the local database until deleted.
        {health?.local_llm_enabled
          ? ` Local Ollama response phrasing is enabled (${health.response_model}); only retrieved passages are sent to the local Ollama service.`
          : ' Response phrasing is deterministic; no document text is sent to an LLM.'}
      </p>
    </div>
  );
}
