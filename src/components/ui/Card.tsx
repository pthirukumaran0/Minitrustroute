import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs transition-all ${
        onClick ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendPositive,
  color = 'blue',
  onClick,
}: StatCardProps) {
  const colorAccents = {
    blue: 'border-l-blue-600 dark:border-l-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30',
    emerald: 'border-l-emerald-600 dark:border-l-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30',
    amber: 'border-l-amber-500 dark:border-l-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/30',
    rose: 'border-l-rose-600 dark:border-l-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50/60 dark:bg-rose-950/30',
    slate: 'border-l-slate-600 dark:border-l-slate-400 text-slate-600 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-800/40',
  };

  return (
    <Card
      onClick={onClick}
      className={`border-l-4 ${colorAccents[color].split(' ')[0]} p-5 hover:translate-y-[-1px] transition-transform`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
            {title}
          </p>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
          {trend && (
            <span
              className={`text-xs font-medium inline-flex items-center gap-1 ${
                trendPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {trend}
            </span>
          )}
        </div>
        {icon && (
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorAccents[color]
              .split(' ')
              .slice(1)
              .join(' ')}`}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

