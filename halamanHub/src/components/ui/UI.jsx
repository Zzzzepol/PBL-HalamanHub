
// HalamanHub — shared UI Components
import React from 'react';

/* ── Badge ── */
const badgeVariants = {
  ok:      'bg-green-50 text-green-800',
  warning: 'bg-amber-50 text-amber-800',
  error:   'bg-red-50 text-red-800',
  blue:    'bg-blue-50 text-blue-700',
  purple:  'bg-purple-100 text-purple-800',
  default: 'bg-bg-tertiary text-text-secondary',
};

export const Badge = ({ children, variant = 'default', className = '' }) => (
  <span className={`inline-flex min-h-6 items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${badgeVariants[variant] || badgeVariants.default} ${className}`}>
    {children}
  </span>
);

const statusStyles = {
  good: { label: 'Good', icon: 'ti-circle-check', tone: 'bg-green-50 text-green-800' },
  check: { label: 'Check soon', icon: 'ti-alert-triangle', tone: 'bg-amber-50 text-amber-900' },
  action: { label: 'Needs action', icon: 'ti-alert-circle', tone: 'bg-red-50 text-red-800' },
  none: { label: 'No data', icon: 'ti-minus', tone: 'bg-gray-100 text-gray-700' },
};

export const StatusBadge = ({ status = 'none', label, className = '' }) => {
  const config = statusStyles[status] || statusStyles.none;
  return <Badge variant="default" className={`${config.tone} ${className}`}><i className={`ti ${config.icon}`} aria-hidden="true" />{label || config.label}</Badge>;
};

/* ── Button ── */
const btnVariants = {
  default: 'bg-bg-primary border-border-medium text-text-primary hover:bg-bg-secondary',
  primary: 'bg-green-800 border-green-800 text-white hover:bg-green-600 hover:border-green-600',
  danger:  'bg-red-600 border-red-600 text-white hover:bg-red-400 hover:border-red-400',
  ghost:   'bg-transparent border-transparent text-text-secondary hover:bg-bg-secondary hover:text-text-primary',
};
const btnSizes = {
  sm: 'min-h-11 px-3 py-2 text-sm',
  md: 'min-h-11 px-4 py-2 text-base',
  lg: 'min-h-12 px-6 py-3 text-lg',
};

export const Button = ({ children, variant = 'default', size = 'md', onClick, disabled, type = 'button', className = '', icon, ...rest }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium cursor-pointer whitespace-nowrap leading-tight border transition-colors duration-150 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 ${btnVariants[variant]} ${btnSizes[size]} ${className}`}
    {...rest}
  >
    {icon && <i className={`ti ${icon} text-[15px]`} aria-hidden="true" />}
    {children}
  </button>
);

/* ── Card ── */
export const Card = ({ children, className = '' }) => (
  <div className={`bg-bg-primary border border-border rounded-xl overflow-hidden ${className}`}>
    {children}
  </div>
);

export const CardHeader = ({ title, subtitle, actions }) => (
  <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
    <div>
      <div className="text-md font-medium text-text-primary">{title}</div>
      {subtitle && <div className="text-sm text-text-secondary mt-0.5">{subtitle}</div>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
  </div>
);

export const CardBody = ({ children, className = '' }) => (
  <div className={`p-4 ${className}`}>{children}</div>
);

export const BigStat = ({ icon = 'ti-leaf', label, value = '—', unit = '', status = 'none', className = '' }) => (
  <Card className={className}>
    <CardBody className="min-h-[124px]">
      <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
        <i className={`ti ${icon} text-base text-green-800`} aria-hidden="true" />{label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-xl font-semibold leading-tight text-text-primary">{value}</span>
        {unit && value !== '—' && <span className="text-sm text-text-secondary">{unit}</span>}
      </div>
      <StatusBadge status={status} className="mt-2" />
    </CardBody>
  </Card>
);

export const ConfirmDialog = ({ open, title, message, confirmLabel = 'Continue', cancelLabel = 'Go back', onConfirm, onCancel, variant = 'danger' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={e => e.target === e.currentTarget && onCancel?.()}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="w-full max-w-md rounded-2xl border border-border bg-bg-primary p-5 shadow-lg">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-text-primary">{title}</h2>
        <p className="mt-2 text-base text-text-secondary">{message}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="default" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={variant} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </section>
    </div>
  );
};

export const ErrorState = ({ title = 'We could not load this yet', description = 'Check your connection and try again.', onRetry, retryLabel = 'Try again' }) => (
  <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center" role="alert">
    <i className="ti ti-alert-circle text-2xl text-red-700" aria-hidden="true" />
    <h3 className="mt-2 text-base font-semibold text-text-primary">{title}</h3>
    <p className="mt-1 text-sm text-text-secondary">{description}</p>
    {onRetry && <Button className="mt-4" onClick={onRetry} icon="ti-refresh">{retryLabel}</Button>}
  </div>
);

export const LoadingSkeleton = ({ className = '' }) => <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`} aria-label="Loading" role="status" />;

