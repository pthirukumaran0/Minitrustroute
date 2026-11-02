import React from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  rows?: number;
}

export function LoadingState({ message = 'Loading live data...', rows = 4 }: LoadingStateProps) {
  return (
    <div className="w-full p-8 flex flex-col items-center justify-center space-y-4 text-center">
      <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin dark:border-blue-950 dark:border-t-blue-400" />
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400 animate-pulse">{message}</p>
      <div className="w-full max-w-xl space-y-2.5 pt-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-full bg-slate-100 dark:bg-slate-800/60 rounded-md animate-pulse"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// Export LoadingSpinner as alias for LoadingState
export const LoadingSpinner = LoadingState;

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
  actionHref?: string;
}

export function EmptyState({ icon, title, description, message, actionText, onAction, actionHref }: EmptyStateProps) {
  const displayDesc = description || message || '';
  return (
    <div className="w-full p-12 text-center flex flex-col items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/40">
      {icon && <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-xs text-slate-400 mb-3">{icon}</div>}
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      {displayDesc && <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-5">{displayDesc}</p>}
      {actionText && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
        >
          {actionText}
        </Link>
      )}
      {actionText && !actionHref && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Error Loading Information', message, onRetry }: ErrorStateProps) {
  return (
    <div className="w-full p-6 border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h4 className="text-sm font-semibold text-rose-800 dark:text-rose-300">{title}</h4>
        <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-white dark:bg-rose-900/40 border border-rose-300 dark:border-rose-800 rounded-lg hover:bg-rose-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}
