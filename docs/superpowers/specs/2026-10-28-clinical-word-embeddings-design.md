# Design Spec: Clinical NLP with Word2Vec and GloVe

**Status:** Draft for user review  
**Date:** 2026-10-28

## Purpose

Replace Veritas-Clin's current clinical extraction and NLI-verification project with a focused,
reproducible NLP coursework project. The project demonstrates how Word2Vec and GloVe learn
distributed representations from clinical text and compares their usefulness on a small,
well-defined text-classification task.

The intended audience is PICT NLP students and academic evaluators. This is a learning
demonstration, not a clinical product or a diagnostic system.

## Chosen task

Classify synthetic clinical notes into broad clinical domains (initially cardiac, respiratory,
endocrine, and renal). Each generated note has a known-by-construction domain label. A fixed seed
must produce the same corpus and split on every run. The corpus contains no real patient data and
requires no external download.

Compare three note representations with the same downstream classifier:

1. **TF-IDF baseline** — a conventional sparse text representation.
2. **Word2Vec** — train skip-gram with negative sampling on training-note tokens; represent a note
   by the mean of its in-vocabulary word vectors.
3. **GloVe** — build a windowed word co-occurrence matrix and train the weighted log-count
   regression objective; use the same mean-vector note representation.

Use a seeded, stratified train/validation/test split. Fit vocabulary, embeddings and classifier on
training data only; use validation for any settings selection; report final results once on the
held-out test split. Report accuracy, macro precision/recall/F1, and a confusion matrix. Show
nearest neighbors for selected in-vocabulary clinical terms as an exploration aid, not as proof of
clinical validity.

## User experience

Replace the current extraction-focused pages with a compact NLP workbench:

- **Overview:** project question, pipeline, dataset size/split, and current model comparison.
- **Embedding Lab:** choose Word2Vec or GloVe, train/load the reproducible model, inspect nearest
  neighbors and a note's vector representation.
- **Evaluation:** compare TF-IDF, Word2Vec, and GloVe test metrics and view the confusion matrix.
- **About / Viva:** explain preprocessing, distributional semantics, the two embedding objectives,
  limitations of a small synthetic corpus, and how to reproduce the experiment.

The existing React/Vite frontend may be reused as a shell, but old extraction, NLI, abstention,
and clinical-audit interactions must not remain as the product's main workflow or be presented as
active functionality.

## Architecture and data flow

```text
seeded synthetic note generator
        │
        ├── labeled notes ──► stratified train / validation / test split
        │                         │
        │                         ├── TF-IDF ──► classifier ──┐
        │                         ├── Word2Vec ─► mean vectors ├─► shared evaluation
        │                         └── GloVe ────► mean vectors ┘
        │
        └── training corpus ─► nearest-neighbor exploration
```

The Python backend owns corpus generation, preprocessing, model training/evaluation, and API
responses. The frontend consumes those APIs; it does not hard-code result numbers. Model training
must be explicit (CLI or API action), deterministic under a configured seed, and must not run
implicitly on importing the web server. Persist only the generated corpus and model artifacts
needed to avoid retraining; regeneration must remain possible from the seed.

## Implementation constraints

- Keep the workflow offline after dependency installation; do not download pretrained weights,
  spaCy models, or external datasets.
- Implement small educational Word2Vec and GloVe trainers with NumPy (already compatible with the
  current Python 3.14 environment), with stable numerical operations and deterministic seeds.
- Use the project's existing frontend stack where practical. Implement the educational embedding
  trainers in NumPy; use scikit-learn for stratified splitting, TF-IDF, logistic regression, and
  standard classification metrics rather than reimplementing those utilities.
- Remove the old transformer/NLI extraction path and stale project language from runtime routes,
  pages, README, and documentation when replacing the implementation; retain historical material
  only if clearly marked as archived and out of scope.
- Make no medical or clinical-performance claims. Label all data synthetic and all metrics as
  results on this generated benchmark.

## Failure handling

- Invalid model names, empty text, and out-of-vocabulary queries return clear validation errors or
  an empty neighbor list; they must not crash the server.
- Training failures surface as actionable errors and must not leave a partially written model
  artifact presented as valid.
- The app reports whether evaluation artifacts are available; it must not substitute hard-coded
  metrics when training has not completed.

## Acceptance criteria

1. A clean install can generate the corpus, train Word2Vec and GloVe, evaluate all three
   representations, and start the app without network/model downloads.
2. Same seed and configuration produce the same notes, split, and evaluation results within
   documented numerical tolerance.
3. Tests cover corpus label integrity, split isolation, preprocessing, deterministic training,
   vector lookup, and metric calculations.
4. Word2Vec and GloVe produce trained vectors from the generated clinical corpus; the app exposes
   their vocabulary/model metadata and nearest-neighbor results from those trained vectors.
5. The evaluation compares TF-IDF, Word2Vec, and GloVe using the same held-out notes and classifier.
6. No user-facing page or API describes the old extraction/NLI system as the current project.
7. The UI is usable on mobile and states clearly that the project is educational and not for
   clinical use.

## Explicitly out of scope

- Real patient data, MIMIC or other external corpora, PHI, or hospital integration.
- Clinical diagnosis, treatment recommendations, or decision support.
- LLMs, NLI verification, extraction abstention/calibration, CRF/HMM sequence labeling, and
  parsing demonstrations in this simplified project.
- Claiming meaningful clinical semantics or generalization from synthetic-corpus results.
- Distributed training, GPU requirements, authentication, and deployment infrastructure.