/* ── Stat card ── */
const iconVariants = {
  green: 'bg-green-50 text-green-800',
  amber: 'bg-amber-50 text-amber-800',
  blue:  'bg-blue-50 text-blue-700',
  red:   'bg-red-50 text-red-800',
  teal:  'bg-teal-50 text-teal-800',
};
const trendVariants = {
  up: 'text-[#1a7a3a]',
  dn: 'text-red-600',
  ok: 'text-text-secondary',
};

export const StatCard = ({ icon, iconVariant = 'green', value, label, trend, trendDir, onClick }) => (
  <div
    className={`bg-bg-secondary rounded-md p-4 transition-colors duration-150 ${onClick ? 'cursor-pointer hover:bg-bg-tertiary' : ''}`}
    onClick={onClick}
    onKeyDown={onClick ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); } } : undefined}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
  >
    <div className={`w-7 h-7 rounded-sm flex items-center justify-center mb-2.5 text-sm ${iconVariants[iconVariant] || iconVariants.green}`}>
      <i className={`ti ${icon}`} aria-hidden="true" />
    </div>
    <div className="text-[22px] font-medium leading-[1.1] text-text-primary">{value}</div>
    <div className="text-sm text-text-secondary mt-[3px]">{label}</div>
    {trend && (
      <div className={`text-xs mt-1.5 flex items-center gap-[3px] ${trendVariants[trendDir] || trendVariants.ok}`}>
        {trendDir === 'up' && <i className="ti ti-trending-up text-xs" aria-hidden="true" />}
        {trendDir === 'dn' && <i className="ti ti-trending-down text-xs" aria-hidden="true" />}
        {trendDir === 'ok' && <i className="ti ti-check text-xs" aria-hidden="true" />}
        {trend}
      </div>
    )}
  </div>
);

/* ── Toggle switch ── */
export const Toggle = ({ checked, onChange, label, id, disabled = false }) => (
  <label className="flex items-center gap-2.5 rounded-lg cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-green-700 focus-within:outline-offset-2" htmlFor={id}>
    <span className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-colors duration-200 ${checked ? 'bg-green-700' : 'bg-gray-400'} ${disabled ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        id={id}
        className="absolute opacity-0 w-full h-full m-0 cursor-pointer z-10"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
      />
      <span
        className={`absolute top-[3px] left-[3px] h-[22px] w-[22px] bg-white rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.2)] pointer-events-none transition-transform duration-200 ease-in-out ${checked ? 'translate-x-[20px]' : 'translate-x-0'}`}
      />
    </span>
    {label && <span className="text-base text-text-primary">{label}</span>}
  </label>
);

/* ── Status dot ── */
const dotVariants = {
  ok: 'bg-green-600',
  warning: 'bg-amber-400',
  offline: 'bg-gray-500',
  error: 'bg-red-400',
};

export const StatusDot = ({ status }) => (
  <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dotVariants[status] || dotVariants.ok}`} aria-label={status} />
);

/* ── Pulse dot (irrigation active) ── */
export const PulseDot = ({ active }) => (
  <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-green-600 animate-pulse-dot' : 'bg-gray-400'}`} />
);

