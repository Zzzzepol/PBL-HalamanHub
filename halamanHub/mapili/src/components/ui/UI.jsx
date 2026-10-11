// ============================================================
// Mapili Shop — Shared UI Components
// ============================================================
import React from 'react';

export const Button = ({ children, variant = 'primary', size = 'md', icon, disabled, onClick, type = 'button', className = '', ...rest }) => {
  const base = 'inline-flex min-h-11 items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]';
  const variants = {
    primary: 'bg-brand-700 hover:bg-brand-800 text-white shadow-sm hover:shadow-md',
    outline: 'border-2 border-brand-700 text-brand-700 hover:bg-brand-50',
    ghost:   'text-gray-600 hover:bg-gray-100',
    danger:  'bg-red-600 hover:bg-red-700 text-white',
    earth:   'bg-earth-600 hover:bg-earth-700 text-white',
    white:   'bg-white hover:bg-gray-50 text-brand-800 shadow-sm',
  };
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-2.5 text-base',
    lg: 'min-h-12 px-8 py-3.5 text-base',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {icon && <i className={`ti ${icon} text-[16px]`} aria-hidden="true" />}
      {children}
    </button>
  );
};

export const Input = ({ id, type = 'text', value, onChange, placeholder, className = '', required, autoComplete, ...rest }) => (
  <input
    id={id}
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    required={required}
    autoComplete={autoComplete}
    className={`input-base ${className}`}
    {...rest}
  />
);

export const Select = ({ id, value, onChange, children, className = '' }) => (
  <select id={id} value={value} onChange={onChange} className={`input-base ${className}`}>
    {children}
  </select>
);

export const FormField = ({ label, id, error, children, required }) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-700 ml-0.5">*</span>}
      </label>
    )}
    {children}
    {error && <p className="text-xs text-red-600 flex items-center gap-1"><i className="ti ti-alert-circle" />{error}</p>}
  </div>
);

