import { useState } from 'react';
import { SectionHeader, Card, Badge } from '../components/ui';
import { HelpCircle, ChevronDown, ChevronUp, Cpu, Database, ShieldAlert, Award } from 'lucide-react';
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
    category: 'Methodology & Reproducibility',
    q: 'How is experimental reproducibility ensured in this project?',
    a: 'Every step is deterministic and strictly seeded. The raw dataset (7,731 posts) is partitioned into 70% train (5,412), 15% validation, and 15% test (1,159) using a stratified seed of 42. Word2Vec and GloVe weight initialization and negative sampling use seed=42. Logistic regression classifiers are fitted with random_state=42 and max_iter=1000. All evaluation metrics are calculated strictly on the held-out test split, which is never seen during vocabulary building or vector fitting.',
  },
  {
    category: 'Safety & Clinical Limits',
    q: 'What are the ethical safeguards and limitations of this system?',
    a: '1. Research Prototype: MoodTrace is strictly an academic research exploration, not a medical device. 2. Domain Shift: Embeddings trained on Reddit text reflect social media colloquialisms, which differ from structured clinical documentation. 3. No Automated Diagnosis: The system never outputs a diagnosis or treatment plan; it only acts as an evidence-retrieval aid, presenting exact source sentences with dates and note IDs for clinician verification.',
  },
];

export default function AboutPage() {
  const [openItems, setOpenItems] = useState({ 0: true, 1: true });
  const [filterCat, setFilterCat] = useState('All');

  const categories = ['All', 'Distributional Semantics', 'Model Mathematics', 'Empirical Findings', 'Information Retrieval', 'Safety & Clinical Limits'];

  const filtered = filterCat === 'All'
    ? VIVA_QA
    : VIVA_QA.filter(q => q.category === filterCat);

  const toggle = (idx) => {
    setOpenItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <SectionHeader
        title="Methodology, Architecture & Viva Guide"
        sub="Technical specifications, mathematical foundations, and research defense documentation for MoodTrace."
      />

      {/* Overview Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-4 space-y-2 border-blue-200 bg-blue-50/40">
          <div className="flex items-center gap-2 text-blue-700 font-semibold text-[13px]">
            <Database className="h-4 w-4" /> Research Corpus
          </div>
          <p className="text-[12px] text-slate-600 leading-relaxed">
            7,731 posts from <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-blue-200">mrjunos/depression-reddit-cleaned</code> (5,412 train / 1,159 test).
          </p>
        </Card>

        <Card className="p-4 space-y-2 border-violet-200 bg-violet-50/40">
          <div className="flex items-center gap-2 text-violet-700 font-semibold text-[13px]">
            <Cpu className="h-4 w-4" /> Learned Embeddings
          </div>
          <p className="text-[12px] text-slate-600 leading-relaxed">
            100-dimensional Word2Vec (skip-gram, window 5, neg 5) and GloVe (co-occurrence matrix, weighted least squares), 5,093 vocabulary words.
          </p>
        </Card>

        <Card className="p-4 space-y-2 border-emerald-200 bg-emerald-50/40">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-[13px]">
            <Award className="h-4 w-4" /> Retrieval Architecture
          </div>
          <p className="text-[12px] text-slate-600 leading-relaxed">
            Query expansion via nearest semantic neighbors, cosine scoring with windowed negation penalty, and BDI-II longitudinal tracking.
          </p>
        </Card>
      </div>

      {/* Mathematical Formulations Panel */}
      <Card className="p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-[14px] font-semibold text-slate-900">Mathematical Formulation of Evaluated Models</h3>
          <p className="text-[12px] text-slate-500 mt-0.5">Exact training objectives implemented in Python and NumPy:</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 text-[12px]">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 font-mono">1. Word2Vec (Skip-Gram with Negative Sampling)</span>
              <Badge tone="blue">Local Window</Badge>
            </div>
            <div className="p-3 bg-white rounded-lg font-mono text-[11px] text-slate-800 border border-slate-200/80 overflow-x-auto">
              L = log σ(v'_wo · v_wi) + ∑_k log σ(-v'_wk · v_wi)
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Maximizes dot product of true co-occurring word pairs while minimizing dot product with K randomly sampled noise words drawn from the unigram distribution P_n(w)^0.75.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 font-mono">2. GloVe (Global Vectors for Word Representation)</span>
              <Badge tone="violet">Global Counts</Badge>
            </div>
            <div className="p-3 bg-white rounded-lg font-mono text-[11px] text-slate-800 border border-slate-200/80 overflow-x-auto">
              J = ∑_i,j f(X_ij) · (w_i · w̃_j + b_i + b̃_j - log X_ij)²
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Fits a weighted least-squares regression model over log co-occurrence counts. The weighting function f(X_ij) prevents frequent stopwords from dominating vector geometry.
            </p>
          </div>
        </div>
      </Card>

      {/* Viva Q&A Defense Section */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-blue-600" />
              <h3 className="text-[14px] font-semibold text-slate-900">Academic Viva Defense Questions</h3>
            </div>
            <p className="text-[12px] text-slate-500 mt-0.5">Comprehensive answers to external examiner and viva defense inquiries.</p>
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap gap-1">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setFilterCat(c)}
                className={clsx(
                  'text-[11px] px-2.5 py-1 rounded-md transition-colors',
                  filterCat === c
                    ? 'bg-slate-900 text-white font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-1">
          {filtered.map((item, idx) => {
            const isOpen = !!openItems[idx];
            return (
              <div
                key={idx}
                className="border border-slate-200 rounded-xl overflow-hidden transition-all bg-white hover:border-slate-300">
                <button
                  onClick={() => toggle(idx)}
                  className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[11px] font-mono text-blue-600 font-semibold shrink-0">Q{idx + 1}</span>
                    <span className="text-[13px] font-medium text-slate-900">{item.q}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tone="slate">{item.category}</Badge>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 pt-1 text-[12px] text-slate-700 leading-relaxed bg-slate-50/50 border-t border-slate-100">
                    <p className="pl-3 border-l-2 border-blue-500">{item.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Safety & Compliance */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-start gap-4">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-[12px] text-slate-600 space-y-1">
          <div className="font-semibold text-slate-900">Clinical Safety & Scope Disclosure</div>
          <p className="leading-relaxed">
            MoodTrace is an NLP research system developed for coursework and academic demonstration.
            Patient check-ins and queues in this demo are synthetically generated, and embeddings are trained on public Reddit data.
            This system does not make clinical decisions, administer prescriptions, or replace clinical judgment. All retrieval results require human clinician verification.
          </p>
        </div>
      </div>
    </div>
  );
}
