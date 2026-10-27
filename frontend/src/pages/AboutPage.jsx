const QA = [
  {
    q: 'What does this project do?',
    a: 'It classifies synthetic clinical notes into four domain categories (cardiac, respiratory, endocrine, renal) using three text representations: TF-IDF, Word2Vec, and GloVe. The goal is to compare how much distributional semantics from the two embedding methods improve on the bag-of-words baseline.',
  },
  {
    q: 'Why synthetic notes?',
    a: 'Synthetic notes let us define ground-truth labels precisely at generation time, use no real patient data (no PHI risk), and make the experiment fully reproducible from a single seed. The trade-off is that vocabulary and style are artificial; results do not generalize to real clinical corpora.',
  },
  {
    q: 'How does Word2Vec work here?',
    a: 'We train a skip-gram model with negative sampling on the training-split tokens. For each training step, the model adjusts weights to predict surrounding context words from a target word. A note is represented as the mean of its in-vocabulary word vectors. Dimension: 100, window: 5, negative samples: 5, epochs: 10.',
  },
  {
    q: 'How does GloVe differ from Word2Vec?',
    a: 'GloVe builds a global word co-occurrence matrix first, then fits a weighted least-squares regression so that the dot product of two word vectors approximates the log of their co-occurrence count. Word2Vec is a local, prediction-based model; GloVe is a global, count-based model. In practice on small corpora they perform similarly.',
  },
  {
    q: 'What classifier is used?',
    a: 'Logistic regression with L2 regularisation (scikit-learn defaults). It is deliberately simple so that differences between TF-IDF, Word2Vec, and GloVe results reflect the representation quality, not the classifier. All three representations use the same classifier, split, and seed.',
  },
  {
    q: 'What do the evaluation numbers mean?',
    a: 'Accuracy is the fraction of test notes with the correct label. Precision, recall, and F1 are macro-averaged across the four domains (each domain weighted equally). The confusion matrix rows are true labels and columns are predicted labels.',
  },
  {
    q: 'Why are the numbers high?',
    a: 'The corpus is synthetic: each domain uses a fixed vocabulary of conditions and medications. A TF-IDF classifier can memorise domain-specific terms without needing semantics. Embedding models may score slightly lower if rare words have noisy vectors on this small corpus.',
  },
  {
    q: 'How do I reproduce the results?',
    a: `From the project root:\n  1. pip install -e .\n  2. python -m clinnlp train --seed 42\n  3. python -m clinnlp evaluate\n  4. uvicorn clinnlp.serve:app\nThe same seed produces the same corpus, split, and metrics.`,
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-[20px] font-semibold text-zinc-900">About</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          PICT NLP coursework · academic demonstration · not for clinical use.
        </p>
      </div>

      {/* What / Why / How */}
      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold text-zinc-900 border-b border-zinc-100 pb-2">Project</h2>
        <dl className="space-y-1 text-[13px]">
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <dt className="text-zinc-500">Task</dt>
            <dd className="text-zinc-800">Domain classification of clinical notes</dd>
          </div>
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <dt className="text-zinc-500">Corpus</dt>
            <dd className="text-zinc-800">400 synthetic notes, 4 domains, seed 42</dd>
          </div>
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <dt className="text-zinc-500">Split</dt>
            <dd className="text-zinc-800">70 / 10 / 20 % — train / val / test (stratified)</dd>
          </div>
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <dt className="text-zinc-500">Models</dt>
            <dd className="text-zinc-800">TF-IDF baseline · Word2Vec skip-gram · GloVe</dd>
          </div>
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <dt className="text-zinc-500">Classifier</dt>
            <dd className="text-zinc-800">Logistic regression (same for all three)</dd>
          </div>
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <dt className="text-zinc-500">Stack</dt>
            <dd className="text-zinc-800">Python · NumPy · scikit-learn · FastAPI · React</dd>
          </div>
        </dl>
      </section>

      {/* Viva Q&A */}
      <section className="space-y-3">
        <h2 className="text-[13px] font-semibold text-zinc-900 border-b border-zinc-100 pb-2">Viva Q&A</h2>
        <ol className="space-y-5 list-decimal list-inside marker:text-zinc-400 marker:text-[12px]">
          {QA.map((item, i) => (
            <li key={i} className="space-y-1">
              <span className="text-[13px] font-medium text-zinc-900">{item.q}</span>
              <p className="text-[13px] text-zinc-600 leading-relaxed whitespace-pre-line pl-4 border-l border-zinc-200">
                {item.a}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