export const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default:  'bg-gray-100 text-gray-700',
    success:  'bg-green-100 text-green-800',
    warning:  'bg-amber-100 text-amber-800',
    error:    'bg-red-100 text-red-800',
    blue:     'bg-blue-100 text-blue-800',
    purple:   'bg-purple-100 text-purple-800',
    brand:    'bg-brand-100 text-brand-800',
  };
  return (
    <span className={`inline-flex min-h-6 items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  );
};

const statusStyles = {
  good: { label: 'Good', icon: 'ti-circle-check', tone: 'success' },
  check: { label: 'Check soon', icon: 'ti-alert-triangle', tone: 'warning' },
  action: { label: 'Needs action', icon: 'ti-alert-circle', tone: 'error' },
  none: { label: 'No data', icon: 'ti-minus', tone: 'default' },
};

export const StatusBadge = ({ status = 'none', label, className = '' }) => {
  const config = statusStyles[status] || statusStyles.none;
  return <Badge variant={config.tone} className={className}><i className={`ti ${config.icon}`} aria-hidden="true" />{label || config.label}</Badge>;
};

export const Card = ({ children, className = '', onClick }) => (
  <div
    className={`bg-white rounded-2xl shadow-soft border border-gray-200 overflow-hidden ${onClick ? 'cursor-pointer' : ''} ${className}`}
    onClick={onClick}
  >
    {children}
  </div>
);

export const BigStat = ({ icon = 'ti-leaf', label, value = '—', unit = '', status = 'none', className = '' }) => (
  <Card className={className}>
    <div className="min-h-[148px] p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-600"><i className={`ti ${icon} text-lg text-brand-800`} aria-hidden="true" />{label}</div>
      <div className="mt-3 flex items-baseline gap-1.5"><span className="text-2xl font-semibold leading-tight text-gray-900">{value}</span>{unit && value !== '—' && <span className="text-sm text-gray-600">{unit}</span>}</div>
      <StatusBadge status={status} className="mt-3" />
    </div>
  </Card>
);

export const ConfirmDialog = ({ open, title, message, confirmLabel = 'Continue', cancelLabel = 'Go back', onConfirm, onCancel, variant = 'danger' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={e => e.target === e.currentTarget && onCancel?.()}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-lift">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-base text-gray-600">{message}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={onCancel}>{cancelLabel}</Button><Button variant={variant} onClick={onConfirm}>{confirmLabel}</Button></div>
      </section>
    </div>
  );
};

export const ErrorState = ({ title = 'We could not load this yet', description = 'Check your connection and try again.', onRetry, retryLabel = 'Try again' }) => (
  <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center" role="alert"><i className="ti ti-alert-circle text-2xl text-red-700" aria-hidden="true" /><h3 className="mt-2 text-base font-semibold text-gray-900">{title}</h3><p className="mt-1 text-sm text-gray-700">{description}</p>{onRetry && <Button className="mt-4" onClick={onRetry} icon="ti-refresh">{retryLabel}</Button>}</div>
);

export const Spinner = ({ size = 'md' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <div className={`${sizes[size]} border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin`} aria-label="Loading" />
  );
};

export const EmptyState = ({ icon = 'ti-inbox', title, description, action }) => (
  <div className="flex flex-col items-center py-20 px-6 text-center">
    <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-4">
      <i className={`ti ${icon} text-3xl text-brand-600`} aria-hidden="true" />
    </div>
    <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
    {description && <p className="text-gray-500 text-sm mb-6 max-w-xs">{description}</p>}
    {action}
  </div>
);

export const Alert = ({ type = 'info', message, onClose, className = '' }) => {
  const styles = {
    info:    'bg-blue-50 text-blue-800 border-blue-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    error:   'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
  };
  const icons = { info: 'ti-info-circle', success: 'ti-circle-check', error: 'ti-alert-circle', warning: 'ti-alert-triangle' };
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${styles[type]} ${className}`} role="alert">
      <i className={`ti ${icons[type]} text-lg flex-shrink-0 mt-0.5`} aria-hidden="true" />
      <p className="text-sm flex-1 leading-relaxed">{message}</p>
      {onClose && (
          <button onClick={onClose} aria-label="Dismiss message" className="min-h-11 min-w-11 flex-shrink-0 opacity-70 hover:opacity-100">
          <i className="ti ti-x text-sm" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export const Skeleton = ({ className = '' }) => (
  <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />
);

export const LoadingSkeleton = Skeleton;

export const Divider = ({ label }) => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-gray-200" />
    {label && <span className="text-xs text-gray-600 font-medium">{label}</span>}
    <div className="flex-1 h-px bg-gray-200" />
  </div>
);

export const StepIndicator = ({ steps, current }) => (
  <div className="flex items-center" aria-label={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}>
    {steps.map((step, i) => (
      <React.Fragment key={i}>
        <div className="flex flex-col items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
            ${i < current ? 'bg-brand-600 text-white' : i === current ? 'bg-brand-700 text-white ring-4 ring-brand-100' : 'bg-gray-100 text-gray-600'}`}>
            {i < current ? <i className="ti ti-check text-sm" /> : i + 1}
          </div>
          <span className={`text-xs mt-1 font-medium ${i === current ? 'text-brand-700' : i < current ? 'text-brand-600' : 'text-gray-600'}`}>
            {step}
          </span>
        </div>
        {i < steps.length - 1 && (
          <div className={`flex-1 h-0.5 mx-2 mb-5 ${i < current ? 'bg-brand-600' : 'bg-gray-200'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

// Order status badge mapping
export const orderStatusBadge = {
  pending:    { variant: 'warning', label: 'Order received', icon: 'ti-clock' },
  confirmed:  { variant: 'blue',    label: 'Accepted', icon: 'ti-circle-check' },
  processing: { variant: 'purple',  label: 'Preparing', icon: 'ti-loader' },
  ready:      { variant: 'brand',   label: 'Ready',      icon: 'ti-package' },
  completed:  { variant: 'success', label: 'Completed',  icon: 'ti-check' },
  cancelled:  { variant: 'error',   label: 'Cancelled',  icon: 'ti-x' },
};
