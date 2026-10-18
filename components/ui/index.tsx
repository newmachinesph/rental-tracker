'use client';

import { clsx } from 'clsx';
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';

// ─── Button ──────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

const btnVariants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm active:shadow-none',
  secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300',
  outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-danger text-white hover:bg-danger-dark shadow-sm',
};

const btnSizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-2.5 text-base gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon, className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        btnVariants[variant],
        btnSizes[size],
        className,
      )}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

// ─── Input ───────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-text-secondary">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">{icon}</div>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full rounded-lg border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary',
            'border-border-default hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none',
            'transition-all duration-150',
            icon && 'pl-10',
            error && 'border-danger focus:border-danger focus:ring-danger/10',
            className,
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  ),
);
Input.displayName = 'Input';

// ─── Select ──────────────────────────────────────────────────
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, placeholder, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-text-secondary">{label}</label>}
      <select
        ref={ref}
        className={clsx(
          'w-full rounded-lg border bg-white px-3 py-2 text-sm text-text-primary',
          'border-border-default hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none',
          'transition-all duration-150 cursor-pointer appearance-none',
          'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E")] bg-no-repeat bg-[right_12px_center] pr-9',
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  ),
);
Select.displayName = 'Select';

// ─── Card ────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const cardPadding = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' };

export function Card({ children, className, padding = 'md', hover }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-surface rounded-xl border border-border-default shadow-sm',
        cardPadding[padding],
        hover && 'card-hover cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────
type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700',
  primary: 'bg-primary-light text-primary-dark',
  success: 'bg-success-light text-success-dark',
  warning: 'bg-warning-light text-warning-dark',
  danger: 'bg-danger-light text-danger-dark',
  info: 'bg-info-light text-info-dark',
};

const dotVariants: Record<BadgeVariant, string> = {
  default: 'bg-slate-400',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

export function Badge({ children, variant = 'default', dot, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        badgeVariants[variant],
        className,
      )}
    >
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', dotVariants[variant])} />}
      {children}
    </span>
  );
}

// ─── Stat Card ───────────────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: string; positive: boolean };
  color?: 'blue' | 'green' | 'red' | 'amber' | 'cyan' | 'purple';
}

const statColors = {
  blue: { icon: 'bg-blue-50 text-blue-600', value: 'text-blue-700', border: 'border-l-blue-500' },
  green: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-700', border: 'border-l-emerald-500' },
  red: { icon: 'bg-red-50 text-red-600', value: 'text-red-700', border: 'border-l-red-500' },
  amber: { icon: 'bg-amber-50 text-amber-600', value: 'text-amber-700', border: 'border-l-amber-500' },
  cyan: { icon: 'bg-cyan-50 text-cyan-600', value: 'text-cyan-700', border: 'border-l-cyan-500' },
  purple: { icon: 'bg-purple-50 text-purple-600', value: 'text-purple-700', border: 'border-l-purple-500' },
};

export function StatCard({ title, value, subtitle, icon, trend, color = 'blue' }: StatCardProps) {
  const c = statColors[color];
  return (
    <div className={clsx('bg-surface rounded-xl border border-border-default shadow-sm p-5 border-l-4', c.border)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">{title}</p>
          <p className={clsx('text-2xl font-bold mt-1.5 tracking-tight', c.value)}>{value}</p>
          {subtitle && <p className="text-xs text-text-tertiary mt-1">{subtitle}</p>}
          {trend && (
            <div className={clsx('flex items-center gap-1 mt-2 text-xs font-medium', trend.positive ? 'text-emerald-600' : 'text-red-600')}>
              <span>{trend.positive ? '↑' : '↓'}</span>
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={clsx('flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center', c.icon)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page Shell ──────────────────────────────────────────────
interface PageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({ title, description, actions, children }: PageShellProps) {
  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">{title}</h1>
          {description && <p className="text-sm text-text-secondary mt-1">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-text-tertiary mb-4">{icon}</div>}
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {description && <p className="text-xs text-text-tertiary mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────
interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {description && <p className="text-xs text-text-tertiary mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Divider ─────────────────────────────────────────────────
export function Divider({ className }: { className?: string }) {
  return <div className={clsx('h-px bg-border-default', className)} />;
}

// ─── Checkbox ────────────────────────────────────────────────
interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, ...props }, ref) => (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        ref={ref}
        type="checkbox"
        className={clsx(
          'h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer',
          className,
        )}
        {...props}
      />
      {label && <span className="text-sm text-text-secondary">{label}</span>}
    </label>
  ),
);
Checkbox.displayName = 'Checkbox';
