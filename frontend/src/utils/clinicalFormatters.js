import {
  Activity, BookOpen, FileText, FlaskConical,
  HeartPulse, Pill, ScanLine, Stethoscope, Users
} from 'lucide-react';

/**
 * Standard clinical document metadata extractor for icons, badges, and colors.
 */
export function docTypeMeta(filename = '') {
  const n = filename.toLowerCase();
  if (n.includes('discharge')) {
    return { label: 'Discharge Summary', icon: BookOpen, color: 'bg-orange-50 text-orange-800 border-orange-200' };
  }
  if (n.includes('catheterization') || n.includes('operative') || n.includes('procedure') || n.includes('surgery')) {
    return { label: 'Operative / Cath', icon: HeartPulse, color: 'bg-rose-50 text-rose-800 border-rose-200' };
  }
  if (n.includes('radiology') || n.includes('ct') || n.includes('mri') || n.includes('ultrasound') || n.includes('angiogram')) {
    return { label: 'Diagnostic Imaging', icon: ScanLine, color: 'bg-cyan-50 text-cyan-800 border-cyan-200' };
  }
  if (n.includes('lab') || n.includes('microbiology') || n.includes('pathology')) {
    return { label: 'Lab / Pathology', icon: FlaskConical, color: 'bg-purple-50 text-purple-800 border-purple-200' };
  }
  if (n.includes('consult')) {
    return { label: 'Specialty Consult', icon: Stethoscope, color: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
  }
  if (n.includes('emergency') || n.includes('admission') || n.includes('h&p')) {
    return { label: 'Emergency H&P', icon: Activity, color: 'bg-red-50 text-red-800 border-red-200' };
  }
  if (n.includes('progress') || n.includes('soap')) {
    return { label: 'Progress Note', icon: FileText, color: 'bg-blue-50 text-blue-800 border-blue-200' };
  }
  if (n.includes('prescription') || n.includes('rx') || n.includes('order')) {
    return { label: 'Prescription Order', icon: Pill, color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  }
  if (n.includes('clinic') || n.includes('visit')) {
    return { label: 'Outpatient Visit', icon: Users, color: 'bg-teal-50 text-teal-800 border-teal-200' };
  }
  return { label: 'Clinical Record', icon: FileText, color: 'bg-slate-50 text-slate-800 border-slate-200' };
}

/**
 * Robust date formatter for clinical encounters.
 */
export function fmtDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

/**
 * Format timestamp with time for vital/lab telemetry.
 */
export function fmtDateTime(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return d;
  }
}

/**
 * Statically compiled Tailwind classes for safety alerts so JIT never strips them.
 */
export function getAlertBadgeStyles(level = '') {
  const norm = String(level).toUpperCase();
  switch (norm) {
    case 'CRITICAL':
      return {
        card: 'border-rose-300 bg-rose-50/80 text-rose-950',
        badge: 'bg-rose-100 text-rose-800 border-rose-300',
        dot: 'bg-rose-500',
      };
    case 'HIGH_ALERT':
    case 'WARNING':
      return {
        card: 'border-amber-300 bg-amber-50/80 text-amber-950',
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
        dot: 'bg-amber-500',
      };
    case 'GUIDELINE_CONCORDANT':
      return {
        card: 'border-emerald-300 bg-emerald-50/80 text-emerald-950',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        dot: 'bg-emerald-500',
      };
    default:
      return {
        card: 'border-teal-300 bg-teal-50/80 text-teal-950',
        badge: 'bg-teal-100 text-teal-800 border-teal-300',
        dot: 'bg-teal-500',
      };
  }
}

