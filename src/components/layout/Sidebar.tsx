'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Send,
  ListOrdered,
  ShieldAlert,
  UserCheck,
  History,
  GitFork,
  GitCompare,
  Network,
  Settings2,
  BarChart3,
  Activity,
  Sliders,
  HelpCircle,
  Shield,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const navGroups = [
    {
      group: 'OPERATIONS',
      items: [
        { label: 'Overview Dashboard', href: '/', icon: LayoutDashboard },
        { label: 'Payment Initiation', href: '/payment', icon: Send },
        { label: 'Transaction Monitor', href: '/transactions', icon: ListOrdered },
      ],
    },
    {
      group: 'RISK & COMPLIANCE',
      items: [
        { label: 'Fraud Monitoring', href: '/risk', icon: ShieldAlert },
        { label: 'Step-Up Queue', href: '/step-up', icon: UserCheck },
        { label: 'Audit Trail', href: '/audit', icon: History },
      ],
    },
    {
      group: 'PAYMENT ROUTING',
      items: [
        { label: 'Routing Explorer', href: '/routing', icon: GitFork },
        { label: 'Route Comparison', href: '/route-comparison', icon: GitCompare },
        { label: 'Provider Network', href: '/network', icon: Network },
        { label: 'Network Admin', href: '/admin', icon: Settings2 },
      ],
    },
    {
      group: 'INTELLIGENCE & SYSTEM',
      items: [
        { label: 'Reports & Analytics', href: '/reports', icon: BarChart3 },
        { label: 'System Health', href: '/health', icon: Activity },
        { label: 'Settings', href: '/settings', icon: Sliders },
        { label: 'Help & Architecture', href: '/help', icon: HelpCircle },
      ],
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-68 bg-slate-950 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div>
          <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white block leading-tight">
                  TrustRoute
                </span>
                <span className="text-[10px] font-semibold text-blue-400 tracking-wider uppercase block">
                  AI Payment Router
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Items */}
          <div className="px-3 py-4 overflow-y-auto max-h-[calc(100vh-8.5rem)] space-y-6">
            {navGroups.map((group) => (
              <div key={group.group}>
                <span className="px-3 text-[10px] font-bold tracking-widest text-slate-400 uppercase block mb-1.5">
                  {group.group}
                </span>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => onClose()}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white font-semibold shadow-xs'
                              : 'text-slate-300 hover:text-white hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={`w-4 h-4 ${
                                isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                              }`}
                            />
                            <span>{item.label}</span>
                          </div>
                          {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-200" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info badge */}
        <div className="p-3 border-t border-slate-900 bg-slate-950/80">
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-200">Prototype Mode</p>
              <p className="text-[10px] text-slate-400">Simulated Telecom & Rails</p>
            </div>
            <Link
              href="/help"
              className="text-blue-400 hover:text-blue-300 p-1 hover:bg-slate-800 rounded"
              title="System Documentation"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}

