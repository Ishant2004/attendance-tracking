import { useState } from 'react';

// Password field with a show/hide eye toggle.
export function PasswordInput({ value, onChange, className = '', ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        className={`w-full rounded-lg border border-slate-300 pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        {show ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a3 3 0 004.2 4.2" />
            <path d="M9.9 4.2A9.8 9.8 0 0112 4c6.5 0 10 7 10 7a13.4 13.4 0 01-3 3.7" />
            <path d="M6.1 6.1A13.3 13.3 0 002 11s3.5 7 10 7a9.7 9.7 0 004-.9" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

// Styled dropdown: native <select> (accessible, keyboard/mobile-friendly) with a
// custom chevron and consistent styling.
export function Select({ value, onChange, children, className = '', ...props }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className={`appearance-none w-full rounded-lg border border-slate-300 bg-white pl-3 pr-9 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

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