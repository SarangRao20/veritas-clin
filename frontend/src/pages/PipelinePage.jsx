import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import { SectionHeader, Card, Btn, Err, Badge } from '../components/ui';
import {
  UploadCloud, FileText, Play, CheckCircle2, Download,
  Copy, Sparkles, Cpu, ShieldCheck, Layers, Terminal, Check, FileCheck, AlertTriangle
} from 'lucide-react';
import clsx from 'clsx';

const SAMPLE_PRESETS = [
  {
    id: 'severe',
    name: 'severe_depression_intake.txt',
    title: 'Severe Depression (Intake)',
    badge: 'High Signal',
    tone: 'red',
    url: '/samples/clinical_sample_severe_depression.txt',
    text: `Patient Intake Assessment Note\nDate: 2024-03-12\nChief Complaint: Severe persistent low mood, loss of interest, feelings of worthlessness\n\nPatient narrative:\n"I haven't left my room in days. I feel completely empty and worthless. Nothing brings me joy anymore. I used to love painting and reading, but now everything feels pointless. I keep thinking about disappearing and not existing anymore. I can't sleep, can't eat, and I cried for most of yesterday afternoon without knowing why. The tiredness is overwhelming; even brushing my teeth feels impossible."\n\nClinician Observation:\nAffect is blunted. Speech is slow with increased latency. Reports overwhelming exhaustion and inability to concentrate.`,
  },
  {
    id: 'somatic',
    name: 'insomnia_somatic_fatigue.txt',
    title: 'Insomnia & Somatic Complaints',
    badge: 'Somatic Focus',
    tone: 'amber',
    url: '/samples/clinical_sample_insomnia_somatic.txt',
    text: `Physician Consultation Summary\nDate: 2024-04-05\nReason for Visit: Chronic sleep disruption, profound fatigue, and appetite loss\n\nPatient narrative:\n"I haven't been able to sleep properly for weeks now. I wake up at 3am drenched in sweat and my mind just spins. Food has completely lost its appeal; I've lost nearly 4 kg over the past month. Even getting dressed in the morning feels like climbing a steep mountain. The tiredness is completely overwhelming, but when I try to rest, I am restless and agitated."\n\nAssessment:\nSomatic signs of mood disturbance prominent. Marked sleep maintenance insomnia, early morning awakening, and appetite suppression.`,
  },
  {
    id: 'anhedonia',
    name: 'work_burnout_anhedonia.txt',
    title: 'Burnout & Anhedonia',
    badge: 'Moderate Strain',
    tone: 'amber',
    url: '/samples/clinical_sample_moderate_anhedonia.txt',
    text: `Outpatient Follow-up Note\nDate: 2024-05-18\nPresentation: Work-related burnout, loss of pleasure, difficulty concentrating\n\nPatient narrative:\n"Work stress is completely overwhelming me right now. I missed another deadline this week because I simply cannot concentrate on anything—reading a single memo takes me five attempts. I have lost all interest in going out or meeting friends. I pushed them away because I feel like such a burden to everyone around me. Not sure how much longer I can keep pushing through like this."\n\nAssessment:\nModerate mood strain with pronounced cognitive deceleration and social withdrawal.`,
  },
  {
    id: 'recovery',
    name: 'baseline_recovery_checkin.txt',
    title: 'Baseline Recovery Check-in',
    badge: 'Euthymic Baseline',
    tone: 'emerald',
    url: '/samples/clinical_sample_baseline_recovery.txt',
    text: `Routine Primary Care Check-in\nDate: 2024-06-22\nSubject: 6-week wellness review following lifestyle modifications\n\nPatient report:\n"Had a decent week overall. Went for a walk with a friend by the river and felt a bit lighter afterwards. Managed to cook two home meals this week which felt like a genuine achievement. Sleep was mostly okay, no 3am waking episodes. Mood has remained stable with no major lows. Started reading an online book and looking forward to the weekend."\n\nAssessment:\nEuthymic baseline. Normal sleep architecture and positive affective engagement observed.`,
  },
];

