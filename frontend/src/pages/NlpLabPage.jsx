import React from 'react';
import { useEffect, useState } from 'react';
import { getBPE, getParadox, getTfIdf, getZipf } from '../api';
import { Chip, ErrorNote, PageHeader, Panel, Spinner } from '../components/ui';

const BPE_PRESETS = ['hypercholesterolemia', 'pneumonitis', 'encephalopathy', 'bronchodilator', 'metformin'];

export default function NlpLabPage() {
  const [zipf, setZipf] = useState(null);
  const [zipfErr, setZipfErr] = useState(null);
  const [paradox, setParadox] = useState(null);
  const [paradoxErr, setParadoxErr] = useState(null);
  const [bpeWord, setBpeWord] = useState('pneumonitis');
  const [bpe, setBpe] = useState(null);
  const [bpeErr, setBpeErr] = useState(null);
  const [bpeLoading, setBpeLoading] = useState(false);
  const [query, setQuery] = useState('Acute Kidney Injury');
  const [tfidf, setTfidf] = useState(null);
  const [tfidfErr, setTfidfErr] = useState(null);
  const [tfidfLoading, setTfidfLoading] = useState(false);

  useEffect(() => {
    getZipf().then(setZipf).catch(setZipfErr);
    getParadox().then(setParadox).catch(setParadoxErr);
  }, []);

  const runBpe = (word) => {
    setBpeWord(word);
    setBpeLoading(true);
    setBpeErr(null);
    getBPE(word).then(setBpe).catch(setBpeErr).finally(() => setBpeLoading(false));
  };
  useEffect(() => runBpe('pneumonitis'), []);

  const runTfidf = (q) => {
    setQuery(q);
    setTfidfLoading(true);
    setTfidfErr(null);
    getTfIdf(q, '').then(setTfidf).catch(setTfidfErr).finally(() => setTfidfLoading(false));
  };
  useEffect(() => runTfidf('Acute Kidney Injury'), []);

  const th = 'text-[11px] uppercase tracking-wide text-zinc-500 font-medium px-3 py-1.5 text-left';
  const td = 'px-3 py-1.5 text-[12px] border-t border-zinc-100 font-mono';

  return (
    <div>
      <PageHeader
        eyebrow="Course foundations"
        title="NLP foundations"
        sub="The classical NLP machinery the project rests on, computed live against the 40-note corpus: Zipf's power law, BPE subwords, sparse TF-IDF retrieval, and the distributional-representation failure that motivates the NLI cross-encoder."
      />

      <div className="space-y-5">
        {/* 1 — Distributional representations & negation */}
        <Panel
          title="1 · Distributional representations and the negation problem"
          sub="Hand-built illustrative 8-dim clinical vectors (nlp_foundations.py) — contrasts synonym similarity against negation blindness"
        >
          {paradoxErr && <div className="p-3"><ErrorNote error={paradoxErr} /></div>}
          {!paradox && !paradoxErr && <div className="p-4"><Spinner /></div>}
          {paradox && (
            <div className="px-4 py-3">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="bg-zinc-50">
                      <th className={th}>Word pair</th>
                      <th className={th}>Cosine similarity</th>
                      <th className={th}>Reading</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[paradox.word2vec_similarity_similar_diseases, paradox.word2vec_similarity_negation_failure, paradox.word2vec_drug_condition_association].map((d, i) => (
                      <tr key={i}>
                        <td className={`${td} text-zinc-900`}>{d.pair[0]} ↔ {d.pair[1]}</td>
                        <td className={td}>{d.cosine_similarity}</td>
                        <td className="px-3 py-1.5 text-[12px] border-t border-zinc-100 text-zinc-600">{d.interpretation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-zinc-600">
                Static vectors (Word2Vec / GloVe) place a condition and its negation almost on top of each other:
                <em> ruled out pneumonia</em> keeps the same company as <em> pneumonia</em> (Firth's distributional
                hypothesis), so similarity cannot express direction. Verification therefore uses a cross-encoder
                that classifies entailment vs. contradiction — an asymmetric, sentence-pair judgment — instead of
                symmetric cosine distance.
              </p>
            </div>
          )}
        </Panel>

        {/* 2 — BPE */}
        <Panel title="2 · Byte-pair encoding & subword tokenization" sub="BPE trainer run over the 40-note corpus — merges learned by adjacency frequency (Sennrich et al., 2016)">
          <div className="px-4 py-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {BPE_PRESETS.map((w) => (
                <button
                  key={w}
                  onClick={() => runBpe(w)}
                  className={`px-2.5 py-1 rounded text-[12px] border font-mono transition-colors ${
                    bpeWord === w
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  {w}
                </button>
              ))}
              <input
                value={bpeWord}
                onChange={(e) => runBpe(e.target.value)}
                placeholder="Type a medical term…"
                aria-label="Word to tokenize"
                className="flex-1 min-w-[180px] bg-white border border-zinc-300 rounded-md px-3 py-1.5 text-[13px] font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            {bpeErr && <ErrorNote error={bpeErr} />}
            {bpeLoading && <Spinner label="Tokenizing" />}
            {bpe && !bpeLoading && (
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {bpe.subword_tokens.map((t, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <span className="text-zinc-300 text-[11px]">·</span>}
                      <span className={`font-mono text-[12px] border rounded px-1.5 py-0.5 ${i === 0 ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-zinc-200 text-zinc-700'}`}>
                        {i > 0 && <span className="text-zinc-400">##</span>}{t.replace(/^##/, '')}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-zinc-500">
                  {bpe.token_count} subword tokens · {bpe.merges_learned} merges learned · no OOV entries —
                  a word the corpus knows resolves to a single token; an unseen compound (try
                  &ldquo;hypercholesterolemia&rdquo;) decomposes into the units the corpus taught.
                </p>
              </div>
            )}
          </div>
        </Panel>

        {/* 3 — TF-IDF */}
        <Panel title="3 · Sparse TF-IDF sentence retrieval" sub="POST /api/nlp/tfidf — smoothed TF-IDF, L2-normalized cosine">
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runTfidf(query)}
                placeholder="Query entity…"
                aria-label="TF-IDF query"
                className="flex-1 bg-white border border-zinc-300 rounded-md px-3 py-1.5 text-[13px] focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => runTfidf(query)}
                className="bg-zinc-800 hover:bg-zinc-900 text-white rounded-md px-3 py-1.5 text-[13px] font-medium shrink-0"
              >
                Retrieve
              </button>
            </div>
            {tfidfErr && <ErrorNote error={tfidfErr} />}
            {tfidfLoading && <Spinner label="Vectorizing" />}
            {tfidf && !tfidfLoading && (
              <>
                <ol className="divide-y divide-zinc-100 border border-zinc-200 rounded-md">
                  {tfidf.top_grounding_sentences.map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-4 px-3 py-2">
                      <span className="text-[12.5px] text-zinc-800 flex-1 min-w-0 truncate" title={r.sentence}>{r.sentence}</span>
                      <span className="font-mono text-[11px] text-zinc-400 shrink-0">{r.note_id}</span>
                      <Chip tone={i === 0 && r.cosine_sim > 0 ? 'emerald' : 'zinc'}>cos {r.cosine_sim}</Chip>
                    </li>
                  ))}
                </ol>
                <p className="text-[12px] text-zinc-500">
                  {tfidf.total_sentences_indexed} sentences indexed · score(t,d) = tf · (ln((N+1)/(df+1)) + 1)
                </p>
              </>
            )}
          </div>
        </Panel>

        {/* 4 — Zipf */}
        <Panel title="4 · Zipf's law on the clinical vocabulary" sub="Rank–frequency fit over all 40 notes, GET /api/nlp/zipf">
          {zipfErr && <div className="p-3"><ErrorNote error={zipfErr} /></div>}
          {!zipf && !zipfErr && <div className="p-4"><Spinner /></div>}
          {zipf && (
            <div className="px-4 py-3">
              <dl className="grid grid-cols-3 gap-3 mb-3 max-w-md">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Tokens</dt>
                  <dd className="text-[16px] font-semibold text-zinc-900">{Number(zipf.total_tokens).toLocaleString('en-US')}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Unique types</dt>
                  <dd className="text-[16px] font-semibold text-zinc-900">{Number(zipf.unique_vocab_types).toLocaleString('en-US')}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Type/token ratio</dt>
                  <dd className="text-[16px] font-semibold text-zinc-900">{zipf.type_token_ratio}</dd>
                </div>
              </dl>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="bg-zinc-50">
                      <th className={th}>Rank</th>
                      <th className={th}>Type</th>
                      <th className={th}>Frequency</th>
                      <th className={th}>log₁₀(r)</th>
                      <th className={th}>log₁₀(f)</th>
                      <th className={th}>r·f</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zipf.ranks.slice(0, 10).map((r) => (
                      <tr key={r.rank}>
                        <td className={td}>{r.rank}</td>
                        <td className={`${td} text-zinc-900`}>{r.word}</td>
                        <td className={td}>{r.frequency}</td>
                        <td className={`${td} text-zinc-500`}>{r.log_rank}</td>
                        <td className={`${td} text-zinc-500`}>{r.log_freq}</td>
                        <td className={`${td} font-semibold`}>{r.zipf_constant}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[12px] text-zinc-500">
                r·f stays roughly flat for the top ranks — frequency ∝ 1/rank — with grammatical items
                dominating the head and specific clinical findings scattered in the long tail.
              </p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
