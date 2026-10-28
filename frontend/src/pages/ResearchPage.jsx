import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api';
import { Card, Btn, Spinner, Err, MiniBar, CMCell, MetricBar, fmt, SectionHeader, Badge } from '../components/ui';
import { useToast } from '../components/toast';
import { BarChart3, Compass, BookOpen, ChevronDown, ChevronUp, RefreshCw, TrendingUp, Award } from 'lucide-react';
import clsx from 'clsx';

const VIVA_QA = [
  {
    category: 'Distributional Semantics',
    q: 'What is the distributional hypothesis and how does it justify Word2Vec and GloVe in clinical text?',
    a: 'The distributional hypothesis (Harris, 1954; Firth, 1957) states that words that occur in similar contexts tend to have similar meanings ("You shall know a word by the company it keeps"). In psychiatric text, patients rarely use textbook clinical terminology like "anhedonia" or "psychomotor agitation." Instead, they write "nothing brings me joy anymore" or "can\'t get out of bed." Because terms like "joy", "pleasure", "interest", and "fun" co-occur near common negative affective contexts ("lost", "miss", "stopped"), distributional models map them into close geometric proximity without needing manual thesauri.',
  },
  {
    category: 'Model Mathematics',
    q: 'How does Word2Vec skip-gram with negative sampling (SGNS) work mathematically?',
    a: 'For each center word w_t in a sentence, skip-gram maximizes the probability of predicting context words w_{t+j} within window c. To avoid computing the expensive full-vocabulary softmax denominator, negative sampling approximates the objective using binary logistic regression: L = log σ(v\'_{w_o}^T v_{w_i}) + ∑_{k=1}^K E_{w_k ~ P_n(w)} [log σ(-v\'_{w_k}^T v_{w_i})]. Here, K negative words are drawn from the unigram distribution raised to the 0.75 power. In our implementation, dim=100, window=5, negative=5, trained over 5 epochs with Adam/SGD.',
  },
  {
    category: 'Model Mathematics',
    q: 'How does GloVe differ from Word2Vec in its training objective?',
    a: 'While Word2Vec is a local prediction-based model that streams over sentence windows one token at a time, GloVe (Pennington et al., 2014) is a global count-based log-bilinear model. GloVe first compiles a global co-occurrence matrix X across the entire corpus. It then minimizes a weighted least-squares loss: J = ∑_{i,j=1}^V f(X_{i,j}) (w_i^T w̃_j + b_i + b̃_j - log X_{i,j})^2, where f(x) = (x/x_{max})^α (with α=0.75) caps the influence of extremely frequent stop words. This allows GloVe to exploit global statistics efficiently while preserving linear substructures.',
  },
  {
    category: 'Empirical Findings',
    q: 'Why did the TF-IDF baseline achieve higher F1 (94.5%) than the 100-d embeddings (90.0% W2V, 76.0% GloVe) on Reddit classification?',
    a: 'This is a standard finding in NLP benchmark literature. TF-IDF uses an 8,000-dimensional sparse representation where words like "depression", "antidepressant", or "suicide" have dedicated dimensions with high inverse document frequency. On a clean binary corpus where the target class explicitly mentions explicit keywords, high-dimensional bag-of-words classifiers have high separability. Conversely, 100-dimensional mean embedding pooling compresses the sentence, causing lexical dilution. However, in retrieval tasks where patients use paraphrasing (e.g. searching for "insomnia" against "awake all night"), embeddings substantially outperform TF-IDF because exact word matching fails.',
  },
  {
    category: 'Information Retrieval',
    q: 'How does MoodTrace perform meaning-based evidence retrieval and negation handling?',
    a: 'MoodTrace expands the clinician\'s query terms using the top-k nearest semantic neighbors in the learned embedding space, constructing a normalized query representation vector. Passages in the patient\'s note history are split into sentences and scored via cosine similarity. To prevent false-positive matching caused by negated statements (e.g. "I have no trouble sleeping"), a negation context window scans for negation triggers ("no", "not", "never", "without", "hardly") within 3 tokens of a matched keyword and penalizes the similarity score (score *= 0.3).',
  },
  {
    category: 'Sequential Modeling',
    q: 'Why is a Bidirectional LSTM (BiLSTM) necessary for complex clinical phrases like "he feels lost in his own thoughts"?',
    a: 'Static embedding bags (mean Word2Vec or GloVe) discard word order and grammatical dependency. Phrases like "lost in his own thoughts" contain functional words ("in", "his", "own") alongside psychological markers ("lost", "thoughts"). A BiLSTM processes tokens sequentially in both forward and backward directions, capturing the contextual dependency that "lost" modifies the internal cognitive domain ("thoughts") rather than a physical orientation ("lost keys"). Self-attention pooling over the BiLSTM states then weights the rumination semantics, allowing accurate retrieval against clinical passages detailing brain fog and wandering thoughts even without exact lexical overlap.',
  },
  {
    category: 'Clinical RAG (Project 0525)',
    q: 'How does Clinical Retrieval-Augmented Generation (RAG) guarantee factual grounding and prevent clinical hallucinations?',
    a: 'Standard generative LLMs can hallucinate psychiatric diagnoses or invent non-existent medical notes. In MoodTrace Clinical RAG (0525), synthesis is strictly evidence-grounded: the system first queries our hybrid ensemble (BiLSTM + BM25) to retrieve the highest-confidence longitudinal sentences. Every synthesized clinical finding is explicitly anchored to a note ID, visit date, and clinical assertion (PATIENT_AFFIRMED, NEGATED, or FAMILY_HISTORY). If no passage exceeds the relevance threshold, the engine explicitly abstains rather than extrapolating.',
  },
  {
    category: 'Healthcare Privacy (Project 0528)',
    q: 'How does the HIPAA Safe Harbor De-identification engine scrub Protected Health Information (PHI) without destroying clinical meaning?',
    a: 'Under HIPAA Safe Harbor (45 CFR § 164.514(b)(2)), 18 categories of identifiers (names, dates, MRNs, ages >89, contact info, facilities) must be removed. A naive regex or entity tagger often over-redacts clinical phrases (e.g. tagging "Parkinson\'s disease", "PHQ-9", or "BDI-II" as names/IDs). Our de-identifier enforces a strict medical whitelist protecting diagnostic scales, eponyms, symptoms, and psychotropic medications, while scrubbing patient names, dates, and medical record identifiers into standardized tags ([PATIENT_NAME], [DATE]) or synthetic surrogates.',
  },
  {
    category: 'Safety & Clinical Limits',
    q: 'What are the ethical safeguards and limitations of this system?',
    a: '1. Research Prototype: MoodTrace is strictly an academic research exploration, not a medical device. 2. Domain Shift: Embeddings trained on Reddit text reflect social media colloquialisms, which differ from structured clinical documentation. 3. No Automated Diagnosis: The system never outputs a diagnosis or treatment plan; it only acts as an evidence-retrieval aid, presenting exact source sentences with dates and note IDs for clinician verification.',
  },
];

