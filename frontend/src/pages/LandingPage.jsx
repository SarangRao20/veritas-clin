import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Search, Brain, BarChart3, ChevronRight, Shield, Clock, FileText, Workflow } from 'lucide-react';

const fade  = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } };
const stagger = { show: { transition: { staggerChildren: 0.1 } } };

const FEATURES = [
  {
    icon: Search,
    title: 'Semantic search',
    desc: 'Ask in plain language. Find "can\'t sleep" even if the patient wrote "waking every night". Word2Vec and GloVe retrieve meaning, not just matching words.',
  },
  {
    icon: Brain,
    title: 'NLP comparison',
    desc: 'TF-IDF, Word2Vec, and GloVe run side-by-side on the same query. See exactly where embeddings outperform keywords and why.',
  },
  {
    icon: BarChart3,
    title: 'Symptom timeline',
    desc: 'Track which BDI-II symptom themes appear across a patient\'s entries over time. Surface change patterns before the appointment.',
  },
  {
    icon: FileText,
    title: 'Evidence-grounded',
    desc: 'Every result links back to the exact source sentence and date. The clinician reads the original text — the system never summarises or diagnoses.',
  },
  {
    icon: Clock,
    title: 'Review queue',
    desc: 'A ranked patient list ordered by language signal. Prioritise who to review this session without reading every entry.',
  },
  {
    icon: Shield,
    title: 'No clinical claims',
    desc: 'MoodTrace is a research prototype. Results are for academic exploration. All data is synthetic and no patient records are processed.',
  },
];

