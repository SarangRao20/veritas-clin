import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Key, Check, ShieldCheck, X, Cpu, Cloud, ExternalLink } from 'lucide-react';
import { useToast } from './toast';

export const LS_LLM_PROVIDER = 'veritas_llm_provider';
export const LS_LLM_API_KEY  = 'veritas_llm_api_key';

export function getLLMConfig() {
  const provider = localStorage.getItem(LS_LLM_PROVIDER) || 'builtin';
  const apiKey = localStorage.getItem(LS_LLM_API_KEY) || '';
  return { provider, apiKey };
}

export default function SettingsModal({ open, onClose }) {
  const toast = useToast();
  const [provider, setProvider] = useState('builtin');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (open) {
      const cfg = getLLMConfig();
      setProvider(cfg.provider);
      setApiKey(cfg.apiKey);
    }
  }, [open]);

  const handleSave = () => {
    localStorage.setItem(LS_LLM_PROVIDER, provider);
    localStorage.setItem(LS_LLM_API_KEY, apiKey.trim());
    toast.success('RAG Synthesizer updated', `Active provider: ${provider.toUpperCase()}`);
    onClose();
  };

  const PROVIDERS = [
    {
      id: 'builtin',
      name: 'Built-in Clinical Synthesizer',
      badge: 'Zero GPU / Offline',
      desc: 'Deterministic medical synthesis engine. Ultra-fast, zero-hallucination, no API key required.',
      icon: Cpu,
    },
    {
      id: 'groq',
      name: 'Groq Cloud (Llama-3.3-70B)',
      badge: 'Sub-second Cloud',
      desc: 'Blazing fast inference via Groq cloud API. Requires a free Groq API key.',
      icon: Cloud,
      link: 'https://console.groq.com/keys',
    },
    {
      id: 'openai',
      name: 'OpenAI (GPT-4o-mini)',
      badge: 'Cloud API',
      desc: 'High-capability reasoning via OpenAI API. Requires an OpenAI API key.',
      icon: Sparkles,
      link: 'https://platform.openai.com/api-keys',
    },
    {
      id: 'gemini',
      name: 'Google Gemini (1.5 Flash)',
      badge: 'Cloud API',
      desc: 'Long-context clinical reasoning via Google AI Studio API key.',
      icon: Cloud,
      link: 'https://aistudio.google.com/app/apikey',
    },
  ];

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-white">Generative RAG Engine</h3>
                <p className="text-[11px] text-slate-400">Select generative synthesis model (No Local GPU needed)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Provider Selection */}
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-slate-300 uppercase tracking-wider block">
                Synthesis Provider
              </label>

              <div className="grid gap-2">
                {PROVIDERS.map((p) => {
                  const Icon = p.icon;
                  const selected = provider === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        selected
                          ? 'bg-blue-600/15 border-blue-500/60 ring-1 ring-blue-500/40 text-white'
                          : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-2 rounded-lg ${selected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[13px] text-white">{p.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                              {p.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{p.desc}</p>
                        </div>
                      </div>
                      {selected && <Check className="h-4 w-4 text-blue-400 shrink-0 mt-1" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* API Key Input (if not builtin) */}
            {provider !== 'builtin' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2 pt-2 border-t border-slate-800"
              >
                <div className="flex items-center justify-between text-[12px]">
                  <label className="font-medium text-slate-300 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-blue-400" />
                    {provider.toUpperCase()} API Key
                  </label>
                  {PROVIDERS.find(p => p.id === provider)?.link && (
                    <a
                      href={PROVIDERS.find(p => p.id === provider).link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                    >
                      Get Key <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Paste ${provider} API key here...`}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-[13px] text-slate-100 placeholder-slate-600 focus:outline-hidden font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-2.5 text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Stored securely in your local browser storage. Sent only directly to the model API.
                </p>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Evidence citation grounding enforced</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-[12px] font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-1.5 text-[12px] font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
