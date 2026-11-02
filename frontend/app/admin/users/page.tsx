'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/src/components/ui/Card';
import { LoadingSpinner, EmptyState, ErrorState } from '@/src/components/ui/LoadingState';
import { UserPersonaProfile, UserPersonaAnalyticsResponse } from '@/src/types/frontend';
import { useAuth } from '@/src/context/AuthContext';
import {
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Eye,
  X,
  Lock,
  Unlock,
  Activity,
  DollarSign,
  Fingerprint,
  Clock,
  ChevronDown,
} from 'lucide-react';

export default function UserManagementPage() {
  const { authFetch } = useAuth();

  // User Management State
  const [userData, setUserData] = useState<UserPersonaAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'sender' | 'analyst'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Inspector modal for user details (Zero PII)
  const [selectedUser, setSelectedUser] = useState<UserPersonaProfile | null>(null);

  // Confirmation modal state for sensitive actions (Suspend / Reactivate)
  const [confirmModal, setConfirmModal] = useState<{
    user: UserPersonaProfile;
    action: 'SUSPEND' | 'REACTIVATE';
  } | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch('/api/analytics/user-personas');
      if (!res.ok) {
        throw new Error(`Failed to load user directory (HTTP ${res.status})`);
      }
      const data: UserPersonaAnalyticsResponse = await res.json();
      if (!data.success) {
        throw new Error('Failed to load user telemetry');
      }
      setUserData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Account status change handler (Suspend / Reactivate)
  const handleExecuteStatusChange = async () => {
    if (!confirmModal) return;
    const { user: targetUser, action } = confirmModal;
    const targetStatus = action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE';
    const targetIdentifier = targetUser.id || targetUser.userId;

    if (action === 'SUSPEND' && !suspendReason.trim()) {
      alert('A valid suspension rationale is required for regulatory audit trails.');
      return;
    }

    try {
      setIsSubmittingStatus(true);
      const res = await authFetch(`/api/users/${targetIdentifier}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          reason: action === 'SUSPEND' ? suspendReason.trim() : 'Administrative access restoration.',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to update account status');
      }

      setUserData((prev) => {
        if (!prev) return prev;
        const updatedUsers = prev.personas.map((u) =>
          u.userId === targetUser.userId || u.id === targetIdentifier
            ? { ...u, status: targetStatus as 'ACTIVE' | 'SUSPENDED' }
            : u
        );
        const activeCount = updatedUsers.filter((u) => u.status === 'ACTIVE').length;
        const suspendedCount = updatedUsers.filter((u) => u.status === 'SUSPENDED').length;
        return {
          ...prev,
          summary: {
            ...prev.summary,
            activePersonas: activeCount,
            suspendedPersonas: suspendedCount,
          },
          personas: updatedUsers,
        };
      });

      setFeedback({
        type: 'success',
        text: `Account ${targetUser.userId} has been ${action === 'SUSPEND' ? 'suspended' : 'reactivated'}.`,
      });
      setConfirmModal(null);
      setSuspendReason('');
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Filtered Users (Stable Anonymous IDs, Zero PII)
  const filteredUsers = useMemo(() => {
    if (!userData?.personas) return [];
    return userData.personas.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || u.userId.toLowerCase().includes(q);

      const matchesRole =
        roleFilter === 'ALL' ||
        (roleFilter === 'sender' && u.role === 'sender') ||
        (roleFilter === 'analyst' && u.role === 'analyst');

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.status === 'ACTIVE') ||
        (statusFilter === 'SUSPENDED' && u.status === 'SUSPENDED');

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [userData, searchQuery, roleFilter, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 rounded-md">
              Administrative Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-purple-600" />
            User Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Privacy-preserving user directory with stable anonymous identifiers, transaction metrics, and role-based access control.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchUsers}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="underline text-xs cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Aggregating user directory and calculating transaction metrics from MongoDB..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchUsers} />
      ) : !userData ? (
        <EmptyState title="No Users Available" description="Could not load user records." />
      ) : (
        <>
          {/* Summary Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Tracked Users</span>
                <Fingerprint className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {userData.summary.totalTrackedPersonas}
              </p>
              <span className="text-[10px] text-slate-500">Persistent stable IDs (USR-xxxx)</span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Active Accounts</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {userData.summary.activePersonas}
              </p>
              <span className="text-[10px] text-emerald-600/80">Authorized for routing</span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Suspended Accounts</span>
                <UserX className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-2xl font-black text-rose-600 mt-1">
                {userData.summary.suspendedPersonas}
              </p>
              <span className="text-[10px] text-rose-600/80">Access revoked by policy</span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Analyzed Transfers</span>
                <Activity className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-2xl font-black text-indigo-600 mt-1">
                {userData.summary.totalTransactionsAnalyzed}
              </p>
              <span className="text-[10px] text-slate-500">Mapped dynamically to users</span>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by User ID (e.g. USR-1001)..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Role Filter: Only User and Analyst */}
              <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
                {(
                  [
                    { key: 'ALL', label: 'All Roles' },
                    { key: 'sender', label: 'User' },
                    { key: 'analyst', label: 'Analyst' },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRoleFilter(r.key)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      roleFilter === r.key
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
                {(
                  [
                    { key: 'ALL', label: 'All Status' },
                    { key: 'ACTIVE', label: 'Active' },
                    { key: 'SUSPENDED', label: 'Suspended' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStatusFilter(s.key)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      statusFilter === s.key
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 ml-1">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero PII Display</span>
              </div>
            </div>
          </div>

          {/* User Table (10 Prescribed Columns, Zero PII) */}
          {filteredUsers.length === 0 ? (
            <EmptyState
              title="No Users Found"
              description="No user records match your search query or filter selection."
            />
          ) : (
            <Card className="overflow-hidden border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5">User ID</th>
                      <th className="px-4 py-3.5">Role</th>
                      <th className="px-4 py-3.5">Total Transactions</th>
                      <th className="px-4 py-3.5">Average Amount</th>
                      <th className="px-4 py-3.5">Approved</th>
                      <th className="px-4 py-3.5">Blocked</th>
                      <th className="px-4 py-3.5">STEP-UP</th>
                      <th className="px-4 py-3.5">Login Count</th>
                      <th className="px-4 py-3.5">Account Status</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredUsers.map((u) => {
                      const isUpdating = updatingId === (u.id || u.userId);
                      const isUserActive = u.status === 'ACTIVE';

                      return (
                        <tr
                          key={u.userId}
                          onClick={() => setSelectedUser(u)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        >
                          {/* 1. User ID (Stable Anonymous ID) */}
                          <td className="px-4 py-4 font-mono font-bold text-purple-700 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200">
                              <Fingerprint className="w-3.5 h-3.5 text-purple-600" />
                              {u.userId}
                            </span>
                          </td>

                          {/* 2. Role (Read-only Badge) */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                                u.role === 'analyst'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}
                            >
                              {u.role === 'analyst' ? 'Analyst' : 'User'}
                            </span>
                          </td>

                          {/* 3. Total Transactions */}
                          <td className="px-4 py-4 font-bold text-slate-900 whitespace-nowrap">
                            {u.totalTransactions}
                          </td>

                          {/* 4. Average Amount (N/A if 0 transactions) */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            {u.totalTransactions > 0 ? (
                              <span className="font-bold text-slate-900">
                                ${u.averageAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-semibold italic">N/A</span>
                            )}
                          </td>

                          {/* 5. Approved */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {u.approvedTransactions}
                            </span>
                          </td>

                          {/* 6. Blocked */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              {u.blockedTransactions}
                            </span>
                          </td>

                          {/* 7. STEP-UP */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              {u.stepUpTransactions}
                            </span>
                          </td>

                          {/* 8. Login Count */}
                          <td className="px-4 py-4 text-slate-800 font-bold whitespace-nowrap">
                            {u.loginCount}
                          </td>

                          {/* 9. Account Status */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isUserActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {u.status}
                            </span>
                          </td>

                          {/* 10. Actions */}
                          <td className="px-4 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {isUserActive ? (
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() =>
                                    setConfirmModal({
                                      user: u,
                                      action: 'SUSPEND',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer shadow-2xs border border-rose-200 disabled:opacity-40"
                                  title="Suspend account access"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Suspend</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() =>
                                    setConfirmModal({
                                      user: u,
                                      action: 'REACTIVATE',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer shadow-2xs border border-emerald-200 disabled:opacity-40"
                                  title="Reactivate account"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span>Reactivate</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setSelectedUser(u)}
                                className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Inspect user details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* User Details Modal (Zero PII) */}
          {selectedUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="w-5 h-5 text-purple-600" />
                    <div>
                      <h3 className="font-bold text-slate-900 font-mono text-base">{selectedUser.userId}</h3>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Role: {selectedUser.role === 'sender' ? 'User' : 'Analyst'} • Status: {selectedUser.status}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Logins:</span>
                    <strong className="text-slate-800">{selectedUser.loginCount}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Last Active:</span>
                    <strong className="text-slate-800">
                      {new Date(selectedUser.lastLoginTime).toLocaleString()}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Average Transfer Amount:</span>
                    <strong className="text-slate-800">
                      {selectedUser.totalTransactions > 0
                        ? `$${selectedUser.averageAmount.toFixed(2)}`
                        : 'N/A'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Analyzed Transfers:</span>
                    <strong className="text-slate-800">{selectedUser.totalTransactions}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Transaction Breakdown:</span>
                    <span className="font-semibold text-slate-700">
                      {selectedUser.approvedTransactions} Approved • {selectedUser.blockedTransactions} Blocked • {selectedUser.stepUpTransactions} STEP-UP
                    </span>
                  </div>
                </div>

                {/* Risk Score History Timeline */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-600" />
                    Risk Score History (Last 10 Evaluations)
                  </h4>
                  {selectedUser.riskScoreHistory.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No historical evaluations recorded for this user.</p>
                  ) : (
                    <div className="flex items-center gap-1.5 overflow-x-auto py-2">
                      {selectedUser.riskScoreHistory.map((h, i) => (
                        <div
                          key={i}
                          className={`p-2 rounded-xl text-center shrink-0 min-w-[55px] ${
                            h.score >= 70
                              ? 'bg-rose-50 border border-rose-200 text-rose-800'
                              : h.score >= 35
                              ? 'bg-amber-50 border border-amber-200 text-amber-800'
                              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                          }`}
                        >
                          <span className="text-[11px] font-black">{h.score}</span>
                          <span className="block text-[8px] uppercase tracking-wider font-bold mt-0.5">
                            {h.decision.substring(0, 3)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Anonymized Transfer Activity */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800">Recent User Activity</h4>
                  {selectedUser.recentActivity.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No transfer activity recorded.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {selectedUser.recentActivity.map((t) => (
                        <div
                          key={t.transactionId}
                          className="p-2 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-mono font-bold text-purple-700">{t.transactionId}</span>
                            <span className="block text-[10px] text-slate-400">
                              {new Date(t.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-900">
                              {t.amount.toLocaleString()} {t.currency}
                            </span>
                            <span
                              className={`block text-[10px] font-bold ${
                                t.riskDecision === 'APPROVED'
                                  ? 'text-emerald-700'
                                  : t.riskDecision === 'BLOCKED'
                                  ? 'text-rose-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {t.riskDecision} ({t.riskScore}/100)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirm Status Modal (Suspend / Reactivate) */}
          {confirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    {confirmModal.action === 'SUSPEND' ? (
                      <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                        <Lock className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <Unlock className="w-4 h-4" />
                      </div>
                    )}
                    <h3 className="text-base font-bold text-slate-900">
                      {confirmModal.action === 'SUSPEND' ? 'Suspend User Account' : 'Reactivate User Account'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setConfirmModal(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-slate-600">
                  Are you sure you want to{' '}
                  <strong className="text-slate-800">
                    {confirmModal.action === 'SUSPEND' ? 'suspend' : 'reactivate'}
                  </strong>{' '}
                  account <strong className="font-mono text-purple-700">{confirmModal.user.userId}</strong>?
                  {confirmModal.action === 'SUSPEND'
                    ? ' This will immediately revoke transaction initiation and login access.'
                    : ' This will restore full transaction privileges.'}
                </p>

                {confirmModal.action === 'SUSPEND' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Mandatory Justification <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      placeholder="Specify compliance violation, fraudulent velocity, or administrative decision..."
                      className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setConfirmModal(null)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingStatus}
                    onClick={handleExecuteStatusChange}
                    className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg shadow-sm cursor-pointer disabled:opacity-50 ${
                      confirmModal.action === 'SUSPEND'
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {isSubmittingStatus
                      ? 'Processing...'
                      : confirmModal.action === 'SUSPEND'
                      ? 'Confirm Suspension'
                      : 'Confirm Reactivation'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
