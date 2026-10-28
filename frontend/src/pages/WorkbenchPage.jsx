import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';
import { Badge, Err, RichText, fmtDate } from '../components/ui';
import clsx from 'clsx';
import {
  FileText, ChevronDown, ChevronUp,
  Copy, Check, Loader2, ShieldCheck
} from 'lucide-react';

/* ── Sample questions that reflect the real pipeline ── */
const SAMPLE_QUESTIONS = [
  'Has the patient reported severe insomnia?',
  'Was any condition ruled out?',
  'Does the record mention suicidal ideation?',
  'What family psychiatric history is documented?',
];

/* ── Decision rendering (derived from backend status) ── */
function statusTone(status) {
  if (!status) return 'slate';
  const s = status.toLowerCase();
  if (s === 'affirmed') return 'emerald';
  if (s.includes('negated')) return 'violet';
  if (s.includes('family')) return 'blue';
  if (s.includes('mixed') || s.includes('fluctuating')) return 'amber';
  return 'slate';
}

/* ── Source sentence display ── */
function SourceSentence({ sentence }) {
  return (
    <p className="text-sm leading-relaxed font-serif text-slate-800">
      “{sentence}”
    </p>
  );
}

/* ── Finding row (one extracted claim + its evidence) ── */
function FindingRow({ finding, citations }) {
  const [expanded, setExpanded] = useState(false);
  const citIds = finding.citations ?? [];
  const supporting = citations.filter(c => citIds.includes(c.note_id));

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 p-4 hover:bg-slate-50 transition-colors text-left focus-visible:outline-none cursor-pointer"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(finding.status)}>{finding.status ?? 'documented'}</Badge>
            {finding.dsm5_persistent && (
              <Badge tone="amber">persistent ≥2 wks</Badge>
            )}
          </div>
          <p className="text-sm font-medium text-slate-900 leading-snug">
            {finding.category}
            {finding.count > 1 && (
              <span className="text-slate-500 font-normal"> · {finding.count} visits</span>
            )}
          </p>
          {finding.sample_sentence && (
            <p className="text-xs text-slate-500 font-serif italic line-clamp-1">
              “{finding.sample_sentence}”
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 pt-0.5">
          <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
            {finding.first_date !== finding.latest_date
              ? `${fmtDate(finding.first_date)} → ${fmtDate(finding.latest_date)}`
              : fmtDate(finding.latest_date)}
          </span>
          <span className="text-slate-400">
            {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
          </span>
        </div>
      </button>

      {/* Expanded evidence detail */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-2.5">
          {supporting.length > 0 ? supporting.map((c, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-md p-3 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500">
                <span className="font-semibold text-slate-700">{c.note_id}</span>
                <span className="text-slate-400">·</span>
                <span>{fmtDate(c.date)}</span>
                <span className="text-slate-400">·</span>
                <span>{c.patient_name ?? 'unknown'}</span>
                {c.assertion && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide bg-slate-100 px-1.5 py-0.5 rounded">
                    {c.assertion}
                  </span>
                )}
              </div>
              <SourceSentence sentence={c.sentence} query={String(finding.category)} />
            </div>
          )) : (
            <p className="text-sm text-slate-500 italic">
              No per-passage citations available for this claim.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkbenchPage() {
  const [question, setQuestion] = useState('');
  const [patientFilter, setPatientFilter] = useState('');
  const [patients, setPatients] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    api.patients().then(ps => setPatients(ps)).catch(() => {});
  }, []);

  const run = useCallback(async (q = null, p = null) => {
    const query = (q ?? question).trim();
    if (!query || loading) return;
    setLoading(true);
    setError('');
    setHasRun(true);
    try {
      const res = await api.qa(query, (p ?? patientFilter) || null, 6);
      setResult(res);
    } catch (e) {
      setError(e.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [question, patientFilter, loading]);

  const copySummary = useCallback(() => {
    if (!result) return;
    const lines = [
      `Query: ${result.question ?? question}`,
      `Status: ${result.clinical_status} · Confidence: ${Math.round((result.confidence ?? 0) * 100)}%`,
      '',
      result.answer_summary ?? '',
      '',
      'Evidence:',
      ...(result.citations ?? []).map((c, i) => `${i + 1}. [${c.note_id} · ${fmtDate(c.date)}] (${c.assertion ?? 'N/A'}) "${c.sentence}"`),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [result, question]);

  const patientName = useMemo(
    () => patients.find(p => p.id === patientFilter)?.name,
    [patients, patientFilter]
  );

  return (
    <div className="max-w-6xl mx-auto px-8 py-8 space-y-6">

      {/* ── Header ── */}
      <header className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Note Review</h1>
        <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
          Ask a clinical question. The system finds supporting passages in the record, scores
          each claim against its source text, and accepts, flags, or abstains — no answer
          without evidence.
        </p>
      </header>

      {/* ── Query composer ── */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4" aria-label="Query composer">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Patient scope */}
          <label className="sm:w-56 shrink-0">
            <span className="block text-xs font-medium text-slate-500 mb-1.5">Patient scope</span>
            <select
              value={patientFilter}
              onChange={(e) => { setPatientFilter(e.target.value); if (question.trim()) run(question, e.target.value); }}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 cursor-pointer hover:border-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <option value="">All records (whole corpus)</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </label>

          {/* Question */}
          <label className="flex-1 min-w-0">
            <span className="block text-xs font-medium text-slate-500 mb-1.5">Clinical question</span>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } }}
              rows={2}
              placeholder="e.g. Has the patient reported severe insomnia?"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 resize-none leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 min-h-10"
            />
          </label>
        </div>

        {/* Sample chips and run button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
            <span className="text-slate-400 shrink-0 mr-1">try:</span>
            {SAMPLE_QUESTIONS.map((sq) => (
              <button
                key={sq}
                onClick={() => { setQuestion(sq); run(sq); }}
                className="px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:border-teal-600 hover:text-teal-800 hover:bg-teal-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                {sq}
              </button>
            ))}
          </div>

          <button
            onClick={() => run()}
            disabled={loading || !question.trim()}
            className="shrink-0 inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none cursor-pointer"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
            {loading ? 'Verifying…' : 'Review note'}
          </button>
        </div>
      </section>

      {/* ── Error ── */}
      {error && <Err message={error} onRetry={() => run()} />}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-3" aria-label="Loading results">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-slate-200 rounded-lg bg-white p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-5 w-24 rounded bg-slate-200" />
                <div className="h-4 flex-1 max-w-md rounded bg-slate-200" />
              </div>
              <div className="h-3 w-40 rounded bg-slate-100 mt-3" />
            </div>
          ))}
        </div>
      )}

      {/* ── Results ── */}
      {result && !loading && (
        <section className="space-y-5" aria-label="Review results" aria-busy={loading}>

          {/* Synthesis summary card */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <h2 className="text-sm font-semibold text-slate-900">Evidence synthesis</h2>
                <p className="text-xs text-slate-500">
                  {patientFilter ? `Scope: ${patientName ?? patientFilter}` : 'Scope: all records'}
                  {(result.citations?.length ?? 0) > 0 && (
                    <> · {(result.citations ?? []).length} supporting {(result.citations?.length ?? 0) === 1 ? 'passage' : 'passages'}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge tone={result.clinical_status === 'AFFIRMED' || result.clinical_status === 'PARTIALLY_AFFIRMED' ? 'emerald' : result.clinical_status === 'NEGATED' ? 'violet' : 'slate'}>
                  {result.clinical_status}
                </Badge>
                <button
                  onClick={copySummary}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                  title="Copy summary with citations"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Confidence meter */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-500">Calibrated confidence</span>
                <span className="font-mono text-slate-700 tabular-nums">
                  {Math.round((result.confidence ?? 0) * 100)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className={clsx(
                  'h-full rounded-full transition-all',
                  (result.confidence ?? 0) >= 0.7 ? 'bg-emerald-500' : (result.confidence ?? 0) >= 0.45 ? 'bg-amber-500' : 'bg-slate-300'
                )}
                  style={{ width: `${Math.max((result.confidence ?? 0) * 100, 4)}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round((result.confidence ?? 0) * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>

            <RichText text={result.answer_summary ?? 'No synthesis available.'} />

            <p className="text-xs text-slate-400 font-mono leading-relaxed pt-2 border-t border-border">
              Selection: this score reflects agreement between extracted claim and cited source.
              It is a research prototype, not a clinical confidence measure.
            </p>

            {/* Masking disclosure — counts only, never originals */}
            {result.deidentification && (
              <p className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                {result.deidentification.applied ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-800">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      {result.deidentification.scrubbed_count > 0
                        ? `masked ${result.deidentification.scrubbed_count} identifier${result.deidentification.scrubbed_count === 1 ? '' : 's'}${result.deidentification.types.length ? ` (${result.deidentification.types.join(', ')})` : ''}`
                        : 'no identifiers detected'}
                    </span>
                    {result.deidentification.cloud_call
                      ? <span className="text-slate-400">masked text sent to cloud synthesis</span>
                      : <span className="text-slate-400">deterministic synthesis only</span>}
                    <span className="text-amber-700 block w-full text-[11px]">
                      Heuristic masking is best-effort — not a HIPAA de-identification guarantee.
                    </span>
                  </>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
                    masking unavailable — cloud synthesis disabled for this query
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Findings list */}
          {(result.findings?.length ?? 0) > 0 ? (
            <div className="space-y-2.5">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                Extracted claims & decisions
                <span className="text-xs font-normal text-slate-400">({result.findings.length})</span>
              </h2>
              {result.findings.map((f, i) => (
                <FindingRow key={i} finding={f} citations={result.citations ?? []} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 border border-dashed border-slate-300 rounded-lg bg-white">
              <p className="text-sm font-medium text-slate-700">No claims extracted</p>
              <p className="text-sm text-slate-500 mt-0.5">Try a different question or widen the patient scope.</p>
            </div>
          )}
        </section>
      )}

      {/* ── Idle state ── */}
      {!result && !loading && !hasRun && !error && (
        <div className="py-16 text-center">
          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Enter a clinical question above. Every returned claim will carry its own
            source passage, confidence score, and explicit decision.
          </p>
        </div>
      )}
    </div>
  );
}