/* ── Section label ── */
export const SectionLabel = ({ children }) => (
  <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2.5">{children}</div>
);

/* ── Table ── */
export const Table = ({ headers, children, className = '' }) => (
  <div className={`overflow-x-auto ${className}`}>
    <table className="w-full border-collapse text-base min-w-[480px]">
      <thead>
        <tr className="border-b border-border">
          {headers.map((h, i) => (
            <th key={i} className="text-xs font-medium text-text-secondary text-left px-3.5 py-[9px] whitespace-nowrap uppercase tracking-wide">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="[&>tr]:border-b [&>tr]:border-border [&>tr:last-child]:border-b-0 [&>tr:hover]:bg-bg-secondary [&>tr>td]:px-3.5 [&>tr>td]:py-[11px] [&>tr>td]:text-text-primary [&>tr>td]:align-middle">
        {children}
      </tbody>
    </table>
  </div>
);

/* ── Search bar ── */
export const SearchBar = ({ value, onChange, placeholder = 'Search…' }) => (
  <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-md px-3 py-[7px] w-full">
    <i className="ti ti-search text-text-secondary text-[15px] flex-shrink-0" aria-hidden="true" />
    <input
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-transparent border-none outline-none text-base text-text-primary w-full placeholder:text-text-tertiary"
      aria-label={placeholder}
    />
  </div>
);

/* ── Avatar ── */
export const Avatar = ({ initials, color = '#1a6b3a', size = 32 }) => (
  <div
    className="rounded-full flex items-center justify-center font-medium text-white flex-shrink-0 tracking-wide"
    style={{ background: color, width: size, height: size, fontSize: size * 0.36 }}
    aria-hidden="true"
  >
    {initials}
  </div>
);

/* ── Empty state ── */
export const EmptyState = ({ icon = 'ti-inbox', title, description, action }) => (
  <div className="flex flex-col items-center py-10 px-5 text-text-secondary gap-2">
    <i className={`ti ${icon} text-[32px] text-text-tertiary`} aria-hidden="true" />
    <div className="text-md font-medium text-text-primary">{title}</div>
    {description && <div className="text-sm text-center">{description}</div>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

/* ── Range input with label ── */
export const RangeInput = ({ label, min, max, value, onChange, unit = '' }) => (
  <div className="flex flex-col gap-1.5 mb-3.5">
    <div className="flex justify-between items-center">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary min-w-[36px] text-right">{value}{unit}</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-tertiary min-w-[28px]">{min}{unit}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 accent-green-600"
        aria-label={label}
      />
      <span className="text-xs text-text-tertiary min-w-[28px] text-right">{max}{unit}</span>
    </div>
  </div>
);

/* ── Form field ── */
export const FormField = ({ label, children, id }) => (
  <div className="flex flex-col gap-[5px]">
    {label && <label htmlFor={id} className="text-sm font-medium text-text-secondary">{label}</label>}
    {children}
  </div>
);

const fieldBase = 'min-h-11 px-3 py-2 border border-border-medium rounded-lg bg-bg-primary text-text-primary text-base outline-none w-full transition-colors duration-150 focus:border-green-700 focus:ring-2 focus:ring-green-100';

export const Input = ({ id, type = 'text', value, onChange, placeholder, className = '', ...rest }) => (
  <input
    id={id}
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    className={`${fieldBase} ${className}`}
    {...rest}
  />
);

export const Select = ({ id, value, onChange, children, className = '' }) => (
  <select id={id} value={value} onChange={onChange} className={`${fieldBase} ${className}`}>
    {children}
  </select>
);
