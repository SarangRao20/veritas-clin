import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getNotes } from '../api';
import { Chip, ErrorNote, PageHeader, Spinner } from '../components/ui';

/**
 * Deterministic helpers — structure parsed from the note text itself,
 * never invented. The same text the pipeline receives is what we display.
 */
function deriveMeta(note) {
  const text = note.text;
  const patientId = text.match(/^Patient ID: (\S+)$/m)?.[1] ?? '—';
  const docType = text.startsWith('PROGRESS NOTE') ? 'Progress note' : 'Discharge summary';
  const allergies = text.match(/^Allergies: (.+)$/m)?.[1] ?? '—';

  // A condition listed with a modality qualifier is NOT a diagnosis (planted trap).
  const trap = text.match(/^\d+\. (.+?) - (ruled out|resolved|unlikely)\.$/m);
  const trapDx = trap?.[1] ?? null;
  const modality = trap?.[2] ?? null;

  const gt = note.gt ?? [];
  const counts = {};
  for (const g of gt) counts[g.type] = (counts[g.type] ?? 0) + 1;

  return { patientId, docType, allergies, trapDx, modality, counts };
}

const TYPE_ABBR = { diagnosis: 'dx', medication: 'rx', followup: 'fu' };

export default function EncountersPage() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const load = () => {
    setError(null);
    getNotes().then(setNotes).catch(setError);
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!notes) return null;
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.note_id.includes(q) ||
        n.text.toLowerCase().includes(q),
    );
  }, [notes, query]);

  const th = 'text-[11px] uppercase tracking-wide text-zinc-500 font-medium px-3 py-2 text-left';
  const td = 'px-3 py-2.5 text-[13px] text-zinc-800 border-t border-zinc-100';

  return (
    <div>
      <PageHeader
        eyebrow="Benchmark corpus"
        title="Encounter registry"
        sub="40 synthetic benchmark notes (seed 7). Every note is written with its ground truth known by construction, including planted traps: a modality-qualified condition, a family-history line, and an allergy line."
      />

      <div className="mb-3 flex items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by note ID, MRN, finding, or text…"
          aria-label="Filter encounters"
          className="w-72 max-w-full bg-white border border-zinc-300 rounded-md px-3 py-1.5 text-[13px] placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        {filtered && (
          <span className="text-[12px] text-zinc-500">
            {filtered.length} of {notes.length} notes
          </span>
        )}
      </div>

      {error && <ErrorNote error={error} onRetry={load} />}
      {!notes && !error && <Spinner label="Loading corpus" />}

      {filtered && (
        <div className="bg-white border border-zinc-200 rounded-md">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[14%] md:w-[9%]" />
                <col className="w-[38%] md:w-[24%]" />
                <col className="md:w-[15%]" />
                <col className="hidden md:table-cell" />
                <col />
                <col className="w-[16%] md:w-[10%]" />
              </colgroup>
              <thead>
                <tr className="bg-zinc-50">
                  <th className={th}>Note ID</th>
                  <th className={th}>MRN</th>
                  <th className={th}>Document</th>
                  <th className={th}>Known findings</th>
                  <th className={`${th} hidden md:table-cell`}>Allergies</th>
                  <th className={th}>Planted trap</th>
                  <th className={th}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => {
                  const m = deriveMeta(n);
                  const findings =
                    ['diagnosis', 'medication', 'followup']
                      .filter((t) => m.counts[t])
                      .map((t) => `${m.counts[t]} ${TYPE_ABBR[t]}`)
                      .join(' · ') || '—';
                  const hasAllergy = m.allergies.toLowerCase().includes('penicillin');
                  return (
                    <tr key={n.note_id} className="hover:bg-zinc-50/70 cursor-pointer align-top" onClick={() => navigate(`/audit?note=${n.note_id}`)}>
                      <td className={`${td} font-mono text-[12px] truncate`} title={n.note_id}>{n.note_id}</td>
                      <td className={`${td} font-mono text-[12px] hidden md:table-cell`} >{m.patientId}</td>
                      <td className={td}>
                        <span className="block truncate" title={m.docType}>{m.docType}</span>
                        <span className="block text-[11px] text-zinc-400 truncate lowercase md:hidden" title={m.allergies}>
                          {hasAllergy ? 'penicillin (rash)' : 'none known'}
                        </span>
                      </td>
                      <td className={`${td} text-zinc-600 text-[12px]`}>{findings}</td>
                      <td className={`${td} hidden md:table-cell`}>
                        <Chip tone={hasAllergy ? 'red' : 'zinc'}>{hasAllergy ? 'Penicillin' : 'None'}</Chip>
                      </td>
                      <td className={td}>
                        {m.trapDx ? (
                          <span className="block text-[12px] text-amber-800 truncate" title={`${m.trapDx} — ${m.modality}`}>
                            <span className="text-zinc-400">disputed: </span>
                            {m.trapDx} — {m.modality}
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-[12px]">—</span>
                        )}
                      </td>
                      <td className={`${td} text-right`}>
                        <Link
                          to={`/audit?note=${n.note_id}`}
                          className="text-[12px] text-blue-700 hover:underline whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open audit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
