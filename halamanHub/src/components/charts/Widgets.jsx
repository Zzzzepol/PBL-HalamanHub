// ============================================================
// HalamanHub — Specialized SVG Widgets (Tailwind CSS)
// ============================================================
import React from 'react';

/* ── Water Tank Level Indicator ── */
export const WaterTank = ({ percent, label, sublabel, width = 70, height = 110 }) => {
  const fillHeight = (percent / 100) * 80;
  const fillY = 92 - fillHeight;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg className="flex-shrink-0" viewBox="0 0 70 110" width={width} height={height} role="img" aria-label={`Water tank ${percent}% full`}>
        <defs>
          <clipPath id={`tankClip-${percent}`}>
            <rect x="10" y="12" width="50" height="80" rx="6" />
          </clipPath>
        </defs>
        <rect x="10" y="12" width="50" height="80" rx="6" fill="var(--bg-secondary)" stroke="var(--border-medium)" strokeWidth="0.8" />
        <rect clipPath={`url(#tankClip-${percent})`} x="10" y={fillY} width="50" height={fillHeight + 10} fill="#4cc97a" opacity="0.35" />
        <rect clipPath={`url(#tankClip-${percent})`} x="10" y={fillY} width="50" height="3" fill="#27a85a" opacity="0.6" />
        <text x="35" y="55" textAnchor="middle" fontSize="13" fontWeight="500" fill="var(--text-primary)">{percent}%</text>
        {sublabel && <text x="35" y="68" textAnchor="middle" fontSize="9" fill="var(--text-secondary)">{sublabel}</text>}
        <rect x="20" y="8" width="30" height="6" rx="2" fill="var(--bg-secondary)" stroke="var(--border-medium)" strokeWidth="0.8" />
        <rect x="28" y="92" width="14" height="6" rx="2" fill="var(--bg-secondary)" stroke="var(--border-medium)" strokeWidth="0.8" />
      </svg>
      {label && <span className="text-xs text-text-secondary text-center">{label}</span>}
    </div>
  );
};

/* ── NPK Nutrient Ring ── */
const ringColors = { N: '#27a85a', P: '#1a5fb4', K: '#c4960f' };

export const NPKRing = ({ symbol, value, max = 100, name, unit, size = 52 }) => {
  const radius = 21;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / max, 1);
  const dash = circumference * pct;
  const gap = circumference - dash;
  const color = ringColors[symbol] || '#27a85a';

  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <svg viewBox="0 0 52 52" width={size} height={size} role="img" aria-label={`${name}: ${value} ${unit}`}>
        <circle cx="26" cy="26" r={radius} fill="none" stroke="var(--border-default)" strokeWidth="5" />
        <circle
          cx="26" cy="26" r={radius} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
        />
        <text x="26" y="30" textAnchor="middle" fontSize="12" fontWeight="500" fill="var(--text-primary)">{value}</text>
      </svg>
      <div className="text-base font-semibold mt-0.5" style={{ color }}>{symbol}</div>
      <div className="text-xs text-text-secondary">{name}</div>
      <div className="text-xs text-text-tertiary">{unit}</div>
    </div>
  );
};

/* ── Sensor reading row with progress bar ── */
const dotColors = {
  ok: 'bg-[#27a85a]',
  warning: 'bg-[#f0b429]',
  offline: 'bg-[#e03535]',
  error: 'bg-[#e03535]',
};

export const SensorReadingRow = ({ name, value, percent, status = 'ok', time }) => {
  const barColor = status === 'ok' ? '#27a85a' : status === 'warning' ? '#f0b429' : '#e03535';
  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b-[0.5px] border-border last:border-b-0">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColors[status] || dotColors.ok}`} aria-hidden="true" />
      <span className="text-base text-text-primary flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{name}</span>
      <div className="hidden sm:block flex-[0_1_80px] h-[5px] bg-bg-tertiary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-400 ease-out" style={{ width: `${percent}%`, background: barColor }} />
      </div>
      <span className="text-base font-medium text-text-primary min-w-[64px] text-right flex-shrink-0">{value}</span>
      {time && <span className="text-xs text-text-secondary min-w-[58px] text-right flex-shrink-0 hidden min-[381px]:inline">{time}</span>}
    </div>
  );
};
