import React from 'react';
import { RiskDecision } from '@/src/types/frontend';

interface StatusBadgeProps {
  status: RiskDecision | string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({ status, size = 'md', showDot = true, className = '' }: StatusBadgeProps) {
  const norm = (status || '').toUpperCase().trim();

  let bgClass = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotClass = 'bg-slate-400';
  let label = status;

  if (norm === 'APPROVED') {
    bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    dotClass = 'bg-emerald-500';
    label = 'APPROVED';
  } else if (norm === 'STEP_UP' || norm === 'STEP_UP_REQUIRED') {
    bgClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
    dotClass = 'bg-amber-500';
    label = 'STEP-UP REQUIRED';
  } else if (norm === 'BLOCKED') {
    bgClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
    dotClass = 'bg-rose-500';
    label = 'BLOCKED';
  } else if (norm === 'ROUTING_FAILED') {
    bgClass = 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800';
    dotClass = 'bg-orange-500';
    label = 'NO ROUTE';
  } else if (norm === 'ACTIVE') {
    bgClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
    dotClass = 'bg-blue-500';
    label = 'ACTIVE';
  } else if (norm === 'INACTIVE' || norm === 'PROHIBITED') {
    bgClass = 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
    dotClass = 'bg-zinc-400';
    label = norm;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold tracking-wide rounded-full border ${sizeClasses[size]} ${bgClass} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${dotClass} animate-pulse`} />}
      {label}
    </span>
  );
}

