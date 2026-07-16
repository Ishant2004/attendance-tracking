// Human-readable labels and detail text for attendance flags.

const LABELS = {
  frequent_late: 'Frequent late arrivals',
  frequent_absence: 'Frequent absences',
  low_wfo_ratio: 'Low WFO ratio',
  irregular_hours: 'Irregular hours',
};

export function flagLabel(type) {
  return LABELS[type] || String(type || '').replace(/_/g, ' ');
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Turn a flag's `details` object into a readable sentence.
export function flagDetail(flag) {
  const d = flag?.details || {};
  const window = d.windowDays ? ` in the last ${d.windowDays} days` : '';

  switch (flag?.flagType) {
    case 'frequent_late':
      return d.lateCount != null ? `${plural(d.lateCount, 'late arrival')}${window}` : '';
    case 'frequent_absence':
      return d.absenceCount != null ? `${plural(d.absenceCount, 'absence')}${window}` : '';
    case 'low_wfo_ratio':
      if (d.ratio != null) {
        const pct = `${Math.round(d.ratio * 100)}% WFO`;
        const frac = d.wfo != null && d.worked != null ? ` (${d.wfo}/${d.worked} working days)` : '';
        return `${pct}${frac}${window}`;
      }
      return '';
    case 'irregular_hours':
      return d.irregularCount != null ? `${plural(d.irregularCount, 'day')} with irregular hours${window}` : '';
    default:
      // Fallback: readable key: value pairs (never raw JSON).
      return Object.entries(d)
        .filter(([k]) => k !== 'windowDays')
        .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${v}`)
        .join(', ');
  }
}
