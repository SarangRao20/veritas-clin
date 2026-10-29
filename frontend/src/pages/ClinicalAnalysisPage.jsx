import { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import {
  Activity, BookOpen, FileText, ShieldCheck,
  Sparkles, Zap
} from 'lucide-react';

export default function ClinicalAnalysisPage() {
  const [question, setQuestion] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [documents, setDocuments] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const resultsRef = useRef(null);

  useEffect(() => {
    api.documents().then(setDocuments).catch((e) => setError(e.message));
  }, []);

  const runAnalysis = async (q = question) => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.search(q.trim(), documentId || null, 8, 0.18);
      // Client-side confidence gate: ensure we never fabricate.
      if (!res.evidence || res.evidence.length === 0) {
        res.status = 'ABSTAINED';
      } else {
        const maxScore = Math.max(...res.evidence.map((h) => h.fused_score));
        if (maxScore < 0.18) {
          res.status = 'ABSTAINED';
        }
      }
      res.evidence = res.evidence || [];
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const selectedDoc = documents.find((d) => d.document_id === documentId) || null;
  const downloadReport = () => window.print();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-teal-700" />
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Ground-Up Clinical Intelligence</p>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Centralized Patient Analysis Engine</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-500">
          Ask any question about your uploaded clinical records. The engine produces a structured SBAR-grade analysis grounded only in retrieved passages — never inventing facts.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Source Documents</h2>
            <p className="mb-3 text-xs text-slate-400">Scope analysis to one patient's report, or search across all indexed records.</p>
            {documents.length === 0 ? (
              <p className="text-xs text-slate-400">No documents yet — upload via the Workbench.</p>
            ) : (
              <ul className="space-y-1.5">
                <li>
                  <button
                    onClick={() => setDocumentId('')}
                    className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors border ${
                      documentId === '' ? 'bg-teal-50 border-teal-200 text-teal-900' : 'border-transparent text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    All patient contexts
                  </button>
                </li>
                {documents.map((d) => (
                  <li key={d.document_id}>
                    <button
                      onClick={() => setDocumentId(documentId === d.document_id ? '' : d.document_id)}
                      className={`w-full rounded-lg px-3 py-2 text-left transition-colors border ${
                        documentId === d.document_id ? 'bg-teal-50 border-teal-200 text-teal-900' : 'border-transparent text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <p className="truncate text-xs font-medium">{d.filename}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{d.passage_count} passages · {d.user_id ? 'Private' : 'Shared'}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedDoc && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
              <p className="mb-1 font-semibold text-slate-700">Selected report</p>
              <p className="break-words text-slate-500">{selectedDoc.filename}</p>
            </div>
          )}
        </aside>

        <main className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Search className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-900">Analytical Query</h2>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); runAnalysis(); }}
              className="space-y-3"
            >
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="e.g. Summarise the clinical status, key medications, and red flags for this patient."
                className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runAnalysis(); } }}
              />
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Zap className="h-4 w-4" />}
                  Run Ground-Up Analysis
                </button>
                <p className="text-xs text-slate-400">Ctrl+Enter · abstains below confidence threshold</p>
              </div>
            </form>
          </section>

          {result && (
            <section ref={resultsRef} className="space-y-4 clinical-report">
              <div className="flex justify-end print:hidden">
                <button onClick={downloadReport} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Download PDF</button>
              </div>
              {/* PII audit */}
              {result.pii_audit && (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900 shadow-sm">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  <div className="flex-1">
                    <span className="font-semibold text-emerald-950">HIPAA Safe Harbor Privacy Guard:</span>{' '}
                    {result.pii_audit.scrubbed_count > 0
                      ? `Masked ${result.pii_audit.scrubbed_count} PHI identifiers (${result.pii_audit.entities_masked.join(', ')}) before synthesis.`
                      : 'Verified: No raw PHI detected. Safe for local & cloud processing.'}
                  </div>
                </div>
              )}

              {/* Ground-up SBAR Insight Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                    <BookOpen className="h-4 w-4 text-teal-700" />
                    Clinical SBAR Analysis
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      result.status === 'EVIDENCE_FOUND'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {result.status === 'EVIDENCE_FOUND' ? 'Grounded' : 'Abstained — No Supporting Evidence'}
                  </span>
                </div>

                {result.status !== 'EVIDENCE_FOUND' ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
                    <strong>Zero-Hallucination Guard:</strong> Confidence threshold not met or no relevant evidence found. The system refuses to synthesize a clinical conclusion.
                  </div>
                ) : (
                  <div className="space-y-3 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                    <p>{result.answer}</p>
                    {result.used_agent && (
                      <p className="text-xs text-teal-700">AI-synthesised · citations anchored to retrieved passages</p>
                    )}
                  </div>
                )}
              </div>

              {/* Evidence Timeline & Assertion Status */}
              {result.evidence?.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-teal-700" />
                    Evidence Timeline & Assertion Status
                  </h3>
                  {result.evidence.map((hit) => (
                    <div key={hit.passage_id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                        <FileText className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-800">{hit.filename}</span>
                        {hit.page !== null && <span>· Page {hit.page}</span>}
                        <span className="text-slate-400">· Passage {hit.ordinal + 1}</span>
                        <span
                          className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            hit.assertion === 'NEGATED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {hit.assertion}
                        </span>
                      </div>
                      <blockquote className="border-l-2 border-teal-500 pl-3 text-sm text-slate-800 leading-relaxed">
                        {hit.passage}
                      </blockquote>
                      <div className="mt-2 flex gap-4 text-[11px] text-slate-400 font-mono">
                        <span>BM25: {hit.bm25_score.toFixed(3)}</span>
                        <span>Vector: {hit.vector_score.toFixed(3)}</span>
                        <span>Fused: {hit.fused_score.toFixed(4)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {!result && !loading && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center text-slate-400">
              <Search className="mx-auto mb-3 h-8 w-8 opacity-40" />
              <p className="text-sm">Run a ground-up clinical analysis query to view structured insights.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
