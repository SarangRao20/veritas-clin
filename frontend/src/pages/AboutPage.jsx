const QA = [
  {
    q: 'What real problem does this solve?',
    a: 'Depression is underdiagnosed in primary care. Patients often describe their mental state in free text — intake forms, discharge notes, online communities. This project asks whether NLP can automatically flag language associated with depression, which could assist — not replace — clinical screening.',
  },
  {
    q: 'What is the dataset?',
    a: 'mrjunos/depression-reddit-cleaned: 7,731 Reddit posts from r/depression (labelled 1) and r/happy (labelled 0). It is publicly available for research. The class balance is nearly 50/50 (3,831 depressive / 3,900 non-depressive), which makes the evaluation straightforward.',
  },
  {
    q: 'How does Word2Vec work here?',
    a: 'We train a skip-gram model with negative sampling from scratch on the training split. For each word in a post, the model is asked to predict surrounding words within a window of 5. Words that appear in similar contexts (e.g., "hopeless" and "worthless" both near "feel", "never", "anymore") end up with similar vectors. A post is represented by the mean of its word vectors. Dimensions: 100. Epochs: 5.',
  },
  {
    q: 'How does GloVe differ from Word2Vec?',
    a: 'GloVe first builds a global co-occurrence matrix — how often does word A appear near word B across the entire corpus? It then fits a weighted least-squares model so that the dot product of two word vectors equals the log of their co-occurrence count. Word2Vec is a local, prediction-based model (one sentence at a time). GloVe is a global, count-based model. On a corpus this size (~160k tokens), both learn useful clinical semantics.',
  },
  {
    q: 'Why does TF-IDF score higher than the embeddings?',
    a: 'TF-IDF has 8,000 feature dimensions — one per vocabulary term. The word "depression" itself is a strong, direct signal and TF-IDF weights it heavily. Word2Vec and GloVe use 100-dimensional mean vectors, which compress and smooth the signal. On a clean, well-separated dataset like this one, the bag-of-words model benefits from that direct signal. Embeddings would outperform TF-IDF on noisier, more ambiguous text where synonyms and paraphrasing matter more.',
  },
  {
    q: 'What do the neighbors of "hopeless" tell us?',
    a: 'In GloVe, the nearest neighbors of "hopeless" are trapped, numb, worthless, weak — clinically meaningful associations that a TF-IDF model cannot capture. This is the core value of distributional semantics: the model learns that these words behave similarly in context, even without being told they are synonyms.',
  },
  {
    q: 'How do you reproduce the exact results?',
    a: 'Everything is seeded: dataset split (seed=42), Word2Vec (seed=42), GloVe (seed=42), and logistic regression (random_state=42). Run: python -m veritas_clin.serve, then POST /api/train {"model":"all"}, then GET /api/evaluate. The test split is isolated from training and never touched during model fitting.',
  },
  {
    q: 'What are the limitations?',
    a: '1. Reddit is not a clinical population. 2. r/happy vs r/depression is a coarse proxy for clinical depression; real screening uses validated instruments. 3. The model has no access to context (prior posts, demographics, severity). 4. Mean-vector representation discards word order entirely. 5. A post that says "I am not feeling hopeless" would likely be mis-classified as depressive because "hopeless" dominates the vector.',
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-[20px] font-semibold text-zinc-900">About</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          PICT NLP coursework · research demonstration · not a clinical tool.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold text-zinc-900 border-b border-zinc-100 pb-2">Project summary</h2>
        <dl className="space-y-1.5 text-[13px]">
          {[
            ['Problem',    'Detect depressive language in patient-written text'],
            ['Dataset',    '7,731 Reddit posts · binary labels · public'],
            ['Split',      '70 / 15 / 15 % train / val / test (stratified, seeded)'],
            ['Models',     'TF-IDF baseline · Word2Vec skip-gram · GloVe'],
            ['Classifier', 'Logistic regression — identical for all three'],
            ['Metric',     'F1 on the depressive class (positive class)'],
            ['Stack',      'Python · NumPy · scikit-learn · FastAPI · React'],
          ].map(([k, v]) => (
            <div key={k} className="grid grid-cols-[7rem_1fr] gap-2">
              <dt className="text-zinc-400 shrink-0">{k}</dt>
              <dd className="text-zinc-800">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-4">
        <h2 className="text-[13px] font-semibold text-zinc-900 border-b border-zinc-100 pb-2">Viva Q&amp;A</h2>
        <ol className="space-y-5 list-decimal list-inside marker:text-zinc-300 marker:text-[12px]">
          {QA.map((item, i) => (
            <li key={i} className="space-y-1.5">
              <span className="text-[13px] font-medium text-zinc-900">{item.q}</span>
              <p className="text-[13px] text-zinc-600 leading-relaxed pl-4 border-l-2 border-zinc-100">
                {item.a}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
