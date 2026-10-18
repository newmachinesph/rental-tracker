'use client';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'cyan';
}

const colorMap = {
  blue: 'border-l-blue-500 bg-blue-50',
  green: 'border-l-green-500 bg-green-50',
  red: 'border-l-red-500 bg-red-50',
  amber: 'border-l-amber-500 bg-amber-50',
  cyan: 'border-l-cyan-500 bg-cyan-50',
};

const textMap = {
  blue: 'text-blue-700',
  green: 'text-green-700',
  red: 'text-red-700',
  amber: 'text-amber-700',
  cyan: 'text-cyan-700',
};

export default function KpiCard({ title, value, subtitle, color = 'blue' }: KpiCardProps) {
  return (
    <div className={`rounded-lg border-l-4 p-5 shadow-sm ${colorMap[color]}`}>
      <div className="text-sm font-medium text-slate-500">{title}</div>
      <div className={`text-2xl font-bold mt-1 ${textMap[color]}`}>{value}</div>
      {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
    </div>
  );
}
