'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/src/context/AuthContext';
import { UserRole } from '@/src/types/frontend';
import {
  LayoutDashboard,
  Send,
  ListOrdered,
  ShieldAlert,
  UserCheck,
  History,
  GitCompare,
  Network,
  BarChart3,
  Activity,
  Sliders,
  Users,
  ChevronRight,
  Shield,
  ArrowRightLeft,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, user, switchPersona, logout } = useAuth();

  // Navigation definition scoped strictly by active persona
  const senderNav = [
    {
      group: 'TRANSFER PORTAL',
      items: [
        { label: 'Dashboard', href: '/', icon: LayoutDashboard },
        { label: 'New Transfer', href: '/payment', icon: ArrowRightLeft },
        { label: 'Simulator', href: '/route-comparison', icon: GitCompare },
        { label: 'My Transfers', href: '/transactions', icon: ListOrdered },
        { label: 'Security & Verification', href: '/step-up', icon: UserCheck },
      ],
    },
  ];

  const analystNav = [
    {
      group: 'OPERATIONS CONSOLE',
      items: [
        { label: 'Dashboard', href: '/analyst', icon: LayoutDashboard },
        { label: 'Urgent Review Queue', href: '/review-queue', icon: UserCheck },
        { label: 'Transaction Explorer', href: '/transactions', icon: ListOrdered },
        { label: 'Risk Intelligence', href: '/risk', icon: ShieldAlert },
      ],
    },
    {
      group: 'NETWORK & TELEMETRY',
      items: [
        { label: 'Graph', href: '/network', icon: Network },
        { label: 'Simulator', href: '/route-comparison', icon: GitCompare },
        { label: 'Analytics', href: '/reports', icon: BarChart3 },
        { label: 'Audit Trail', href: '/audit', icon: History },
      ],
    },
  ];

  const adminNav = [
    {
      group: 'INFRASTRUCTURE & DASHBOARD',
      items: [
        { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { label: 'Simulator', href: '/admin/simulation', icon: GitCompare },
        { label: 'Analytics', href: '/reports', icon: BarChart3 },
        { label: 'Review Queue', href: '/review-queue', icon: UserCheck },
        { label: 'Fraud Logs', href: '/admin/fraud-logs', icon: ShieldAlert },
      ],
    },
    {
      group: 'ADMINISTRATION & RAILS',
      items: [
        { label: 'User Management', href: '/admin/users', icon: Users },
        { label: 'Graph', href: '/network', icon: Network },
        { label: 'System Health', href: '/health', icon: Activity },
        { label: 'Audit Log', href: '/audit', icon: History },
      ],
    },
  ];

  const currentNavGroups =
    role === 'admin' ? adminNav : role === 'analyst' ? analystNav : senderNav;

  const roleLabels: Record<UserRole, { badge: string; color: string; bg: string }> = {
    sender: {
      badge: 'Corporate Client',
      color: 'text-indigo-700',
      bg: 'bg-indigo-50 border-indigo-200/80',
    },
    analyst: {
      badge: 'Fraud Operations',
      color: 'text-amber-700',
      bg: 'bg-amber-50 border-amber-200/80',
    },
    admin: {
      badge: 'System Administrator',
      color: 'text-purple-700',
      bg: 'bg-purple-50 border-purple-200/80',
    },
  };

  const handleSwitchPersona = async (newRole: UserRole) => {
    await switchPersona(newRole);
    onClose();
    if (newRole === 'sender') {
      router.push('/');
    } else if (newRole === 'analyst') {
      router.push('/analyst');
    } else {
      router.push('/admin');
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-68 bg-white border-r border-slate-200/80 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } shadow-xs`}
      >
        {/* Brand header */}
        <div>
          <div className="h-16 px-5 border-b border-slate-200/80 flex items-center justify-between bg-white">
            <Link
              href="/"
              onClick={() => onClose()}
              className="flex items-center gap-2.5 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 flex items-center justify-center text-white shadow-xs group-hover:shadow-sm transition-all">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-black text-base tracking-tight text-slate-900 block leading-tight">
                  TrustRoute
                </span>
                <span className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase block">
                  Zero-Trust AI
                </span>
              </div>
            </Link>
          </div>

          {/* Active Role Indicator Card */}
          <div className="p-3 bg-slate-50/60 border-b border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Current Persona
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleLabels[role].bg} ${roleLabels[role].color}`}
              >
                {roleLabels[role].badge}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-800 truncate">{user?.name}</p>
            <p className="text-[11px] text-slate-400 truncate">{user?.organization}</p>
          </div>

          {/* Navigation Items */}
          <div className="px-3 py-4 overflow-y-auto max-h-[calc(100vh-14rem)] space-y-6">
            {currentNavGroups.map((group) => (
              <div key={group.group}>
                <span className="px-3 text-[10px] font-bold tracking-widest text-slate-400 uppercase block mb-1.5">
                  {group.group}
                </span>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;

                    const isDashboardItem = item.label === 'Dashboard';
                    const isDashboardPage =
                      pathname === '/' ||
                      (role === 'sender' && pathname === '/sender') ||
                      (role === 'analyst' && pathname === '/analyst') ||
                      (role === 'admin' && pathname === '/admin');

                    const isActive = isDashboardItem
                      ? isDashboardPage
                      : pathname === item.href ||
                        (item.href === '/network' && pathname === '/routing') ||
                        (item.href === '/reports' && pathname === '/analytics');

                    return (
                      <li key={item.label + item.href}>
                        <Link
                          href={item.href}
                          onClick={() => onClose()}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={`w-4 h-4 ${
                                isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                              }`}
                            />
                            <span>{item.label}</span>
                          </div>
                          {isActive && <ChevronRight className="w-3.5 h-3.5 text-indigo-600" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Role Switcher & Session Toolbar in Footer */}
        <div className="p-3 border-t border-slate-200/80 bg-slate-50/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Role: <span className="text-indigo-600 font-extrabold">{role.toUpperCase()}</span>
            </span>
            <button
              onClick={() => logout()}
              className="text-[10px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3 h-3" />
              <span>Logout</span>
            </button>
          </div>

          {user?.canSwitchRoles !== false && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3 text-indigo-600" />
                  Switch Demo Role
                </span>
                <span className="text-[9px] font-semibold text-slate-400">Authorized</span>
              </div>
              <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200/80 shadow-2xs">
                <button
                  onClick={() => handleSwitchPersona('sender')}
                  className={`px-1.5 py-1 text-[10px] font-bold rounded-lg transition-all text-center truncate cursor-pointer ${
                    role === 'sender'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Switch to Corporate Sender (Sarah Jenkins)"
                >
                  Sender
                </button>
                <button
                  onClick={() => handleSwitchPersona('analyst')}
                  className={`px-1.5 py-1 text-[10px] font-bold rounded-lg transition-all text-center truncate cursor-pointer ${
                    role === 'analyst'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Switch to Fraud Analyst (Alex Rivera)"
                >
                  Analyst
                </button>
                <button
                  onClick={() => handleSwitchPersona('admin')}
                  className={`px-1.5 py-1 text-[10px] font-bold rounded-lg transition-all text-center truncate cursor-pointer ${
                    role === 'admin'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Switch to System Administrator (Elena Rostova)"
                >
                  Admin
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