const SEEDS = ['hopeless', 'sleep', 'worthless', 'tired', 'interest', 'cry', 'anxiety'];

const LS_VIVA_READ = 'moodtrace_viva_read';
function lsGet(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

export default function ResearchPage() {
  const [tab, setTab]         = useState('eval');
  const [_status, setStatus]  = useState(null);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [activeModel, setActiveModel] = useState('TF-IDF');
  const [openItems, setOpenItems] = useState({ 0: true, 1: true });
  const [readSet, setReadSet] = useState(() => lsGet(LS_VIVA_READ, []));
  const toast = useToast();

  // Neighbor state
  const [nModel, setNModel]     = useState('word2vec');
  const [nQuery, setNQuery]     = useState('hopeless');
  const [nData, setNData]       = useState(null);
  const [nLoading, setNLoading] = useState(false);
  const [nErr, setNErr]         = useState('');

  useEffect(() => { lsSet(LS_VIVA_READ, readSet); }, [readSet]);

  const refreshStatus = () => api.trainStatus().then(setStatus).catch(() => {});

  useEffect(() => {
    refreshStatus();
    api.results().then(d => {
      if (d?.results) { setData(d); setActiveModel(d.results[0]?.model ?? 'TF-IDF'); }
    }).catch(() => {});
  }, []);

  const searchNeighbors = useCallback((word) => {
    const w = (word ?? nQuery).trim().toLowerCase();
    if (!w) return;
    setNQuery(w);
    setNLoading(true); setNErr('');
    api.neighbors(nModel, w)
      .then(d => { setNData(d); if (!d?.in_vocab) toast.warning('Word not in vocab', `"${w}" was not found in the ${nModel} vocabulary`); })
      .catch(e => { setNErr(e.message); toast.error('Neighbor search failed', e.message); })
      .finally(() => setNLoading(false));
  }, [nModel, nQuery, toast]);

  useEffect(() => { searchNeighbors('hopeless'); }, []); // eslint-disable-line

  const runEval = () => {
    setLoading(true); setErr('');
    api.evaluate()
      .then(d => {
        setData(d);
        setActiveModel(d.results?.[0]?.model ?? 'TF-IDF');
        toast.success('Evaluation complete', `${d.results?.length ?? 0} models evaluated on held-out test set`);
      })
      .catch(e => { setErr(e.message); toast.error('Evaluation failed', e.message); })
      .finally(() => setLoading(false));
  };

  const detail = data?.results?.find(r => r.model === activeModel);
  const best   = data?.results?.reduce((a, b) => b.f1 > a.f1 ? b : a, data?.results?.[0]);
  const vivaProgress = readSet.length;

  const markRead = (idx) => {
    setReadSet(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  };

  const TABS = [
    { id: 'eval',      label: 'Model Benchmarks', icon: BarChart3 },
    { id: 'neighbors', label: 'Semantic Geometry', icon: Compass   },
    { id: 'viva',      label: 'Viva Q&A',          icon: BookOpen  },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <SectionHeader
        title="Research & Benchmarks"
        sub="Empirical validation on held-out test split, distributional vector spaces, and academic viva defense documentation."
        actions={
          <div className="flex gap-1 border border-slate-200 rounded-xl p-1 bg-white shadow-sm">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all',
                    tab === t.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                  {t.id === 'viva' && vivaProgress > 0 && (
                    <span className="ml-0.5 text-[10px] bg-blue-500 text-white rounded-full px-1.5 py-0.5 leading-none font-bold">
                      {vivaProgress}/{VIVA_QA.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        }
      />

      {/* ── Tab 1: Model Benchmarks ── */}
      {tab === 'eval' && (
        <div className="space-y-5">
          <Card className="p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-[14px] font-semibold text-slate-900">Held-Out Test Set Performance</h3>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Binary classification (depressive vs non-depressive) on 1,159 test posts with logistic regression.
                </p>
              </div>
              <Btn variant="outline" size="sm" loading={loading} onClick={runEval}>
                <RefreshCw className="h-3.5 w-3.5" /> Re-Evaluate
              </Btn>
            </div>

            {err && <Err message={err} onRetry={runEval} />}

            {data?.results && (
              <div className="space-y-6">
                {/* F1 Score Visual Bar Chart */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5" /> F1 Score Comparison
                  </div>
                  <div className="space-y-2.5">
                    {data.results.map((r, i) => (
                      <motion.div
                        key={r.model}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                      >
                        <MetricBar label={r.model} value={r.f1} best={r.model === best?.model} />
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Best model callout */}
                {best && (
                  <div className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
                    <Award className="h-5 w-5 text-blue-600 shrink-0" />
                    <div className="text-[13px]">
                      <span className="font-semibold text-blue-900">{best.model}</span>
                      <span className="text-blue-700"> achieved the best F1: </span>
                      <span className="font-mono font-bold text-blue-900">{fmt.pct(best.f1)}</span>
                      <span className="text-blue-600"> with accuracy {fmt.pct(best.accuracy)}</span>
                    </div>
                  </div>
                )}

                {/* Comparative Table */}
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 text-left font-semibold">Model Architecture</th>
                      <th className="py-2.5 text-right font-semibold">Accuracy</th>
                      <th className="py-2.5 text-right font-semibold">Precision</th>
                      <th className="py-2.5 text-right font-semibold">Recall</th>
                      <th className="py-2.5 text-right font-semibold">F1 Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.results.map(r => {
                      const isBest = r.model === best?.model;
                      return (
                        <tr key={r.model} className={clsx('transition-colors', isBest ? 'bg-blue-50/50' : 'hover:bg-slate-50/70')}>
                          <td className="py-3 font-medium text-slate-900 flex items-center gap-2">
                            <span>{r.model}</span>
                            {isBest && <Badge tone="blue" dot>Best F1</Badge>}
                          </td>
                          <td className="py-3 text-right font-mono text-slate-700">{fmt.pct(r.accuracy)}</td>
                          <td className="py-3 text-right font-mono text-slate-700">{fmt.pct(r.precision)}</td>
                          <td className="py-3 text-right font-mono text-slate-700">{fmt.pct(r.recall)}</td>
                          <td className={clsx('py-3 text-right font-mono font-bold', isBest ? 'text-blue-700' : 'text-slate-900')}>
                            {fmt.pct(r.f1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Matrix Breakdown */}
                <div className="pt-2">
                  <div className="flex gap-1.5 mb-3">
                    {data.results.map(r => (
                      <button
                        key={r.model}
                        onClick={() => setActiveModel(r.model)}
                        className={clsx(
                          'px-3 py-1 rounded-lg text-[12px] font-medium transition-colors',
                          activeModel === r.model ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        {r.model} Detail
                      </button>
                    ))}
                  </div>

                  {detail && (
                    <div className="grid sm:grid-cols-2 gap-5 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">Confusion Matrix ({activeModel})</span>
                        <table className="text-[11px]">
                          <thead>
                            <tr>
                              <th className="px-2 py-1 text-slate-400 font-normal text-right text-[10px]">Pred →</th>
                              {(data.labels ?? ['Non-Dep', 'Dep']).map(l => (
                                <th key={l} className="px-2 py-1 text-slate-600 font-medium capitalize text-center">{l}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {detail.confusion_matrix?.map((row, i) => (
                              <tr key={i}>
                                <td className="pr-3 py-1 text-right text-[11px] text-slate-500 capitalize">
                                  {(data.labels ?? ['Non-Dep', 'Dep'])[i]}
                                </td>
                                {row.map((v, j) => (
                                  <CMCell key={j} value={v} max={Math.max(...detail.confusion_matrix.flat())} />
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">Per-Class Metrics</span>
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400">
                              <th className="py-1 text-left font-medium">Class</th>
                              <th className="py-1 text-right font-medium">Precision</th>
                              <th className="py-1 text-right font-medium">Recall</th>
                              <th className="py-1 text-right font-medium">F1</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {Object.entries(detail.per_class ?? {}).map(([cls, m]) => (
                              <tr key={cls}>
                                <td className="py-1.5 font-medium text-slate-700 capitalize">{cls}</td>
                                <td className="py-1.5 text-right font-mono text-slate-600">{fmt.pct(m.precision)}</td>
                                <td className="py-1.5 text-right font-mono text-slate-600">{fmt.pct(m.recall)}</td>
                                <td className="py-1.5 text-right font-mono text-slate-900 font-semibold">{fmt.pct(m.f1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Top Features */}
                {data.top_depressive_words && (
                  <div className="grid sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 text-[11px]">
                    <div>
                      <span className="text-slate-400 font-medium uppercase tracking-wider block mb-1.5">Top Depressive Tokens (TF-IDF LR)</span>
                      <div className="flex flex-wrap gap-1">
                        {data.top_depressive_words.map(w => (
                          <span key={w} className="font-mono bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">{w}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium uppercase tracking-wider block mb-1.5">Top Non-Depressive Tokens</span>
                      <div className="flex flex-wrap gap-1">
                        {data.top_non_depressive_words.map(w => (
                          <span key={w} className="font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">{w}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!data && !loading && (
              <div className="py-10 text-center text-[13px] text-slate-400 space-y-3">
                <BarChart3 className="h-8 w-8 mx-auto text-slate-300" />
                <p>No evaluation data loaded yet.</p>
                <Btn size="sm" onClick={runEval} loading={loading}>Run Evaluation</Btn>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Tab 2: Semantic Geometry ── */}
      {tab === 'neighbors' && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-[14px] font-semibold text-slate-900">Distributional Vector Neighbors</h3>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Inspect cosine similarity in the learned 100-dimensional vector space.
              </p>
            </div>
            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
              {['word2vec', 'glove'].map(m => (
                <button key={m} onClick={() => { setNModel(m); searchNeighbors(nQuery); }}
                  className={clsx(
                    'px-2.5 py-1 rounded text-[11px] font-mono uppercase transition-all',
                    nModel === m ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  )}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SEEDS.map(s => (
              <button key={s} onClick={() => searchNeighbors(s)}
                className={clsx(
                  'px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all',
                  nQuery === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                )}>
                {s}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={nQuery}
              onChange={e => setNQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchNeighbors(nQuery)}
              placeholder="Type any word…"
              className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2 text-[13px] focus:outline-none focus:border-blue-400 bg-slate-50/40 focus:bg-white transition-all"
            />
            <Btn onClick={() => searchNeighbors(nQuery)} size="sm" loading={nLoading}>Search</Btn>
          </div>

          {nErr && <Err message={nErr} />}

          {nData?.in_vocab && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 pt-2">
              <div className="flex justify-between text-[11px] text-slate-400 border-b border-slate-100 pb-1">
                <span>Nearest Semantic Neighbor ({nModel})</span>
                <span>Cosine Similarity</span>
              </div>
              {nData.neighbors.map((n, i) => (
                <motion.div
                  key={n.word}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-[11px] font-mono text-slate-400 w-5">#{i + 1}</span>
                  <div className="flex-1">
                    <MiniBar label={n.word} value={n.similarity} max={1} />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {nData && !nData.in_vocab && (
            <div className="py-8 text-center">
              <div className="text-2xl mb-2">🔤</div>
              <div className="text-[13px] font-semibold text-slate-700">"{nQuery}" not in vocabulary</div>
              <p className="text-[12px] text-slate-400 mt-1">Try one of the seed words above, or a common English word.</p>
            </div>
          )}
        </Card>
      )}

      {/* ── Tab 3: Viva Q&A ── */}
      {tab === 'viva' && (
        <div className="space-y-4">
          {/* Progress */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
            <div className="flex-1">
              <div className="flex items-center justify-between text-[12px] mb-1.5">
                <span className="font-semibold text-slate-700">Viva Defense Preparation Progress</span>
                <span className="font-mono text-blue-600 font-bold">{vivaProgress} / {VIVA_QA.length} reviewed</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(vivaProgress / VIVA_QA.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-blue-600 rounded-full"
                />
              </div>
            </div>
            {vivaProgress === VIVA_QA.length && (
              <div className="text-emerald-600 flex items-center gap-1.5 text-[13px] font-semibold shrink-0">
                <Award className="h-4.5 w-4.5" /> Ready!
              </div>
            )}
          </div>

          <Card className="p-5 space-y-3">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-semibold text-slate-900">Academic Viva Defense Questions</h3>
              <p className="text-[12px] text-slate-500 mt-0.5">Authoritative answers to core examiner questions. Mark each as reviewed.</p>
            </div>

            <div className="space-y-3">
              {VIVA_QA.map((item, idx) => {
                const isOpen = !!openItems[idx];
                const isRead = readSet.includes(idx);
                return (
                  <div key={idx} className={clsx(
                    'border rounded-xl overflow-hidden bg-white transition-colors',
                    isRead ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'
                  )}>
                    <button
                      onClick={() => setOpenItems(p => ({ ...p, [idx]: !p[idx] }))}
                      className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[11px] font-mono text-blue-600 font-bold shrink-0">Q{idx + 1}</span>
                        <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium shrink-0">{item.category}</span>
                        <span className="text-[13px] font-medium text-slate-900 truncate">{item.q}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isRead && <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-100 px-2 py-0.5 rounded-full">✓ Read</span>}
                        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </div>
                    </button>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="px-5 pb-4 pt-1 text-[12px] text-slate-700 leading-relaxed bg-slate-50/50 border-t border-slate-100"
                      >
                        <p className="pl-3 border-l-2 border-blue-500 leading-relaxed">{item.a}</p>
                        <button
                          onClick={() => markRead(idx)}
                          className={clsx(
                            'mt-3 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors',
                            isRead
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-slate-900 text-white hover:bg-slate-700'
                          )}
                        >
                          {isRead ? '✓ Marked as read' : 'Mark as reviewed'}
                        </button>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
