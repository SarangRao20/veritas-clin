import { useEffect, useState } from 'react';
import { getHealth, getMetrics } from '../api';
import { Chip, ErrorNote, PageHeader, Panel, fmt } from '../components/ui';

export default function SettingsPage() {
  const [metrics, setMetrics] = useState(null);
  const [metricsError, setMetricsError] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    getMetrics().then(setMetrics).catch(setMetricsError);
    getHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  const row = 'flex items-center justify-between gap-4 py-2.5 text-[13px] border-t border-zinc-100 first:border-t-0';
  const k = 'text-zinc-600';
  const v = 'text-zinc-900 font-mono text-[12px] text-right';

  return (
    <div>
      <PageHeader
        eyebrow="Configuration"
        title="Safety policy & runtime"
        sub="The decision policy is fixed at service startup from artifacts/policy.json so that a viva demo cannot silently widen what gets written to charts. Editing the artifact requires a restart — by design."
      />

      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <Panel title="Abstention policy" sub="Loaded from artifacts/policy.json at startup">
          <dl className="px-4 py-3">
            <div className={row}>
              <dt className={k}>Decision threshold τ*</dt>
              <dd className={v}>{metrics ? fmt.round(metrics.calibration.threshold, 4) : '—'}</dd>
            </div>
            <div className={row}>
              <dt className={k}>Hysteresis factor (low_frac)</dt>
              <dd className={v}>{metrics ? fmt.round(metrics.calibration.low_frac, 2) : '—'}</dd>
            </div>
            <div className={row}>
              <dt className={k}>Review band</dt>
              <dd className={v}>
                {metrics ? `[${fmt.round(metrics.calibration.threshold * metrics.calibration.low_frac, 4)}, ${fmt.round(metrics.calibration.threshold, 4)})` : '—'}
              </dd>
            </div>
            <div className={row}>
              <dt className={k}>Score formula</dt>
              <dd className="text-[12px] text-right">
                <span className="font-mono">0.8·p(entail) + 0.2·token_conf</span>
              </dd>
            </div>
            <div className="px-0 pt-3 text-[12px] text-zinc-500 leading-relaxed order-none">
              Accept when score ≥ τ*; hold for physician review inside the band; abstain below it.
            </div>
          </dl>
        </Panel>

        <div className="space-y-5">
          <Panel title="Live service probe" sub="Polled from GET /health — reflects this host, not the GPU benchmark">
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[13px] text-zinc-600">Status</span>
                {health ? (
                  <Chip tone="emerald" dot>{health.status === 'ok' ? 'OK' : health.status}</Chip>
                ) : (
                  <Chip tone="red" dot>Unreachable</Chip>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[13px] text-zinc-600">Extractor runtime</span>
                <span className="font-mono text-[12px]">{health?.extractor ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[13px] text-zinc-600">NLI cross-encoder</span>
                <Chip tone={health?.extractor === 'hf' ? 'emerald' : 'zinc'} dot>
                  {health?.extractor === 'hf' ? 'Loaded' : 'Not loaded'}
                </Chip>
              </div>
              {metricsError && <ErrorNote error={metricsError} />}
            </div>
          </Panel>

          <Panel title="Benchmark models" sub="What produced the numbers in artifacts/metrics.json (test split, Tesla T4)">
            <dl className="px-4 py-3">
              <div className={row}>
                <dt className={k}>Extractor</dt>
                <dd className="text-[12px] text-right text-zinc-900">Qwen2.5-3B-Instruct, zero-shot</dd>
              </div>
              <div className={row}>
                <dt className={k}>Verifier</dt>
                <dd className="text-[12px] text-right text-zinc-900">DeBERTa-v3-base-mnli-fever-anli (NLI)</dd>
              </div>
              <div className={row}>
                <dt className={k}>Corpus</dt>
                <dd className={v}>{metrics ? `${metrics.config.n_notes} notes · seed ${metrics.config.seed}` : '—'}</dd>
              </div>
              <div className={row}>
                <dt className={k}>Held-out claims</dt>
                <dd className={v}>{metrics ? metrics.config.n_claims_test : '—'}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
