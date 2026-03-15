"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface LedgerEntry {
  id: string;
  type: string;
  amountUsd: string | null;
  amountRmb: string | null;
  description: string | null;
  createdAt: string;
}

interface Summary {
  totalEarnedUsd: string;
  totalEarnedRmb: string;
  totalPaidOutUsd: string;
  totalPaidOutRmb: string;
  availableUsd: string;
  availableRmb: string;
}

interface PaidRecord {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  amountUsd: string | null;
  amountRmb: string | null;
  description: string | null;
  createdAt: string;
}

interface PayoutTask {
  taskTitle: string;
  channel: string;
  approvedAt: string;
  approvedBy: string | null;
  createdBy: string;
  amountUsd: string;
  amountRmb: string;
}

interface PayoutUser {
  userId: string;
  username: string;
  displayName: string | null;
  currency: string | null;
  owedUsd: string;
  owedRmb: string;
  tasks: PayoutTask[];
}

const ENTRY_STYLES: Record<string, { color: string; label: string }> = {
  task_earning: { color: "text-green-400", label: "Earning" },
  bonus: { color: "text-amber-400", label: "Bonus" },
  adjustment: { color: "text-blue-400", label: "Adjustment" },
  payout: { color: "text-red-400", label: "Payout" },
};

export default function FinancialsPage() {
  const { user } = useAuth();

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<"usd" | "rmb">("usd");
  const [typeFilter, setTypeFilter] = useState("");

  // Admin payout state
  const [payouts, setPayouts] = useState<PayoutUser[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [selectedPayouts, setSelectedPayouts] = useState<string[]>([]);

  // Expanded task breakdown per user
  const [expandedUsers, setExpandedUsers] = useState<string[]>([]);

  // Paid history state (admin + supermod)
  const [paidHistory, setPaidHistory] = useState<PaidRecord[]>([]);
  const [paidHistoryLoading, setPaidHistoryLoading] = useState(false);

  const isAdmin = user?.role === "admin";
  const canViewPayments = ["admin", "supermod"].includes(user?.role || "");

  useEffect(() => {
    setCurrency(user?.currency === "rmb" ? "rmb" : "usd");
  }, [user]);

  const fetchLedger = () => {
    fetch("/api/ledger")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries || []);
        setSummary(data.summary || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchPayouts = () => {
    if (!isAdmin) return;
    setPayoutLoading(true);
    fetch("/api/admin/payouts")
      .then((r) => r.json())
      .then((data) => setPayouts(data.payouts || []))
      .catch(() => {})
      .finally(() => setPayoutLoading(false));
  };

  const fetchPaidHistory = () => {
    if (!canViewPayments) return;
    setPaidHistoryLoading(true);
    fetch("/api/admin/payouts/history")
      .then((r) => r.json())
      .then((data) => setPaidHistory(data.history || []))
      .catch(() => {})
      .finally(() => setPaidHistoryLoading(false));
  };

  useEffect(() => {
    fetchLedger();
    fetchPayouts();
    fetchPaidHistory();
  }, []);

  const handleExecutePayouts = async () => {
    if (selectedPayouts.length === 0) return;
    const res = await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: selectedPayouts }),
    });
    if (res.ok) {
      setSelectedPayouts([]);
      fetchPayouts();
      fetchLedger();
      fetchPaidHistory();
    }
  };

  const toggleUserExpand = (userId: string) => {
    setExpandedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const filteredEntries = typeFilter
    ? entries.filter((e) => e.type === typeFilter)
    : entries;

  const formatAmount = (entry: LedgerEntry) => {
    const val =
      currency === "rmb"
        ? parseFloat(entry.amountRmb || "0")
        : parseFloat(entry.amountUsd || "0");
    const prefix = currency === "rmb" ? "¥" : "$";
    return `${val >= 0 ? "+" : ""}${prefix}${Math.abs(val).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-discord-bg">
      {/* Currency toggle bar */}
      <div className="h-10 px-4 flex items-center bg-discord-bg shrink-0">
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setCurrency("usd")}
            className={`text-xs px-2 py-1 rounded transition ${
              currency === "usd"
                ? "bg-discord-accent text-white"
                : "text-discord-text-muted hover:text-discord-text"
            }`}
          >
            USD
          </button>
          <button
            onClick={() => setCurrency("rmb")}
            className={`text-xs px-2 py-1 rounded transition ${
              currency === "rmb"
                ? "bg-discord-accent text-white"
                : "text-discord-text-muted hover:text-discord-text"
            }`}
          >
            RMB
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-center text-discord-text-muted py-8">Loading...</p>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Wallet Summary Cards */}
            {summary && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-discord-sidebar rounded-lg p-4 border border-discord-border">
                  <p className="text-xs text-discord-text-muted uppercase mb-1">
                    Available Balance
                  </p>
                  <p className="text-2xl font-bold text-green-400">
                    {currency === "rmb"
                      ? `¥${summary.availableRmb}`
                      : `$${summary.availableUsd}`}
                  </p>
                </div>
                <div className="bg-discord-sidebar rounded-lg p-4 border border-discord-border">
                  <p className="text-xs text-discord-text-muted uppercase mb-1">
                    Total Earned
                  </p>
                  <p className="text-2xl font-bold text-discord-text">
                    {currency === "rmb"
                      ? `¥${summary.totalEarnedRmb}`
                      : `$${summary.totalEarnedUsd}`}
                  </p>
                </div>
                <div className="bg-discord-sidebar rounded-lg p-4 border border-discord-border">
                  <p className="text-xs text-discord-text-muted uppercase mb-1">
                    Total Paid Out
                  </p>
                  <p className="text-2xl font-bold text-discord-text-secondary">
                    {currency === "rmb"
                      ? `¥${summary.totalPaidOutRmb}`
                      : `$${summary.totalPaidOutUsd}`}
                  </p>
                </div>
              </div>
            )}

            {/* Admin: Payout Section */}
            {isAdmin && (
              <div className="bg-discord-sidebar rounded-lg p-4 border border-discord-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-discord-text uppercase">
                    Admin: Payouts Owed
                  </h3>
                  <button
                    onClick={handleExecutePayouts}
                    disabled={selectedPayouts.length === 0}
                    className={`text-xs px-3 py-1 rounded font-semibold transition ${
                      selectedPayouts.length > 0
                        ? "bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                        : "bg-green-600/30 text-white/40 cursor-not-allowed"
                    }`}
                  >
                    Execute Payouts{selectedPayouts.length > 0 ? ` (${selectedPayouts.length})` : ""}
                  </button>
                </div>

                {payoutLoading ? (
                  <p className="text-sm text-discord-text-muted">Loading...</p>
                ) : payouts.length === 0 ? (
                  <p className="text-sm text-discord-text-muted">
                    No payouts pending
                  </p>
                ) : (
                  <div className="space-y-1">
                    {payouts.map((p) => (
                      <div key={p.userId}>
                        <div className="flex items-center gap-3 px-3 py-2 bg-discord-bg rounded hover:bg-discord-bg-hover/50 transition">
                          <input
                            type="checkbox"
                            checked={selectedPayouts.includes(p.userId)}
                            onChange={(e) =>
                              setSelectedPayouts((prev) =>
                                e.target.checked
                                  ? [...prev, p.userId]
                                  : prev.filter((id) => id !== p.userId)
                              )
                            }
                            className="rounded cursor-pointer"
                          />
                          <span className="text-sm text-discord-text font-medium flex-1">
                            {p.displayName || p.username}
                          </span>
                          <span className="text-sm font-bold text-green-400">
                            ${p.owedUsd}
                          </span>
                          <span className="text-xs text-discord-text-muted">
                            ¥{p.owedRmb}
                          </span>
                          {p.tasks && p.tasks.length > 0 && (
                            <button
                              onClick={() => toggleUserExpand(p.userId)}
                              className="text-xs text-discord-text-muted hover:text-discord-text transition cursor-pointer"
                            >
                              {expandedUsers.includes(p.userId) ? "▲" : "▼"} {p.tasks.length} task{p.tasks.length !== 1 ? "s" : ""}
                            </button>
                          )}
                        </div>
                        {expandedUsers.includes(p.userId) && p.tasks && p.tasks.length > 0 && (
                          <div className="ml-10 mr-3 mb-1 border-l-2 border-discord-border pl-3 space-y-0.5">
                            {p.tasks.map((t, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 py-1 text-xs text-discord-text-muted"
                              >
                                <span className="text-discord-text-secondary truncate max-w-[200px]" title={t.taskTitle}>
                                  {t.taskTitle}
                                </span>
                                <span className="text-discord-text-muted">·</span>
                                <span className="text-discord-text-muted">#{t.channel}</span>
                                <span className="text-discord-text-muted">·</span>
                                <span className="text-discord-text-muted">
                                  {t.approvedBy ? `approved by ${t.approvedBy}` : `created by ${t.createdBy}`}
                                </span>
                                <span className="text-discord-text-muted">·</span>
                                <span className="text-discord-text-muted">
                                  {new Date(t.approvedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                                </span>
                                <span className="ml-auto text-green-400 font-medium">
                                  ${t.amountUsd}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Paid History (admin + supermod) */}
            {canViewPayments && (
              <div className="bg-discord-sidebar rounded-lg p-4 border border-discord-border">
                <h3 className="text-sm font-semibold text-discord-text uppercase mb-3">
                  Paid History
                </h3>
                {paidHistoryLoading ? (
                  <p className="text-sm text-discord-text-muted">Loading...</p>
                ) : paidHistory.length === 0 ? (
                  <p className="text-sm text-discord-text-muted">
                    No payouts executed yet
                  </p>
                ) : (
                  <div className="space-y-1">
                    {paidHistory.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center gap-3 px-3 py-2 bg-discord-bg rounded"
                      >
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                          Paid
                        </span>
                        <span className="text-sm text-discord-text font-medium">
                          {record.displayName || record.username}
                        </span>
                        <span className="text-sm text-discord-text-secondary flex-1 truncate">
                          {record.description}
                        </span>
                        <span className="text-xs text-discord-text-muted">
                          {formatDate(record.createdAt)}
                        </span>
                        <span className="text-sm font-bold text-red-400">
                          {currency === "rmb"
                            ? `-¥${Math.abs(parseFloat(record.amountRmb || "0")).toFixed(2)}`
                            : `-$${Math.abs(parseFloat(record.amountUsd || "0")).toFixed(2)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Transaction History */}
            <div className="bg-discord-sidebar rounded-lg p-4 border border-discord-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-discord-text uppercase">
                  Transaction History
                </h3>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="text-xs px-2 py-1 bg-discord-bg border border-discord-border rounded text-discord-text"
                >
                  <option value="">All Types</option>
                  <option value="task_earning">Earnings</option>
                  <option value="bonus">Bonuses</option>
                  <option value="payout">Payouts</option>
                </select>
              </div>
              {filteredEntries.length === 0 ? (
                <p className="text-sm text-discord-text-muted text-center py-4">
                  No transactions yet
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredEntries.map((entry) => {
                    const style = ENTRY_STYLES[entry.type] || ENTRY_STYLES.task_earning;
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 px-3 py-2 bg-discord-bg rounded"
                      >
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            entry.type === "payout"
                              ? "bg-red-500/20"
                              : entry.type === "bonus"
                              ? "bg-amber-500/20"
                              : "bg-green-500/20"
                          } ${style.color}`}
                        >
                          {style.label}
                        </span>
                        <span className="text-sm text-discord-text-secondary flex-1 truncate">
                          {entry.description}
                        </span>
                        <span className="text-xs text-discord-text-muted">
                          {formatDate(entry.createdAt)}
                        </span>
                        <span
                          className={`text-sm font-bold ${
                            parseFloat(
                              currency === "rmb"
                                ? entry.amountRmb || "0"
                                : entry.amountUsd || "0"
                            ) >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {formatAmount(entry)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