const STEPS = [
  { n: '01', title: 'Select a patient',  desc: 'Open a patient from the review queue.' },
  { n: '02', title: 'Ask a question',    desc: 'Type a symptom — "trouble sleeping", "no interest in activities".' },
  { n: '03', title: 'Review evidence',   desc: 'Read the ranked source sentences, with dates and source notes.' },
  { n: '04', title: 'Compare methods',   desc: 'Switch retrievers. See where GloVe finds paraphrases TF-IDF misses.' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">

      {/* ── Navbar ── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <span className="text-[14px] font-semibold tracking-tight">MoodTrace</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-slate-500 hidden sm:inline">Research prototype</span>
            <button
              onClick={() => navigate('/pipeline')}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-[13px] font-medium px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
              <Workflow className="h-3.5 w-3.5" /> Pipeline Studio
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div variants={stagger} initial="hidden" animate="show">
            <motion.div variants={fade}>
              <span className="inline-flex items-center gap-2 border border-blue-200 text-blue-700 text-[12px] font-medium px-3 py-1 rounded-full bg-blue-50 mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                NLP · Word2Vec · GloVe · BDI-II Symptom Mapping
              </span>
            </motion.div>

            <motion.h1 variants={fade}
              className="text-[42px] sm:text-[56px] font-bold text-slate-900 leading-[1.1] tracking-tight mb-6">
              Find symptom-relevant passages
              <br />
              <span className="text-blue-600">in patient language</span>
            </motion.h1>

            <motion.p variants={fade}
              className="text-[17px] text-slate-600 max-w-2xl mx-auto leading-relaxed mb-10">
              MoodTrace compares TF-IDF, Word2Vec, and GloVe retrieval on synthetic patient-note examples.
              Its embeddings were trained on Reddit posts, not clinical records. Built for NLP research, not care decisions.
            </motion.p>

            <motion.div variants={fade} className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/pipeline')}
                className="flex items-center gap-2 bg-blue-600 text-white px-7 py-3 rounded-xl text-[15px] font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                <Workflow className="h-4 w-4" /> Live Pipeline Studio
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 border border-slate-200 text-slate-700 px-6 py-3 rounded-xl text-[15px] font-medium hover:bg-slate-50 transition-all">
                Patient Cohort <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('/research')}
                className="flex items-center gap-2 border border-slate-200 text-slate-700 px-6 py-3 rounded-xl text-[15px] font-medium hover:bg-slate-50 transition-all">
                Evaluation <BarChart3 className="h-4 w-4" />
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6 py-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-400">
          Separate research-corpus metrics · not measurements of clinical retrieval
        </div>
        <div className="max-w-5xl mx-auto px-6 pb-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { v: '7,731',   l: 'Reddit research posts' },
            { v: '5,093',   l: 'Embedding vocabulary' },
            { v: '21',      l: 'BDI-II themes mapped' },
            { v: '94.5%',   l: 'TF-IDF accuracy on held-out Reddit data' },
          ].map(s => (
            <div key={s.l} className="text-center">
              <div className="text-[28px] font-bold font-mono text-slate-900">{s.v}</div>
              <div className="text-[12px] text-slate-500 mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.4 }} className="mb-12">
            <div className="text-[12px] font-medium text-blue-600 uppercase tracking-wider mb-2">Workflow</div>
            <h2 className="text-[32px] font-bold text-slate-900">How a clinician uses MoodTrace</h2>
          </motion.div>
          <div className="grid sm:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <motion.div key={s.n} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="relative">
                <div className="text-[13px] font-mono font-bold text-blue-300 mb-3">{s.n}</div>
                <div className="text-[15px] font-semibold text-slate-900 mb-1.5">{s.title}</div>
                <div className="text-[13px] text-slate-500 leading-relaxed">{s.desc}</div>
                {i < STEPS.length - 1 && (
                  <div className="hidden sm:block absolute right-0 top-8 text-slate-300">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} className="mb-12">
            <div className="text-[12px] font-medium text-blue-600 uppercase tracking-wider mb-2">Capabilities</div>
            <h2 className="text-[32px] font-bold text-slate-900">What the system does</h2>
          </motion.div>
          <div className="grid sm:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-200 hover:shadow-sm transition-all">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                  <f.icon className="h-4.5 w-4.5 text-blue-600" />
                </div>
                <div className="text-[14px] font-semibold text-slate-900 mb-2">{f.title}</div>
                <div className="text-[13px] text-slate-500 leading-relaxed">{f.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NLP explanation ── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}>
            <div className="text-[12px] font-medium text-blue-600 uppercase tracking-wider mb-3">Why NLP matters</div>
            <h2 className="text-[28px] font-bold text-slate-900 leading-tight mb-4">
              Embeddings find meaning,<br />not just keywords
            </h2>
            <p className="text-[14px] text-slate-600 leading-relaxed mb-4">
              A query like "sleep problems" can be compared against paraphrased note text. This demo illustrates retrieval behavior on synthetic examples; it does not establish clinical performance.
            </p>
            <p className="text-[14px] text-slate-600 leading-relaxed">
              Word2Vec and GloVe learn that <em>exhausted, waking, insomnia, rest</em> share similar contexts, so a query expands into semantically related terms — retrieving evidence a keyword search would skip.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-slate-900 rounded-2xl p-5 font-mono text-[12px] space-y-3">
            {[
              { q: 'Query',  t: '"sleep problems"', c: 'text-blue-400' },
              { q: 'TF-IDF', t: '"sleep" exact → 1 match', c: 'text-amber-400' },
              { q: 'W2Vec',  t: 'sleep → waking, insomnia, rest, tired…', c: 'text-emerald-400' },
              { q: 'GloVe',  t: 'sleep → exhausted, night, awake, bed…', c: 'text-violet-400' },
              { q: 'Result', t: '12 evidence passages retrieved', c: 'text-slate-300' },
            ].map(r => (
              <div key={r.q} className="flex gap-3">
                <span className="text-slate-500 w-14 shrink-0">{r.q}</span>
                <span className={r.c}>{r.t}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6 bg-blue-600">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-[32px] font-bold text-white mb-4">Ready to explore?</h2>
            <p className="text-[15px] text-blue-200 mb-8">Open the dashboard, pick a patient, and run your first symptom search.</p>
            <button onClick={() => navigate('/dashboard')}
              className="bg-white text-blue-700 font-semibold px-8 py-3 rounded-xl text-[15px] hover:bg-blue-50 transition-colors shadow-lg">
              Open dashboard →
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-blue-600 flex items-center justify-center">
              <Activity className="h-3 w-3 text-white" />
            </div>
            <span className="text-[13px] font-semibold text-slate-700">MoodTrace</span>
          </div>
          <span className="text-[11px] text-slate-400 text-center">
            PICT NLP coursework · research prototype · synthetic data · not for clinical use
          </span>
          <span className="text-[11px] text-slate-400">Python · NumPy · FastAPI · React</span>
        </div>
      </footer>
    </div>
  );
}
