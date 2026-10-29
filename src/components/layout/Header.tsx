'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, PlusCircle, Activity, Database, RefreshCw } from 'lucide-react';
import { SystemHealthData } from '@/src/types/frontend';

interface HeaderProps {
  onOpenSidebar: () => void;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const isHealthy = health?.status === 'healthy';

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-200">TrustRoute</span>
          <span>/</span>
          <span>Payment Router Engine</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Live Database Status Indicator */}
        <div
          onClick={fetchHealth}
          className="cursor-pointer group flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
          title="Click to refresh MongoDB & Neo4j connectivity status"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="hidden md:inline font-mono text-[11px]">
            {isHealthy ? 'MongoDB + Neo4j Connected' : 'DB Degraded'}
          </span>
          <RefreshCw className={`w-3 h-3 text-slate-400 group-hover:rotate-180 transition-transform ${loading ? 'animate-spin' : ''}`} />
        </div>

        {/* Primary Initiate Payment Action */}
        <Link
          href="/payment"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs hover:shadow-sm transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Initiate Payment</span>
        </Link>
      </div>
    </header>
  );
}

