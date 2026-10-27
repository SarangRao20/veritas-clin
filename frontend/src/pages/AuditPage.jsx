import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getNotes, getHealth, runExtract } from '../api';
import {
  DecisionChip, ErrorNote, PageHeader, Panel, ScoreBar, Spinner, TypeChip, fmt,
} from '../components/ui';

export default function AuditPage() {
  const [searchParams] = useSearchParams();
  const initialNoteId = searchParams.get('note');

  const [notes, setNotes] = useState(null);
  const [notesError, setNotesError] = useState(null);
  const [health, setHealth] = useState(null);

  const [selectedId, setSelectedId] = useState(initialNoteId ?? null);
  const [noteText, setNoteText] = useState('');

  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);

  useEffect(() => {
    getNotes()
      .then((all) => {
        setNotes(all);
        const wanted = initialNoteId && all.find((n) => n.note_id === initialNoteId);
        const chosen = wanted ?? all[0];
        if (chosen) {
          setSelectedId(chosen.note_id);
          setNoteText(chosen.text);
        }
      })
      .catch(setNotesError);
    getHealth().then(setHealth).catch(() => setHealth(null));
  }, [initialNoteId]);

  const selected = notes?.find((n) => n.note_id === selectedId) ?? null;
  const nliEnabled = result?.nli_enabled ?? health?.extractor === 'hf';

  const pickNote = (id) => {
    const n = notes?.find((x) => x.note_id === id);
    if (!n) return;
    setSelectedId(n.note_id);
    setNoteText(n.text);
    setResult(null);
    setRunError(null);
  };

  const run = async () => {
    if (!noteText.trim()) return;
    setRunning(true);
    setRunError(null);
    setResult(null);
    try {
      const r = await runExtract(selectedId ?? 'adhoc', noteText);
      setResult(r);
    } catch (e) {
      setRunError(e);
    } finally {
      setRunning(false);
    }
  };

  const th = 'text-[11px] uppercase tracking-wide text-zinc-500 font-medium px-3 py-2 text-left';
  const td = 'px-3 py-2.5 text-[13px] text-zinc-800 border-t border-zinc-100 align-top';

  return (
    <div>
      <PageHeader
        eyebrow="Live pipeline"
        title="Clinical audit"
        sub="Run the actual extraction → verification → calibrated abstention pipeline over any note text. The panel on the right is the pipeline's real output, not a canned report; edit the note to test adversarial inputs."
      />

      {notesError && <ErrorNote error={notesError} onRetry={() => window.location.reload()} />}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
        {/* Source column */}
        <Panel
          title="Source note"
          actions={
            <select
              value={selectedId ?? ''}
              onChange={(e) => pickNote(e.target.value)}
              aria-label="Select benchmark note"
              className="bg-white border border-zinc-300 rounded-md px-2 py-1 text-[12px] max-w-[220px] truncate focus:outline-none focus:border-blue-500"
            >
              {!notes && <option>Loading…</option>}
              {notes?.map((n) => (
                <option key={n.note_id} value={n.note_id}>{n.note_id}</option>
              ))}
            </select>
          }
        >
          <div className="p-3">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              spellCheck={false}
              rows={18}
              aria-label="Note text"
              className="w-full bg-white border border-zinc-200 rounded-md p-3 text-[12.5px] leading-relaxed font-sans text-zinc-800 resize-y focus:outline-none focus:border-blue-500"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[11px] text-zinc-400">{noteText.length.toLocaleString('en-US')} chars · editable</span>
              <button
                onClick={run}
                disabled={running || !noteText.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-md px-3.5 py-1.5 text-[13px] font-medium"
              >
                {running ? 'Running pipeline…' : 'Run audit'}
              </button>
            </div>
          </div>
        </Panel>

        {/* Results column */}
        <div className="space-y-4">
          {health && !health.extractor?.startsWith('hf') && (
            <div className="border border-zinc-200 bg-zinc-50 rounded-md px-3 py-2 text-[12px] text-zinc-600">
              This backend runs the <strong className="font-medium">heuristic extractor</strong> (CPU, network-free):
              the decision score is token confidence (w·conf), and the NLI cross-encoder column is suppressed
              because it is not loaded. Set <code className="font-mono text-[11px] bg-zinc-100 px-1 rounded">VERITAS_EXTRACTOR=hf</code> on a GPU host to enable NLI scoring.
            </div>
          )}

          {selected && (
            <Panel
              title="Ground truth (by construction)"
              sub={`What ${selected.note_id} actually contains — recorded when the corpus was rendered.`}
            >
              <ul className="px-4 py-2.5 divide-y divide-zinc-100">
                {selected.gt.map((g, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-[13px] text-zinc-800 truncate">{g.value}</span>
                    <TypeChip type={g.type} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel
            title="Pipeline output"
            sub={result
              ? `${result.n_accepted} auto-accepted · ${result.n_flagged} held for physician review · threshold τ* = ${fmt.round(result.threshold, 4)}`
              : 'Run the pipeline to populate.'}
          >
            {runError && (
              <div className="p-3">
                <ErrorNote error={runError} onRetry={run} />
              </div>
            )}
            {running && <div className="p-4"><Spinner label="Extracting → verifying → deciding" /></div>}
            {!result && !running && !runError && (
              <div className="px-4 py-8 text-center text-[12px] text-zinc-400">
                No audit run for this text yet.
              </div>
            )}

            {result && !running && (
              result.claims.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-zinc-500">
                  The extractor returned no findings for this text.
                </div>
              ) : (
                <>
                  {/* Compact cards below md — real tables need width */}
                  <ul className="md:hidden divide-y divide-zinc-100">
                    {result.claims.map((c, i) => {
                      const evidence = c.sentence ?? (c.span_text !== c.value ? c.span_text : null);
                      return (
                        <li key={i} className="px-4 py-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <TypeChip type={c.type} />
                            <DecisionChip decision={c.decision} />
                          </div>
                          <div className="text-[13px] font-medium text-zinc-900 break-words">{c.value}</div>
                          {evidence && (
                            <div className="text-[11px] text-zinc-500 italic break-words">
                              &ldquo;{evidence}&rdquo;
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <ScoreBar score={c.score} threshold={result.threshold} />
                            <span className="font-mono text-[12px] text-zinc-600">{fmt.round(c.score, 3)}</span>
                            {nliEnabled && (
                              <span className="font-mono text-[11px] text-zinc-400">
                                · p(entail) {fmt.pct(c.p_entail, 3)}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Dense table at md and up */}
                  <div className="hidden md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed">
                        <colgroup>
                          <col className="w-[14%]" />
                          <col />
                          {nliEnabled && <col className="w-[13%]" />}
                          <col className="w-[24%]" />
                          <col className="w-[20%]" />
                        </colgroup>
                        <thead>
                          <tr className="bg-zinc-50">
                            <th className={th}>Type</th>
                            <th className={th}>Finding</th>
                            {nliEnabled && <th className={th}>p(entail)</th>}
                            <th className={th}>Score</th>
                            <th className={th}>Decision</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.claims.map((c, i) => {
                            const evidence = c.sentence ?? (c.span_text !== c.value ? c.span_text : null);
                            return (
                              <tr key={i}>
                                <td className={td}><TypeChip type={c.type} /></td>
                                <td className={td}>
                                  <div className="font-medium text-zinc-900 text-[13px] truncate" title={c.value}>{c.value}</div>
                                  {c.dosage && <div className="text-[11px] text-zinc-500 truncate">{c.dosage}</div>}
                                  {evidence && (
                                    <div className="mt-1 text-[11px] text-zinc-500 italic truncate" title={evidence}>
                                      &ldquo;{evidence}&rdquo;
                                    </div>
                                  )}
                                </td>
                                {nliEnabled && (
                                  <td className={`${td} font-mono text-[12px]`}>{fmt.pct(c.p_entail, 3)}</td>
                                )}
                                <td className={td}>
                                  <div className="flex items-center gap-2">
                                    <ScoreBar score={c.score} threshold={result.threshold} />
                                    <span className="font-mono text-[12px] text-zinc-600">{fmt.round(c.score, 3)}</span>
                                  </div>
                                </td>
                                <td className={td}><DecisionChip decision={c.decision} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
