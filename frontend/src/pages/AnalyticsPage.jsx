import React from 'react';
import { 
  Activity, 
  Cpu, 
  CheckCircle2, 
  Sliders, 
  TrendingUp, 
  FileText,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="flex-1 p-6 lg:p-8 flex flex-col gap-6 max-w-7xl w-full mx-auto">
      
      {/* Page Title */}
      <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono font-semibold uppercase tracking-wider text-sky-700 mb-1">
            Empirical GPU Evaluation &bull; Tesla T4
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Telemetry & Model Calibration Studio
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Real benchmark measurements on held-out test split (40 notes, seed 7, zero-shot Qwen2.5-3B + DeBERTa-v3).
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>GPU Runtime: 582.2s Execution</span>
        </div>
      </div>

      {/* 4 Scoreboard Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <span className="text-[11px] font-mono uppercase text-slate-400 font-bold block">
            Accepted Chart Precision
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900">92.9%</span>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">+7.7%</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">vs 85.2% un-calibrated baseline</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <span className="text-[11px] font-mono uppercase text-slate-400 font-bold block">
            Hallucination Guard Rate
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-700">56.2%</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Planted false-positive traps suppressed</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <span className="text-[11px] font-mono uppercase text-slate-400 font-bold block">
            Automated Chart Coverage
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-sky-700">90.7%</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Claims signed off without doctor interruption</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <span className="text-[11px] font-mono uppercase text-slate-400 font-bold block">
            Expected Calibration Error (ECE)
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-indigo-700">0.1353</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Dev ECE: 0.1500 &bull; Test ECE: 0.1353</p>
        </div>
      </div>

      {/* GPU Plots Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* Plot 1 */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-600" />
                <span>Reliability Diagram (Expected Calibration Error)</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                Dev ECE: 0.1500
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Compares predicted model confidence against observed empirical accuracy across probability bins. Proves that model confidence is grounded rather than overconfident.
            </p>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center">
              <img 
                src="/artifacts/plots/calibration.png" 
                alt="Calibration Reliability Plot" 
                className="max-h-72 object-contain rounded"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://placehold.co/400x300/f8fafc/0284c7?text=Calibration+Plot';
                }}
              />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            Formula: ECE = &Sigma; (|B_b| / N) &bull; |acc(b) - conf(b)|
          </div>
        </div>

        {/* Plot 2 */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Selective Risk vs. Chart Coverage Curve</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                Test Split (N=108 Claims)
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Demonstrates the selective prediction trade-off: as the system expands automated coverage, the selective error rate remains tightly controlled below 8% at the dev-chosen cutoff &tau;* = 0.35.
            </p>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center">
              <img 
                src="/artifacts/plots/risk_coverage.png" 
                alt="Risk-Coverage Trade-off Curve" 
                className="max-h-72 object-contain rounded"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://placehold.co/400x300/f8fafc/0284c7?text=Risk+Coverage+Plot';
                }}
              />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            Optimal Point: Coverage 90.7% &bull; Selective Risk 7.1%
          </div>
        </div>

      </div>

      {/* Detailed Extraction Performance Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-4">
          Detailed Finding Extraction Performance (Held-Out Test Split)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[11px] text-slate-500 font-bold uppercase">
                <th className="py-2.5 px-4">Entity Type</th>
                <th className="py-2.5 px-4">Precision</th>
                <th className="py-2.5 px-4">Recall</th>
                <th className="py-2.5 px-4">F1 Score</th>
                <th className="py-2.5 px-4">True Pos (TP)</th>
                <th className="py-2.5 px-4">False Pos (FP)</th>
                <th className="py-2.5 px-4">Clinical Error Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
              <tr>
                <td className="py-3 px-4 font-bold text-slate-900">Diagnosis</td>
                <td className="py-3 px-4 text-emerald-700 font-bold">77.2%</td>
                <td className="py-3 px-4">100.0%</td>
                <td className="py-3 px-4 font-bold">87.1%</td>
                <td className="py-3 px-4">44</td>
                <td className="py-3 px-4 text-red-600 font-bold">13</td>
                <td className="py-3 px-4 text-slate-500 font-sans text-xs">The 13 FPs are the planted rule-out & family history traps.</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-900">Medication</td>
                <td className="py-3 px-4 text-emerald-700 font-bold">90.6%</td>
                <td className="py-3 px-4">100.0%</td>
                <td className="py-3 px-4 font-bold">95.1%</td>
                <td className="py-3 px-4">29</td>
                <td className="py-3 px-4 text-red-600 font-bold">3</td>
                <td className="py-3 px-4 text-slate-500 font-sans text-xs">Captures drug name, strength, route, and daily dosing.</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-900">Follow-up</td>
                <td className="py-3 px-4 text-emerald-700 font-bold">100.0%</td>
                <td className="py-3 px-4">95.0%</td>
                <td className="py-3 px-4 font-bold">97.4%</td>
                <td className="py-3 px-4">19</td>
                <td className="py-3 px-4 text-slate-400">0</td>
                <td className="py-3 px-4 text-slate-500 font-sans text-xs">Continuity of care outpatient specialist appointments.</td>
              </tr>
              <tr className="bg-slate-50/70 font-bold text-slate-900">
                <td className="py-3 px-4">Aggregate Benchmark</td>
                <td className="py-3 px-4 text-emerald-700">85.2%</td>
                <td className="py-3 px-4">98.9%</td>
                <td className="py-3 px-4 text-sky-700">91.5%</td>
                <td className="py-3 px-4">92</td>
                <td className="py-3 px-4 text-red-600">16</td>
                <td className="py-3 px-4 text-emerald-700 font-sans text-xs">Post-audit accepted precision: 92.9% (+7.7% boost).</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
