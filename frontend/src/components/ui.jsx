export function Card({ title, actions, children, className = '' }) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>
        {(title || actions) && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">{title}</h2>
            {actions}
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    );
  }
  
  const TONES = {
    WFO: 'bg-green-100 text-green-700',
    WFH: 'bg-blue-100 text-blue-700',
    Absent: 'bg-red-100 text-red-700',
    Leave: 'bg-amber-100 text-amber-700',
    Holiday: 'bg-purple-100 text-purple-700',
    unknown: 'bg-slate-100 text-slate-600',
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-red-100 text-red-700',
  };
  
  export function Badge({ children, tone }) {
    return (
      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${TONES[tone] || TONES.unknown}`}>
        {children}
      </span>
    );
  }
  
  export function Spinner({ label = 'Loading…' }) {
    return <div className="text-slate-500 text-sm py-4">{label}</div>;
  }

  export function Stat({ label, value, sub }) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    );
  }