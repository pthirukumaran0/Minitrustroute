'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/context/AuthContext';
import { UserRole, SystemHealthData } from '@/src/types/frontend';
import {
  Menu,
  Activity,
  RefreshCw,
  Bell,
  ChevronDown,
  LogOut,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Info,
  Check,
  X,
} from 'lucide-react';

interface HeaderProps {
  onOpenSidebar: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'RISK_ALERT' | 'STEP_UP' | 'SECURITY' | 'TRANSACTION' | 'SYSTEM';
  severity: 'critical' | 'warning' | 'info' | 'success';
  link: string;
  read: boolean;
}

export function Header({ onOpenSidebar }: HeaderProps) {
  const router = useRouter();
  const { user, role, switchPersona, logout } = useAuth();
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  // Notifications State
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const fetchHealth = async () => {
    try {
      setLoadingHealth(true);
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHealth(false);
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotifications(true);
      setNotificationError(null);
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
      } else {
        setNotificationError(`Failed to load notifications (HTTP ${res.status})`);
      }
    } catch (err: unknown) {
      setNotificationError(err instanceof Error ? err.message : 'Network error loading notifications');
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchNotifications();
  }, [fetchNotifications]);

  // Handle outside clicks to close dropdown menus
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationMenuRef.current &&
        !notificationMenuRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleNotificationClick = async (notif: NotificationItem) => {
    try {
      // Mark as read in backend
      fetch(`/api/notifications/${notif.id}/read`, { method: 'POST' }).catch(() => {});
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotificationsOpen(false);
      if (notif.link) {
        router.push(notif.link);
      }
    } catch {
      setNotificationsOpen(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const ids = notifications.map((n) => n.id);
      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const isHealthy = health?.status === 'healthy';

  const roleNameMap: Record<UserRole, string> = {
    sender: 'Corporate Sender',
    analyst: 'Fraud Operations',
    admin: 'System Administrator',
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString();
    } catch {
      return isoStr;
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between transition-colors shadow-2xs">
      {/* Brand & Left Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs">
          <span className="font-extrabold text-slate-900 tracking-tight">
            TrustRoute Zero-Trust Telecom Gateway
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500 font-medium">Cross-Border Payment Router</span>
        </div>
      </div>

      {/* Right Actions & Utilities */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Live Database Status Indicator */}
        <button
          onClick={fetchHealth}
          className="group flex items-center gap-2 px-2.5 py-1 rounded-full border border-slate-200/80 bg-slate-50 text-[11px] font-medium text-slate-700 hover:border-slate-300 transition-all shadow-2xs"
          title="Click to probe live MongoDB & Neo4j connectivity"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="hidden lg:inline font-mono text-[10px] font-bold">
            {isHealthy ? 'DB: HEALTHY' : 'DB: DEGRADED'}
          </span>
          <RefreshCw
            className={`w-3 h-3 text-slate-400 group-hover:rotate-180 transition-transform ${
              loadingHealth ? 'animate-spin' : ''
            }`}
          />
        </button>

        {/* Notifications Dropdown Container */}
        <div className="relative" ref={notificationMenuRef}>
          <button
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              if (!notificationsOpen) fetchNotifications();
            }}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 relative transition-colors cursor-pointer"
            aria-label="View notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown Panel */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Header */}
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setNotificationsOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 cursor-pointer"
                    aria-label="Close notifications"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                {loadingNotifications && notifications.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-500 font-medium">Fetching real telemetry & alerts...</p>
                  </div>
                ) : notificationError ? (
                  <div className="p-4 text-center space-y-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto" />
                    <p className="text-xs text-slate-600">{notificationError}</p>
                    <button
                      onClick={fetchNotifications}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                    >
                      Retry
                    </button>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-10 px-4 text-center space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-800">All Systems Normal</p>
                    <p className="text-[11px] text-slate-500">
                      No active alerts or anomalous transactions recorded.
                    </p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3 ${
                        !notif.read ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {notif.severity === 'critical' ? (
                          <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </div>
                        ) : notif.severity === 'warning' ? (
                          <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </div>
                        ) : notif.severity === 'success' ? (
                          <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                            <Info className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p
                            className={`text-xs truncate ${
                              !notif.read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                            }`}
                          >
                            {notif.title}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {formatTimestamp(notif.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                      </div>

                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-2" />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <Link
                  href="/audit"
                  onClick={() => setNotificationsOpen(false)}
                  className="font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1"
                >
                  <span>Audit Trail</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <Link
                  href="/transactions"
                  onClick={() => setNotificationsOpen(false)}
                  className="font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  View All Transactions
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

        {/* User Profile & Account Dropdown */}
        <div className="relative" ref={accountMenuRef}>
          <button
            onClick={() => setAccountMenuOpen(!accountMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
              {user?.name.charAt(0)}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-slate-800 leading-tight">{user?.name}</p>
              <p className="text-[10px] font-semibold text-slate-400 capitalize leading-tight">
                {roleNameMap[role]}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Account Dropdown Menu */}
          {accountMenuOpen && (
            <div
              className="absolute right-0 mt-2 bg-white border border-slate-200/90 rounded-2xl shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-150 w-44 p-1.5"
            >
              <button
                onClick={() => {
                  setAccountMenuOpen(false);
                  logout();
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
