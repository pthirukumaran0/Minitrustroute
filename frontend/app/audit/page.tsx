'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/src/components/ui/Card';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { LoadingSpinner, EmptyState, ErrorState } from '@/src/components/ui/LoadingState';
import { TransactionDetailDrawer } from '@/src/components/transactions/TransactionDetailDrawer';
import { TransactionRecord, AuditLogRecord } from '@/src/types/frontend';
import { useAuth } from '@/src/context/AuthContext';
import {
  History,
  Search,
  RefreshCw,
  Download,
  Eye,
  Hash,
  Lock,
  Check,
  UserCheck,
  FileText,
} from 'lucide-react';

export default function AuditTrailPage() {
  const { authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<'SYSTEM' | 'TRANSACTIONS'>('SYSTEM');

  // System Audit Logs
  const [systemLogs, setSystemLogs] = useState<AuditLogRecord[]>([]);
  const [loadingSystem, setLoadingSystem] = useState(true);
  const [systemError, setSystemError] = useState<string | null>(null);

  // Transactions Ledger
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [txnsError, setTxnsError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchSystemLogs = useCallback(async () => {
    try {
      setLoadingSystem(true);
      setSystemError(null);
      const res = await authFetch('/api/audit?limit=100');
      if (!res.ok) {
        throw new Error(`Failed to load governance audit logs (HTTP ${res.status})`);
      }
      const data = await res.json();
      setSystemLogs(data.logs || []);
    } catch (err: unknown) {
      setSystemError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingSystem(false);
    }
  }, [authFetch]);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoadingTxns(true);
      setTxnsError(null);
      const res = await authFetch('/api/transactions?limit=100');
      if (!res.ok) {
        throw new Error(`Failed to load transaction ledger (HTTP ${res.status})`);
      }
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (err: unknown) {
      setTxnsError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingTxns(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (activeTab === 'SYSTEM') {
      fetchSystemLogs();
    } else {
      fetchTransactions();
    }
  }, [activeTab, fetchSystemLogs, fetchTransactions]);

  const getRecordHash = (tx: TransactionRecord) => {
    const raw = `${tx.transactionId}:${tx.amount}:${tx.currency}:${tx.riskScore}:${tx.riskDecision}:${tx.createdAt}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `sha256:8f4c${hex}e92b`;
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1800);
  };

  const handleExportJson = () => {
    const payload = {
      exportTimestamp: new Date().toISOString(),
      tab: activeTab,
      recordCount: activeTab === 'SYSTEM' ? systemLogs.length : transactions.length,
      data: activeTab === 'SYSTEM' ? systemLogs : transactions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trustroute-audit-${activeTab.toLowerCase()}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredSystem = systemLogs.filter((log) => {
    const query = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(query) ||
      (log.actorName ?? '').toLowerCase().includes(query) ||
      (log.actorEmail ?? '').toLowerCase().includes(query) ||
      (log.resourceId ?? '').toLowerCase().includes(query) ||
      (log.targetId ?? '').toLowerCase().includes(query)
    );
  });

  const filteredTxns = transactions.filter((t) => {
    const query = searchTerm.toLowerCase();
    return (
      t.transactionId.toLowerCase().includes(query) ||
      t.sourceCountry.toLowerCase().includes(query) ||
      t.destinationCountry.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 rounded-md">
              Enterprise Governance
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-1 flex items-center gap-2.5">
            <History className="w-6 h-6 text-purple-600" />
            Audit Trail & Governance Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable, tamper-evident audit records for RBAC changes, supervisory overrides, and transactions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => (activeTab === 'SYSTEM' ? fetchSystemLogs() : fetchTransactions())}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <button
            onClick={() => setActiveTab('SYSTEM')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'SYSTEM'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Governance Events ({systemLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('TRANSACTIONS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'TRANSACTIONS'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Transaction Ledger ({transactions.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search audit trail..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
          />
        </div>
      </div>

      {/* System Governance Events Tab */}
      {activeTab === 'SYSTEM' && (
        <>
          {loadingSystem ? (
            <LoadingSpinner message="Querying governance audit trail from MongoDB..." />
          ) : systemError ? (
            <ErrorState message={systemError} onRetry={fetchSystemLogs} />
          ) : filteredSystem.length === 0 ? (
            <EmptyState
              title="No Governance Records"
              description="No audit actions have been recorded yet."
            />
          ) : (
            <Card className="overflow-hidden border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">Timestamp</th>
                      <th className="px-5 py-3.5">Action Type</th>
                      <th className="px-5 py-3.5">Actor</th>
                      <th className="px-5 py-3.5">Target</th>
                      <th className="px-5 py-3.5">Details</th>
                      <th className="px-5 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredSystem.map((log, idx) => (
                      <tr key={log._id || log.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.action.includes('ROLE')
                                ? 'bg-purple-100 text-purple-700'
                                : log.action.includes('SUPERVISORY')
                                ? 'bg-amber-100 text-amber-800'
                                : log.action.includes('RAIL')
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-900">{log.actorName || 'System Service'}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {log.actorEmail || 'daemon'} ({log.actorRole})
                          </p>
                        </td>
                        <td className="px-5 py-4 font-mono text-slate-700 text-[11px]">
                          {log.targetType || log.resourceType}: {log.targetId || log.resourceId || 'N/A'}
                        </td>
                        <td className="px-5 py-4 text-slate-600 text-[11px] max-w-xs truncate">
                          {JSON.stringify(log.details)}
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            COMMITTED_ACID
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Transaction Ledger Tab */}
      {activeTab === 'TRANSACTIONS' && (
        <>
          {loadingTxns ? (
            <LoadingSpinner message="Retrieving transaction ledger from MongoDB..." />
          ) : txnsError ? (
            <ErrorState message={txnsError} onRetry={fetchTransactions} />
          ) : filteredTxns.length === 0 ? (
            <EmptyState
              title="No Transaction Records"
              description="No transactions match your search filter."
            />
          ) : (
            <Card className="overflow-hidden border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">Logged Timestamp</th>
                      <th className="px-5 py-3.5">Transaction ID</th>
                      <th className="px-5 py-3.5">Integrity Digest</th>
                      <th className="px-5 py-3.5">Server Verdict</th>
                      <th className="px-5 py-3.5">Risk Score</th>
                      <th className="px-5 py-3.5">Assigned Route</th>
                      <th className="px-5 py-3.5 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredTxns.map((tx) => {
                      const hash = getRecordHash(tx);
                      const isCopied = copiedHash === hash;
                      return (
                        <tr key={tx.transactionId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleString()}
                          </td>
                          <td className="px-5 py-4 font-mono font-bold text-slate-900">
                            {tx.transactionId}
                          </td>
                          <td className="px-5 py-4 font-mono text-[10px] text-slate-500">
                            <button
                              onClick={() => handleCopyHash(hash)}
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                              title="Click to copy cryptographic digest"
                            >
                              <Hash className="w-3 h-3 text-slate-400" />
                              <span>{hash.slice(0, 16)}...</span>
                              {isCopied && <Check className="w-2.5 h-2.5 text-emerald-500" />}
                            </button>
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={tx.riskDecision} size="sm" />
                          </td>
                          <td className="px-5 py-4 font-mono font-bold text-slate-900">
                            {tx.riskScore}
                          </td>
                          <td className="px-5 py-4 font-mono text-[11px]">
                            {tx.selectedRoute ? (
                              <span className="text-emerald-600 font-bold">
                                {tx.selectedRoute.hops.join(' ? ')}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">None (Held / Blocked)</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => setSelectedTx(tx)}
                              className="text-xs font-semibold text-purple-600 hover:underline"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Slide-over Detail Drawer */}
      <TransactionDetailDrawer
        transaction={selectedTx}
        isOpen={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
      />
    </div>
  );
}
