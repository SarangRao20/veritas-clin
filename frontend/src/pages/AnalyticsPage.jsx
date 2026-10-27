import { useEffect, useState } from 'react';
import { getMetrics } from '../api';
import { ErrorNote, PageHeader, Panel, Stat, fmt } from '../components/ui';

const TYPE_ROWS = ['diagnosis', 'medication', 'followup'];
const TYPE_LABEL = { diagnosis: 'Diagnosis', medication: 'Medication', followup: 'Follow-up' };
const DECISION_ORDER = ['accept', 'flag_for_review', 'abstain'];
const DECISION_LABEL = { accept: 'Auto-accepted', flag_for_review: 'Physician review', abstain: 'Held back' };

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    getMetrics().then(setMetrics).catch(setError);
  };
  useEffect(load, []);

  if (error && !metrics) {
    return (
      <div>
        <PageHeader eyebrow="Benchmark" title="Model evaluation" />
        <ErrorNote error={error} onRetry={load} />
      </div>
    );
  }
  if (!metrics) {
    return (
      <div>
        <PageHeader eyebrow="Benchmark" title="Model evaluation" />
        <p className="text-[13px] text-zinc-500">Loading metrics…</p>
      </div>
    );
  }

  const th = 'text-[11px] uppercase tracking-wide text-zinc-500 font-medium px-3 py-2 text-left';
  const td = 'px-3 py-2 text-[13px] border-t border-zinc-100';

  return (
    <div>
      <PageHeader
        eyebrow="Benchmark"
        title="Model evaluation"
        sub="Held-out test split from the Tesla T4 benchmark run. Every number below is read directly from artifacts/metrics.json."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Accepted precision" value={fmt.pct(metrics.policy.accepted_precision)} sub="of chart write-backs correct" />
        <Stat label="Coverage" value={fmt.pct(metrics.policy.coverage)} sub="claims cleared without interruption" />
        <Stat label="Hallucination capture" value={fmt.pct(metrics.policy.hallucination_capture)} sub="planted false positives suppressed" />
        <Stat label="ECE (test)" value={fmt.round(metrics.calibration.ece_test, 4)} sub={`dev ${fmt.round(metrics.calibration.ece_dev, 4)}`} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 items-start">
        <Panel title="Extraction performance" sub={`${metrics.config.n_claims_test} held-out claims · ${metrics.config.n_notes} notes · seed ${metrics.config.seed}`}>
          <div className="overflow-x-auto px-1 pb-1">
            <table className="w-full table-fixed">
              <thead>
                <tr className="bg-zinc-50">
                  <th className={th}>Entity type</th>
                  <th className={th}>Precision</th>
                  <th className={th}>Recall</th>
                  <th className={th}>F1</th>
                  <th className={th}>TP</th>
                  <th className={th}>FP</th>
                  <th className={th}>FN</th>
                </tr>
              </thead>
              <tbody>
                {TYPE_ROWS.map((t) => {
                  const r = metrics.extraction[t];
                  return (
                    <tr key={t}>
                      <td className={`${td} text-zinc-900`}>{TYPE_LABEL[t]}</td>
                      <td className={`${td} font-mono text-[12px]`}>{fmt.pct(r.precision, 1)}</td>
                      <td className={`${td} font-mono text-[12px]`}>{fmt.pct(r.recall, 1)}</td>
                      <td className={`${td} font-mono text-[12px] font-semibold`}>{fmt.pct(r.f1, 1)}</td>
                      <td className={`${td} font-mono text-[12px] text-zinc-500`}>{r.tp}</td>
                      <td className={`${td} font-mono text-[12px] text-zinc-500`}>{r.fp}</td>
                      <td className={`${td} font-mono text-[12px] text-zinc-500`}>{r.fn}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Abstention policy"
          sub={`Learned on the dev split (never test). Unsupported-claim rate without calibration: ${fmt.pct(metrics.unsupported_claim_rate)}`}
        >
          <dl className="px-4 py-3 divide-y divide-zinc-100 text-[13px]">
            <div className="flex justify-between py-2">
              <dt className="text-zinc-600">Decision threshold τ*</dt>
              <dd className="font-mono text-[12px]">{fmt.round(metrics.calibration.threshold, 4)}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-zinc-600">Hysteresis band (low_frac)</dt>
              <dd className="font-mono text-[12px]">{fmt.round(metrics.calibration.low_frac, 2)} × τ* = {fmt.round(metrics.calibration.threshold * metrics.calibration.low_frac, 4)}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-zinc-600">Test-set decisions</dt>
              <dd className="text-[12px] text-zinc-700 space-x-2">
                {DECISION_ORDER.map((d) => (
                  <span key={d}>
                    {DECISION_LABEL[d]} <span className="font-mono">{metrics.policy.decision_counts[d] ?? 0}</span>
                  </span>
                ))}
              </dd>
            </div>
          </dl>
          <div className="px-4 pb-4 -mt-1 text-[12px] text-zinc-500 leading-relaxed">
            A claim is auto-accepted when score ≥ τ*; between τ* and the hysteresis band it is held
            for physician review; below the band it is abstained entirely.
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 items-start">
        <Panel
          title="Reliability diagram"
          sub="Predicted confidence vs. observed accuracy on the dev split"
        >
          <div className="p-4">
            <img
              src="/artifacts/plots/calibration.png"
              alt="Calibration reliability diagram (dev split)"
              className="w-full border border-zinc-100 rounded"
            />
          </div>
        </Panel>
        <Panel
          title="Risk–coverage curve"
          sub={`Selective risk as coverage grows, test split (optimal point: coverage ${fmt.pct(metrics.policy.coverage)}`}
        >
          <div className="p-4">
            <img
              src="/artifacts/plots/risk_coverage.png"
              alt="Risk-coverage curve (test split)"
              className="w-full border border-zinc-100 rounded"
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
