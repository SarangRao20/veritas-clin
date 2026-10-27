# Veritas-Clin: Viva Defense & Examiner Guide

This guide is prepared for academic final-year project presentations, viva voce examinations, and committee evaluations.

---

## 1. The Core Elevator Pitch (30 Seconds)

> *"Traditional clinical NLP systems extract information and hand it straight to downstream EHR systems. But LLMs hallucinate subtly—extracting conditions that were only ruled out or misattributing family history—and they do so with high confidence. Veritas-Clin solves this by introducing a dual-stage architecture: zero-shot structured extraction coupled with an NLI self-verification layer that calculates Expected Calibration Error (ECE) and enforces calibrated selective abstention. Rather than forcing the model to guess, our system automatically routes high-risk claims to human review, boosting accepted precision from 85.2% to 92.9% while capturing 56.2% of all hallucinations at 90.7% chart coverage."*

---

## 2. Anticipated Viva Questions & Defensible Answers

### Q1: "Why not just fine-tune an LLM (e.g., Llama-3 or BioMistral)?"
**Answer:**
1. Fine-tuning improves domain vocabulary, but **does not solve overconfidence or hallucination**: fine-tuned models still hallucinate subtly on negations, family histories, and rule-outs, often with higher miscalibrated confidence.
2. Architecture comes before parameters: by decoupling the **generator** (extractor) from an independent **verifier** (cross-encoder NLI), we create an orthogonal verification signal that holds true regardless of the underlying LLM.
3. Fine-tuning is documented in our PRD as Phase 2; tonight's priority was establishing the empirical verification and calibration framework.

---

### Q2: "Why use Natural Language Inference (NLI) instead of prompting the LLM to verify itself ('Self-Reflection')?"
**Answer:**
1. **Correlated error modes:** If an LLM hallucinates during extraction because of an attention blind spot or token prior, prompting the same model in the same context to "re-check" frequently reproduces the hallucination (confirmation bias).
2. **Architecture specialization:** DeBERTa-v3 is a bidirectional cross-encoder trained specifically on premise-hypothesis entailment. It performs full cross-attention across the source sentence and the extracted finding hypothesis, providing an independent verification signal.

---

### Q3: "How is the decision threshold $\tau^*$ chosen, and how did you prevent data leakage?"
**Answer:**
- **Strict Data Split:** The 40-note corpus is split 50/50 into a Dev set (20 notes) and a Test set (20 notes) using a fixed deterministic seed (`seed=7`).
- **Optimization Criterion:** On the Dev set, we perform a grid search over decision thresholds to maximize the $F_1$ score of the accepted-correct decisions.
- **Leakage Prevention:** The chosen threshold ($\tau^* = 0.3499$) is locked into `artifacts/policy.json` and applied blindly to the Test split. All reported metrics (precision, coverage, hallucination capture rate, and test ECE) are measured on the Test split alone.

---

### Q4: "What is Expected Calibration Error (ECE) and why does it matter here?"
**Answer:**
- Standard accuracy/F1 measures how often the model is right, but ignores whether its stated confidence matches reality.
- We partition the prediction score $[0, 1]$ into $M=10$ equal bins. In each bin $b$, we compute the average confidence $\text{conf}(b)$ and the observed accuracy $\text{acc}(b)$.
- $\text{ECE} = \sum_{b=1}^{M} \frac{|B_b|}{N} |\text{acc}(b) - \text{conf}(b)|$.
- In clinical deployments, low ECE means a score of 0.8 actually corresponds to an 80% chance of being factually supported by the note, making confidence thresholds clinically trustworthy.

---

### Q5: "Why did you use synthetic notes rather than MIMIC-III / MIMIC-IV?"
**Answer:**
1. **Ground Truth by Construction:** In public EHR corpora, span annotations often have inter-annotator disagreement. With our generator, exact character offsets of true findings are recorded at render time.
2. **Planted Adversarial Traps:** We deliberately planted clinical distractors:
   - Rule-out statements (*"Community-acquired pneumonia - ruled out."*)
   - Family history mentions (*"Father has Type 2 Diabetes"*)
   - Allergy listings (*"Allergies: Penicillin (rash)"*)
   These test whether the pipeline respects clinical modality or merely matches string tokens.
3. **Privacy & Reproducibility:** No PHI credentials (CITI training, PhysioNet DUA) required for evaluation or reproduction.

---

## 3. High-Impact Equations & Formulations

### 1. Calibrated Decision Score
$$S(\text{claim}) = w_{\text{nli}} \cdot P_{\text{entail}} + w_{\text{tok}} \cdot \text{conf}_{\text{tok}}$$
*(where $w_{\text{nli}} = 0.8$, $w_{\text{tok}} = 0.2$, $\text{conf}_{\text{tok}} = \frac{1}{|T|} \sum_{t \in T} P(t)$ via softmax over generation logits)*

### 2. Three-Way Policy
$$\text{Decision}(S) = \begin{cases}
\text{accept} & \text{if } S \ge \tau^* \\
\text{flag\_for\_review} & \text{if } \tau_{\text{low}} \le S < \tau^* \quad (\tau_{\text{low}} = 0.8 \cdot \tau^*) \\
\text{abstain} & \text{if } S < \tau_{\text{low}}
\end{cases}$$

### 3. Hallucination Capture Rate
$$\text{Capture Rate} = \frac{|\{c \in \text{Incorrect} \mid \text{Decision}(c) \in \{\text{flag}, \text{abstain}\}\}|}{|\text{Incorrect}|}$$
*(Measured at **56.2%** on the held-out test split)*

---

## 4. Key Strengths to Emphasize in the Presentation
1. **Engineering Rigor:** 15 offline unit tests covering edge cases, greedy bipartite matching, and numerical stability.
2. **Production-Ready Interface:** FastAPI microservice with Pydantic v2 schemas and HTTP 503 lazy-loading guards.
3. **Honesty Over Hype:** Zero inflated or fabricated claims; Phase 2 clearly designated for fine-tuning.