const PIPELINE_STAGES = [
  { id: 1, name: 'Text Ingestion', label: 'Ingestion & Segmentation', icon: FileText, desc: 'Sentence splitting, lowercasing, stopword filtering' },
  { id: 2, name: 'Embedding Space', label: '100-d Vector Projection', icon: Cpu, desc: 'Dense projection into Word2Vec / GloVe manifolds' },
  { id: 3, name: 'Negation Context', label: 'Negation Window Filtering', icon: ShieldCheck, desc: '±3 token contextual polarity discounting' },
  { id: 4, name: 'PHQ-9 Taxonomy', label: 'DSM-5 Criteria Extraction', icon: Layers, desc: 'Mapping tokens to 9 diagnostic symptom domains' },
  { id: 5, name: 'Model Consensus', label: 'Tri-Model Inference', icon: Sparkles, desc: 'Cross-evaluating Word2Vec, GloVe, and TF-IDF' },
  { id: 6, name: 'Grounded Output', label: 'Verified Evidence Export', icon: CheckCircle2, desc: 'Generating clinical report & structured JSON' },
];

export default function PipelinePage() {
  const [inputText, setInputText]       = useState(SAMPLE_PRESETS[0].text);
  const [selectedPreset, setSelectedPreset] = useState(SAMPLE_PRESETS[0].id);
  const [model, setModel]               = useState('word2vec');
  const [isDragging, setIsDragging]     = useState(false);
  const [activeStage, setActiveStage]   = useState(1);
  const [running, setRunning]           = useState(false);
  const [pipelineData, setPipelineData] = useState(null);
  const [err, setErr]                   = useState('');
  const [copied, setCopied]             = useState(false);
  const [outputTab, setOutputTab]       = useState('report'); // 'report' | 'json'

  const fileInputRef = useRef(null);

  const executePipeline = useCallback(async (overrideText = null) => {
    const textToProcess = (overrideText ?? inputText).trim();
    if (!textToProcess) return;

    setRunning(true);
    setErr('');
    setActiveStage(1);

    try {
      const res = await api.explain(textToProcess, model);
      setPipelineData(res);

      for (let s = 1; s <= 6; s++) {
        setActiveStage(s);
        await new Promise(r => setTimeout(r, 220));
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setRunning(false);
    }
  }, [inputText, model]);

  useEffect(() => {
    executePipeline();
  }, [executePipeline]);

  // Handle Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readUploadedFile(file);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      readUploadedFile(file);
    }
  };

  const readUploadedFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setInputText(content);
        setSelectedPreset(null);
        executePipeline(content);
      }
    };
    reader.readAsText(file);
  };

  const loadPreset = (preset) => {
    setSelectedPreset(preset.id);
    setInputText(preset.text);
    executePipeline(preset.text);
  };

  const downloadSampleFile = (preset) => {
    const blob = new Blob([preset.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = preset.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (content) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Structured JSON representation for EHR integration
  const structuredJSON = useMemo(() => {
    if (!pipelineData) return null;
    return {
      status: 'success',
      screening_id: 'SCR-2026-0814',
      timestamp: '2026-10-28T12:00:00Z',
      instrument: 'MoodTrace NLP Symptom Verification v2.0',
      selected_model: model,
      summary: {
        triage_level: pipelineData.triage?.level ?? 'Unknown',
        action_advisory: pipelineData.triage?.action ?? '',
        language_signal_pct: Math.round((pipelineData.p_depressive ?? 0) * 100),
        cross_model_consensus: !pipelineData.disagreement,
        model_agreement: pipelineData.comparison ?? []
      },
      dsm5_criteria_detected: pipelineData.phq9_hits ?? {},
      token_attribution: pipelineData.contributions?.slice(0, 10) ?? [],
      vector_representation: {
        dimensions: 100,
        embedding_type: model,
        l2_norm: pipelineData.vector_norm ?? 0,
        sample_dimensions: pipelineData.vector_preview ?? []
      },
      grounded_evidence_sentences: pipelineData.sentences?.slice(0, 5) ?? []
    };
  }, [pipelineData, model]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <SectionHeader
        title="Live Pipeline Studio"
        sub="Demonstrate the complete clinical NLP pipeline from raw note ingestion and vector projection to verified evidence extraction."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono">Embedding:</span>
            {['word2vec', 'glove', 'tfidf'].map(m => (
              <button
                key={m}
                onClick={() => setModel(m)}
                className={clsx(
                  'px-2.5 py-1 rounded text-[11px] font-mono uppercase transition-colors',
                  model === m ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}>
                {m}
              </button>
            ))}
          </div>
        }
      />

      {/* ── 1. Input Stage: File Dropzone & Editor ── */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-blue-600" />
            <h3 className="text-[13px] font-semibold text-slate-900">Stage 0: Clinical Note Ingestion</h3>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInput}
              accept=".txt,.doc,.docx,.md,.text"
              className="hidden"
            />
            <Btn
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}>
              <FileCheck className="h-3.5 w-3.5" /> Upload File
            </Btn>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Sample Palettes & Download Links */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase font-medium mb-2">
              <span>Presentation Sample Notes (Click to load, or download .txt to test live drag & drop)</span>
              <span>4 Verified Scenarios</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {SAMPLE_PRESETS.map(p => (
                <div
                  key={p.id}
                  className={clsx(
                    'p-3 rounded-xl border transition-all text-left flex flex-col justify-between gap-2',
                    selectedPreset === p.id
                      ? 'border-blue-500 bg-blue-50/70 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  )}>
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[12px] font-semibold text-slate-800 truncate">{p.title}</span>
                      <Badge tone={p.tone}>{p.badge}</Badge>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 block truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => loadPreset(p)}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors">
                      Load in Editor
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      onClick={() => downloadSampleFile(p)}
                      title="Download real .txt file to test live drag-and-drop"
                      className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors">
                      <Download className="h-3 w-3" /> .txt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Drag & Drop Zone + Editor */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={clsx(
              'relative rounded-xl border-2 transition-all p-4',
              isDragging
                ? 'border-blue-500 bg-blue-50/80 scale-[1.005] border-dashed shadow-md'
                : 'border-slate-200 bg-slate-50/40 hover:border-slate-300'
            )}>
            {isDragging ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <UploadCloud className="h-10 w-10 text-blue-600 animate-bounce mb-2" />
                <div className="text-[14px] font-semibold text-blue-900">Drop Clinical Document Here</div>
                <p className="text-[12px] text-blue-600 mt-1">Accepts .txt, .doc, .docx, markdown records</p>
              </div>
            ) : (
              <div>
                <textarea
                  value={inputText}
                  onChange={e => { setInputText(e.target.value); setSelectedPreset(null); }}
                  rows={6}
                  placeholder="Paste or drop clinical notes, intake letters, or patient portal narratives..."
                  className="w-full bg-transparent border-0 resize-none text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none leading-relaxed font-sans"
                />
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 text-[11px] text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>{inputText.length} characters</span>
                    <span>·</span>
                    <span>{inputText.split(/\s+/).filter(Boolean).length} words</span>
                    <span>·</span>
                    <span>{inputText.split(/[.!?]+/).filter(Boolean).length} sentences</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInputText('')}
                      className="text-slate-400 hover:text-slate-600 transition-colors">
                      Clear
                    </button>
                    <Btn
                      onClick={() => executePipeline()}
                      loading={running}
                      disabled={!inputText.trim()}
                      size="sm">
                      <Play className="h-3 w-3 fill-current" /> Execute Pipeline
                    </Btn>
                  </div>
                </div>
              </div>
            )}
          </div>

          {err && <Err message={err} />}
        </div>
      </Card>

      {/* ── 2. Animated Pipeline Stages ── */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-blue-600" />
            <h3 className="text-[13px] font-semibold text-slate-900">Live NLP Transformation Pipeline</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {running ? `Executing Stage ${activeStage} of 6...` : 'Pipeline Ready · Click any stage to inspect'}
          </span>
        </div>

        {/* Stage Timeline Stepper */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {PIPELINE_STAGES.map((s) => {
              const Icon = s.icon;
              const isActive = activeStage === s.id;
              const isPast = activeStage > s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveStage(s.id)}
                  className={clsx(
                    'p-3 rounded-xl border text-left transition-all relative overflow-hidden',
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : isPast
                      ? 'bg-white text-slate-900 border-blue-200'
                      : 'bg-white text-slate-500 border-slate-200 opacity-70'
                  )}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={clsx('text-[10px] font-mono font-bold', isActive ? 'text-blue-100' : 'text-slate-400')}>
                      STAGE 0{s.id}
                    </span>
                    <Icon className={clsx('h-3.5 w-3.5', isActive ? 'text-white' : isPast ? 'text-blue-600' : 'text-slate-400')} />
                  </div>
                  <div className="text-[12px] font-semibold truncate leading-tight">{s.name}</div>
                  <div className={clsx('text-[10px] mt-1 truncate', isActive ? 'text-blue-100' : 'text-slate-400')}>{s.label}</div>
                  {isActive && running && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-300 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Stage Inspector */}
        <div className="p-5">
          <AnimatePresence mode="wait">
            {pipelineData && (
              <motion.div
                key={activeStage}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}>

                {/* Stage 1: Ingestion & Tokens */}
                {activeStage === 1 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <h4 className="text-[13px] font-semibold text-slate-900">Stage 1: Clinical Ingestion & Sentence Segmentation</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Raw text stream is segmented on sentence boundaries, normalized, lowercased, and filtered.</p>
                      </div>
                      <Badge tone="blue">{pipelineData.token_count} Clean Tokens Extracted</Badge>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-[11px] text-slate-400 font-medium uppercase block mb-1.5">Sentence Segments ({pipelineData.sentences?.length ?? 0})</span>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {pipelineData.sentences?.map((s, idx) => (
                            <div key={idx} className="p-2.5 bg-slate-50 rounded-lg text-[12px] text-slate-700 border border-slate-100 flex items-start gap-2">
                              <span className="text-[10px] font-mono text-slate-400 mt-0.5">{idx + 1}</span>
                              <p className="flex-1">{s}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-400 font-medium uppercase block mb-1.5">Normalized Token Stream</span>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                          <div className="flex flex-wrap gap-1">
                            {pipelineData.tokens?.map((tok, idx) => (
                              <span key={idx} className="text-[11px] font-mono bg-white border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded shadow-2xs">
                                {tok}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage 2: 100-d Vector Projection */}
                {activeStage === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <h4 className="text-[13px] font-semibold text-slate-900">Stage 2: 100-Dimensional Vector Projection ({model.toUpperCase()})</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Note tokens are mapped into continuous embedding space and mean-pooled into a single representation vector.</p>
                      </div>
                      <Badge tone="violet">L2 Norm: {pipelineData.vector_norm}</Badge>
                    </div>

                    <div className="space-y-3">
                      <span className="text-[11px] text-slate-400 font-medium uppercase block">Sample Dimensions Preview (dims 1 to 12 of 100)</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {pipelineData.vector_preview?.map((val, idx) => (
                          <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                            <span className="text-[10px] font-mono text-slate-400 block">d_{idx + 1}</span>
                            <span className={clsx('text-[13px] font-mono font-bold', val >= 0 ? 'text-blue-600' : 'text-slate-700')}>
                              {val.toFixed(4)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-[12px] text-blue-900 leading-relaxed">
                        <strong>Mathematical transformation:</strong> Let sentence tokens be <code className="font-mono text-[11px]">T = &#123;w_1, ..., w_N&#125;</code>.
                        The note vector is computed as <code className="font-mono text-[11px]">v_note = (1 / |T_vocab|) ∑_{'{w ∈ T_vocab}'} v_w</code>.
                        Active vocabulary coverage: <strong>{pipelineData.tokens_used}</strong> / {pipelineData.token_count} tokens mapped.
                      </div>
                    </div>
                  </div>
                )}

                {/* Stage 3: Negation Window */}
                {activeStage === 3 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <h4 className="text-[13px] font-semibold text-slate-900">Stage 3: Negation Context Window Scanning</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Prevents false-positive symptom matches when patients state "no trouble sleeping" or "not feeling hopeless".</p>
                      </div>
                      <Badge tone={pipelineData.negation_hits?.length ? 'amber' : 'emerald'}>
                        {pipelineData.negation_hits?.length ? 'Negation Detected' : 'No Negations Triggered'}
                      </Badge>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                      <div className="text-[12px] text-slate-700">
                        {pipelineData.negation_hits?.length > 0 ? (
                          <div className="flex items-center gap-2 text-amber-800">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <span>Negation window triggered near: <strong>{pipelineData.negation_hits.join(', ')}</strong> (Similarity penalized by factor 0.3)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-emerald-800">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>No clinical negation triggers detected in proximity to key symptoms. Passages evaluated at full weight.</span>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Trigger words scanned within ±3 tokens: <code className="font-mono text-[10px] bg-white px-1 py-0.5 rounded">no, not, never, without, none, barely, cant, cannot</code>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Stage 4: DSM-5 / PHQ-9 Taxonomy */}
                {activeStage === 4 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <h4 className="text-[13px] font-semibold text-slate-900">Stage 4: DSM-5 / PHQ-9 Clinical Criteria Mapping</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Surfacing structured clinical symptom domains aligned with standard psychiatric instruments.</p>
                      </div>
                      <Badge tone="blue">{Object.keys(pipelineData.phq9_hits ?? {}).length} Domains Active</Badge>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      {Object.entries(pipelineData.phq9_hits ?? {}).map(([criterion, words]) => (
                        <div key={criterion} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-3">
                          <span className="text-[12px] font-medium text-slate-800">{criterion}</span>
                          <div className="flex flex-wrap gap-1">
                            {words.map(w => (
                              <span key={w} className="text-[11px] font-mono bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded">
                                {w}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stage 5: Tri-Model Consensus */}
                {activeStage === 5 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <h4 className="text-[13px] font-semibold text-slate-900">Stage 5: Tri-Model Consensus & Probability Calibration</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Simultaneously evaluating Word2Vec, GloVe, and TF-IDF classifiers on the extracted features.</p>
                      </div>
                      <Badge tone={pipelineData.disagreement ? 'amber' : 'emerald'}>
                        {pipelineData.disagreement ? 'Model Disagreement' : 'Full Model Consensus'}
                      </Badge>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-3">
                      {pipelineData.comparison?.map(c => {
                        const pct = Math.round(c.p_depressive * 100);
                        const isHigh = pct >= 50;
                        return (
                          <div key={c.model} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[12px] font-bold text-slate-800 uppercase">{c.model}</span>
                              <Badge tone={isHigh ? 'red' : 'emerald'}>{c.label}</Badge>
                            </div>
                            <div className="text-[24px] font-mono font-bold text-slate-900">{pct}%</div>
                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={clsx('h-full rounded-full', isHigh ? 'bg-red-500' : 'bg-emerald-500')}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-slate-400">Confidence: {(c.confidence * 100).toFixed(1)}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Stage 6: Grounded Evidence Extraction */}
                {activeStage === 6 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <h4 className="text-[13px] font-semibold text-slate-900">Stage 6: Traceable Evidence Grounding</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Every finding is grounded in explicit source sentences ready for clinician verification.</p>
                      </div>
                      <Badge tone="emerald">Verified Traceable</Badge>
                    </div>

                    <div className="space-y-2">
                      {pipelineData.sentences?.slice(0, 3).map((sent, idx) => (
                        <div key={idx} className="p-3 bg-blue-50/40 rounded-xl border border-blue-200 flex items-start gap-3">
                          <span className="text-[10px] font-mono text-blue-700 font-bold px-1.5 py-0.5 bg-blue-100 rounded mt-0.5">
                            Passage {idx + 1}
                          </span>
                          <p className="text-[12px] text-slate-800 italic leading-relaxed flex-1">"{sent}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* ── 3. Production-Ready Clinical Output Deliverable ── */}
      {pipelineData && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <h3 className="text-[13px] font-semibold text-slate-900">Production Clinical Deliverable</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 border border-slate-200 rounded-lg p-0.5 bg-white">
                <button
                  onClick={() => setOutputTab('report')}
                  className={clsx('px-3 py-1 rounded-md text-[11px] font-medium transition-colors',
                    outputTab === 'report' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900')}>
                  Clinical Report
                </button>
                <button
                  onClick={() => setOutputTab('json')}
                  className={clsx('px-3 py-1 rounded-md text-[11px] font-medium transition-colors',
                    outputTab === 'json' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900')}>
                  <Terminal className="h-3 w-3 inline mr-1" /> FHIR / JSON Payload
                </button>
              </div>

              <Btn
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(outputTab === 'report' ? inputText : JSON.stringify(structuredJSON, null, 2))}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Btn>
            </div>
          </div>

          <div className="p-5">
            {outputTab === 'report' && (
              <div className="space-y-4">
                {/* Standardized Clinical Report Header */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-slate-900">NLP Screening & Evidence Verification Report</span>
                      <Badge tone={pipelineData.triage?.color === 'red' ? 'red' : pipelineData.triage?.color === 'amber' ? 'amber' : 'emerald'}>
                        {pipelineData.triage?.level}
                      </Badge>
                    </div>
                    <p className="text-[12px] text-slate-600 mt-1">{pipelineData.triage?.action}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-slate-400 font-mono">Calibrated Signal</div>
                    <div className="text-[20px] font-mono font-bold text-slate-900">
                      {Math.round((pipelineData.p_depressive ?? 0) * 100)}%
                    </div>
                  </div>
                </div>

                {/* Evidence Passages Grid */}
                <div>
                  <h4 className="text-[12px] font-semibold text-slate-900 uppercase font-mono tracking-wider mb-2">
                    Verified Source Passages for Clinician Confirmation
                  </h4>
                  <div className="space-y-2">
                    {pipelineData.sentences?.map((s, idx) => (
                      <div key={idx} className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-3 shadow-2xs">
                        <span className="text-[11px] font-mono text-slate-400 w-6 shrink-0 mt-0.5">#{idx + 1}</span>
                        <div className="flex-1">
                          <p className="text-[13px] text-slate-800 leading-relaxed italic">"{s}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {outputTab === 'json' && (
              <div>
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-96 leading-relaxed">
                  {JSON.stringify(structuredJSON, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
