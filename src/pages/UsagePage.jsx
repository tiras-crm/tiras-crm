// TIRAS CRM V2 — Usage Page
// Route: /admin/usage
// Company Admin only
// Features: minutes used this month, per-agent breakdown, storage vs plan limit,
//           recordings count, AI summaries count, export usage CSV

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  doc, onSnapshot, collection, query, where,
  getDocs, orderBy, Timestamp,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS, STYLES, PLANS,
} from "../theme";

// ─── Inject styles ────────────────────────────────────────────────────────────

const injectStyles = () => {
  if (document.getElementById("tiras-usage-styles")) return;
  const s = document.createElement("style");
  s.id = "tiras-usage-styles";
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
    @keyframes u-fade    { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
    @keyframes u-shimmer { 0%{background-position:-600px 0;} 100%{background-position:600px 0;} }
    @keyframes u-bar     { from{width:0%;} to{width:var(--bar-w);} }
    .u-row:hover { background-color: ${COLORS.surfaceHover} !important; }
    .u-export-btn:hover { background-color: ${COLORS.primaryHover} !important; transform: translateY(-1px); }
  `;
  document.head.appendChild(s);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatINR = (n = 0) => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);

const formatGB = (bytes = 0) => {
  const gb = bytes / (1024 ** 3);
  if (gb < 0.01) return `${Math.round(bytes / (1024 ** 2))} MB`;
  return `${gb.toFixed(2)} GB`;
};

const Shimmer = ({ w = "100%", h = "16px" }) => (
  <div style={{
    width: w, height: h, borderRadius: RADIUS.base,
    background: `linear-gradient(90deg,${COLORS.surface} 0%,${COLORS.surfaceHover} 40%,${COLORS.surface} 80%)`,
    backgroundSize: "600px 100%",
    animation: "u-shimmer 1.4s ease-in-out infinite",
  }} />
);

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const ProgressBar = ({ used, total, unit = "", color = COLORS.primary, label }) => {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const barColor = pct >= 90 ? COLORS.accent : pct >= 70 ? COLORS.warning : color;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium, color: COLORS.textSecondary }}>{label}</span>
          <span style={{ fontFamily: FONTS.mono, fontSize: FONTS.size.sm, color: pct >= 90 ? COLORS.accent : COLORS.textPrimary, fontWeight: 600 }}>
            {used}{unit} / {total}{unit}
          </span>
        </div>
      )}
      <div style={{ height: "10px", backgroundColor: COLORS.border, borderRadius: RADIUS.full, overflow: "hidden" }}>
        <div style={{
          height:          "100%",
          width:           `${pct}%`,
          backgroundColor: barColor,
          borderRadius:    RADIUS.full,
          transition:      "width 0.8s ease",
          boxShadow:       pct > 0 ? `0 0 8px ${barColor}60` : "none",
        }} />
      </div>
      <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.xs, color: pct >= 90 ? COLORS.accent : COLORS.textMuted }}>
        {pct.toFixed(1)}% used
        {pct >= 90 && " — Critical: nearing limit"}
        {pct >= 70 && pct < 90 && " — Approaching limit"}
      </div>
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, sub, color, loading }) => (
  <div style={{ ...STYLES.card, display: "flex", flexDirection: "column", gap: SPACING.sm }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textSecondary, fontWeight: FONTS.weight.medium }}>{label}</span>
      <span style={{ fontSize: "20px" }}>{icon}</span>
    </div>
    {loading
      ? <Shimmer w="100px" h="36px" />
      : <div style={{ fontFamily: FONTS.heading, fontSize: "32px", fontWeight: 700, color: color || COLORS.primary, lineHeight: 1 }}>{value}</div>
    }
    {sub && <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.xs, color: COLORS.textMuted }}>{sub}</div>}
  </div>
);

// ─── Agent Breakdown Table ────────────────────────────────────────────────────

const AgentBreakdown = ({ agents, callData, loading }) => {
  if (loading) {
    return (
      <div style={{ ...STYLES.card }}>
        <h3 style={{ fontFamily: FONTS.heading, fontSize: "16px", fontWeight: 700, color: COLORS.textPrimary, margin: `0 0 ${SPACING.base}` }}>
          Per-Agent Breakdown
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm }}>
          {[1, 2, 3].map((i) => <Shimmer key={i} h="44px" />)}
        </div>
      </div>
    );
  }

  // Aggregate per agent from callData
  const agentStats = {};
  callData.forEach((call) => {
    const aid = call.agentId;
    if (!agentStats[aid]) {
      agentStats[aid] = { minutes: 0, calls: 0, cost: 0 };
    }
    const mins = Math.ceil((call.duration || 0) / 60);
    agentStats[aid].minutes += mins;
    agentStats[aid].calls   += 1;
    agentStats[aid].cost    += mins * 1.00;
  });

  const rows = agents.map((agent) => ({
    ...agent,
    ...(agentStats[agent.uid] || { minutes: 0, calls: 0, cost: 0 }),
  })).sort((a, b) => b.minutes - a.minutes);

  const maxMinutes = Math.max(...rows.map((r) => r.minutes), 1);

  if (rows.length === 0) {
    return (
      <div style={{ ...STYLES.card, textAlign: "center", padding: SPACING["3xl"] }}>
        <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.base, color: COLORS.textMuted }}>No agent data this month.</div>
      </div>
    );
  }

  return (
    <div style={{ ...STYLES.card }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.lg, flexWrap: "wrap", gap: SPACING.sm }}>
        <h3 style={{ fontFamily: FONTS.heading, fontSize: "16px", fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>
          Per-Agent Breakdown — This Month
        </h3>
        <span style={{ fontFamily: FONTS.body, fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
          {rows.length} agent{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Desktop table */}
      <div className="u-table-view" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "520px" }}>
          <thead>
            <tr>
              {["Agent", "Calls", "Minutes", "Activity", "Cost (₹1/min)"].map((h) => (
                <th key={h} style={{ ...STYLES.tableHeader, textAlign: "left", padding: `${SPACING.sm} ${SPACING.base}`, borderBottom: `1px solid ${COLORS.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.uid || i} className="u-row" style={{ borderBottom: `1px solid ${COLORS.border}`, backgroundColor: i % 2 === 0 ? "transparent" : `${COLORS.surfaceActive}40` }}>
                <td style={{ padding: `${SPACING.sm} ${SPACING.base}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm }}>
                    <div style={{
                      width: "30px", height: "30px", borderRadius: RADIUS.full,
                      backgroundColor: COLORS.primaryMuted, border: `1px solid ${COLORS.primary}`,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <span style={{ color: COLORS.primary, fontSize: FONTS.size.sm, fontWeight: 700 }}>
                        {row.displayName?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>{row.displayName || "Unknown"}</div>
                      <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.xs, color: COLORS.textMuted }}>{row.role === "manager" ? "Manager" : "Agent"}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: `${SPACING.sm} ${SPACING.base}`, fontFamily: FONTS.mono, fontSize: FONTS.size.base, fontWeight: 600, color: COLORS.textPrimary }}>
                  {row.calls.toLocaleString("en-IN")}
                </td>
                <td style={{ padding: `${SPACING.sm} ${SPACING.base}`, fontFamily: FONTS.mono, fontSize: FONTS.size.base, fontWeight: 600, color: COLORS.info }}>
                  {row.minutes.toLocaleString("en-IN")}
                </td>
                <td style={{ padding: `${SPACING.sm} ${SPACING.base}`, width: "140px" }}>
                  <div style={{ height: "6px", backgroundColor: COLORS.border, borderRadius: RADIUS.full, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${maxMinutes > 0 ? (row.minutes / maxMinutes) * 100 : 0}%`, backgroundColor: COLORS.primary, borderRadius: RADIUS.full, transition: "width 0.8s ease" }} />
                  </div>
                </td>
                <td style={{ padding: `${SPACING.sm} ${SPACING.base}`, fontFamily: FONTS.mono, fontSize: FONTS.size.base, fontWeight: 600, color: COLORS.warning }}>
                  {formatINR(row.cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="u-card-view" style={{ display: "none" }}>
        <style>{`@media(max-width:640px){.u-table-view{display:none !important;}.u-card-view{display:block !important;}}`}</style>
        {rows.map((row, i) => (
          <div key={row.uid || i} style={{ padding: SPACING.base, borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>{row.displayName || "Unknown"}</div>
              <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textMuted }}>{row.calls} calls · {row.minutes} min</div>
            </div>
            <div style={{ fontFamily: FONTS.mono, fontSize: FONTS.size.base, fontWeight: 700, color: COLORS.warning }}>{formatINR(row.cost)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── UsagePage ────────────────────────────────────────────────────────────────

export const UsagePage = () => {
  injectStyles();

  const { companyId, isCompanyAdmin } = useAuth();
  const navigate = useNavigate();

  const [company,   setCompany]   = useState(null);
  const [agents,    setAgents]    = useState([]);
  const [callData,  setCallData]  = useState([]);
  const [aiCount,   setAiCount]   = useState(0);
  const [recCount,  setRecCount]  = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [exporting, setExporting] = useState(false);

  // Guard — admin only
  useEffect(() => {
    if (!isCompanyAdmin) { navigate("/agent/dashboard"); }
  }, [isCompanyAdmin, navigate]);

  // Real-time company doc
  useEffect(() => {
    if (!companyId) return;
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.COMPANIES, companyId),
      (snap) => { if (snap.exists()) setCompany({ id: snap.id, ...snap.data() }); }
    );
    return () => unsub();
  }, [companyId]);

  // Fetch agents + this month's calls
  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      // Month start timestamp
      const now        = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthTs    = Timestamp.fromDate(monthStart);

      // Fetch agents
      const agentsSnap = await getDocs(query(
        collection(db, COLLECTIONS.USERS),
        where("companyId", "==", companyId),
        where("role",      "in", ["agent", "manager"])
      ));
      setAgents(agentsSnap.docs.map((d) => ({ uid: d.id, ...d.data() })));

      // Fetch this month's calls
      const callsSnap = await getDocs(query(
        collection(db, COLLECTIONS.CALLS),
        where("companyId",   "==", companyId),
        where("initiatedAt", ">=", monthTs),
        where("status",      "==", "terminated")
      ));
      const calls = callsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCallData(calls);
      setRecCount(calls.filter((c) => c.recordingUrl).length);
      setAiCount(calls.filter((c) => c.aiSummary).length);

    } catch (err) {
      console.error("UsagePage fetchData error:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const plan             = company?.plan || "starter";
  const planInfo         = PLANS[plan] || PLANS.starter;
  const storageLimitGB   = company?.storage?.limitGB  || planInfo.storageGB || 5;
  const storageUsedGB    = company?.storage?.usedGB   || 0;
  const minutesThisMonth = company?.minutesUsedThisMonth || 0;
  const totalCallCost    = minutesThisMonth * 1.00;

  const totalCalls       = callData.length;
  const totalDurationSec = callData.reduce((s, c) => s + (c.duration || 0), 0);
  const totalMinutes     = Math.ceil(totalDurationSec / 60);

  // ── CSV Export ─────────────────────────────────────────────────────────────

  const handleExportCSV = useCallback(async () => {
    setExporting(true);
    try {
      // Per-agent aggregation
      const agentMap = {};
      agents.forEach((a) => { agentMap[a.uid] = { name: a.displayName || "Unknown", calls: 0, minutes: 0, cost: 0 }; });
      callData.forEach((call) => {
        if (!agentMap[call.agentId]) agentMap[call.agentId] = { name: "Unknown", calls: 0, minutes: 0, cost: 0 };
        const mins = Math.ceil((call.duration || 0) / 60);
        agentMap[call.agentId].calls   += 1;
        agentMap[call.agentId].minutes += mins;
        agentMap[call.agentId].cost    += mins;
      });

      const now   = new Date();
      const month = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

      const rows = [
        ["TIRAS CRM — Usage Report"],
        [`Company: ${company?.name || ""}`],
        [`Period: ${month}`],
        [`Exported: ${now.toLocaleString("en-IN")}`],
        [],
        ["Agent", "Calls Made", "Minutes", "Cost (₹1/min)"],
        ...Object.values(agentMap).map((a) => [a.name, a.calls, a.minutes, a.cost.toFixed(2)]),
        [],
        ["TOTAL", totalCalls, totalMinutes, totalCallCost.toFixed(2)],
        [],
        ["Storage Used (GB)", storageUsedGB.toFixed(2)],
        ["Storage Limit (GB)", storageLimitGB],
        ["Recordings This Month", recCount],
        ["AI Summaries Generated", aiCount],
      ];

      const csv  = rows.map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `TIRAS_Usage_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("UsagePage export error:", err);
    } finally {
      setExporting(false);
    }
  }, [agents, callData, company, totalCalls, totalMinutes, totalCallCost, storageUsedGB, storageLimitGB, recCount, aiCount]);

  return (
    <div style={{ minHeight: "calc(100vh - 56px)", backgroundColor: COLORS.background, padding: SPACING.xl, fontFamily: FONTS.body }}>
      <div style={{ maxWidth: "960px", margin: "0 auto", animation: "u-fade 0.35s ease" }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: SPACING.base, marginBottom: SPACING["2xl"] }}>
          <div>
            <h1 style={{ fontFamily: FONTS.heading, fontSize: "22px", fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>Usage</h1>
            <p style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: SPACING.xs }}>
              {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })} · Plan: <span style={{ color: COLORS.primary, fontWeight: 600, textTransform: "capitalize" }}>{plan}</span>
            </p>
          </div>
          <button
            className="u-export-btn"
            onClick={handleExportCSV}
            disabled={exporting || loading}
            style={{ ...STYLES.buttonSecondary, transition: "all 0.2s ease", opacity: exporting ? 0.6 : 1 }}
          >
            {exporting ? "Exporting…" : "⬇ Export CSV"}
          </button>
        </div>

        {/* ── Stat cards grid ──────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: SPACING.base, marginBottom: SPACING.xl }}>
          <StatCard icon="📞" label="Calls This Month"    value={loading ? "…" : totalCalls.toLocaleString("en-IN")}    color={COLORS.info}    loading={loading} />
          <StatCard icon="⏱️" label="Minutes Used"        value={loading ? "…" : minutesThisMonth.toLocaleString("en-IN")} sub="60-sec pulse billing" color={COLORS.primary} loading={loading} />
          <StatCard icon="💸" label="Call Cost"           value={loading ? "…" : formatINR(totalCallCost)}              color={COLORS.warning} loading={loading} />
          <StatCard icon="🎙️" label="Recordings"          value={loading ? "…" : recCount.toLocaleString("en-IN")}       color={COLORS.success} loading={loading} />
          <StatCard icon="🤖" label="AI Summaries"        value={loading ? "…" : aiCount.toLocaleString("en-IN")}        color={COLORS.purple}  loading={loading} />
        </div>

        {/* ── Storage usage ────────────────────────────────────────────────── */}
        <div style={{ ...STYLES.card, marginBottom: SPACING.xl }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.lg, flexWrap: "wrap", gap: SPACING.sm }}>
            <h3 style={{ fontFamily: FONTS.heading, fontSize: "16px", fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>
              Storage
            </h3>
            <span style={{
              fontFamily: FONTS.body, fontSize: FONTS.size.xs, fontWeight: 600,
              padding: "3px 10px", borderRadius: RADIUS.full,
              backgroundColor: COLORS.primaryMuted, color: COLORS.primary,
            }}>
              {planInfo.name} Plan — {storageLimitGB}GB
            </span>
          </div>

          <ProgressBar
            used={parseFloat(storageUsedGB.toFixed(2))}
            total={storageLimitGB}
            unit="GB"
            label="Call Recordings Storage"
            color={COLORS.primary}
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: SPACING.base, marginTop: SPACING.xl }}>
            {[
              { label: "Used",      value: `${storageUsedGB.toFixed(2)} GB`,        color: COLORS.primary },
              { label: "Available", value: `${Math.max(storageLimitGB - storageUsedGB, 0).toFixed(2)} GB`, color: COLORS.success },
              { label: "Limit",     value: `${storageLimitGB} GB`,                  color: COLORS.textSecondary },
              { label: "Retention", value: `${planInfo.retentionDays} days`,         color: COLORS.info },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: FONTS.mono, fontSize: FONTS.size.xl, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Storage upgrade hint when > 80% */}
          {storageUsedGB / storageLimitGB >= 0.8 && (
            <div style={{ marginTop: SPACING.lg, padding: SPACING.base, backgroundColor: COLORS.warningMuted, border: `1px solid ${COLORS.warning}30`, borderRadius: RADIUS.md, fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.warning }}>
              ⚠️ Storage is over 80% full. Old recordings are auto-deleted after {planInfo.retentionDays} days. Upgrade your plan or add storage for longer retention.
            </div>
          )}
        </div>

        {/* ── Calling minutes bar ───────────────────────────────────────────── */}
        <div style={{ ...STYLES.card, marginBottom: SPACING.xl }}>
          <h3 style={{ fontFamily: FONTS.heading, fontSize: "16px", fontWeight: 700, color: COLORS.textPrimary, margin: `0 0 ${SPACING.lg}` }}>
            Calling Minutes — This Month
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: SPACING.lg, flexWrap: "wrap", marginBottom: SPACING.base }}>
            <div style={{ fontFamily: FONTS.heading, fontSize: "36px", fontWeight: 700, color: COLORS.primary }}>
              {minutesThisMonth.toLocaleString("en-IN")}
            </div>
            <div>
              <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.base, color: COLORS.textPrimary, fontWeight: 600 }}>minutes used</div>
              <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textMuted }}>Total cost: {formatINR(totalCallCost)}</div>
            </div>
          </div>

          {/* Daily usage hint */}
          <div style={{ padding: SPACING.base, backgroundColor: COLORS.primaryMuted, border: `1px solid ${COLORS.primary}20`, borderRadius: RADIUS.md }}>
            <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.sm, color: COLORS.textSecondary, lineHeight: 1.6 }}>
              💡 Calling is billed at <strong style={{ color: COLORS.primary }}>₹1 per minute</strong> using 60-second pulse billing. A 61-second call = 2 minutes = ₹2 deducted from wallet. Calls are blocked when wallet balance falls below ₹5.
            </div>
          </div>
        </div>

        {/* ── Agent breakdown ───────────────────────────────────────────────── */}
        <AgentBreakdown agents={agents} callData={callData} loading={loading} />

        {/* ── Plan limits summary ───────────────────────────────────────────── */}
        <div style={{ ...STYLES.card, marginTop: SPACING.xl }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.base, flexWrap: "wrap", gap: SPACING.sm }}>
            <h3 style={{ fontFamily: FONTS.heading, fontSize: "16px", fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>
              Plan Limits — {planInfo.name}
            </h3>
            <button
              onClick={() => navigate("/subscribe")}
              style={{ ...STYLES.buttonSecondary, fontSize: FONTS.size.sm, minHeight: "36px", padding: `${SPACING.xs} ${SPACING.base}` }}
            >
              Upgrade Plan →
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: SPACING.base }}>
            {[
              { label: "Max Agents",    value: planInfo.agents   ? planInfo.agents.toLocaleString("en-IN")   : "Unlimited" },
              { label: "Max Managers",  value: planInfo.managers ? planInfo.managers.toLocaleString("en-IN") : "Unlimited" },
              { label: "Storage",       value: `${planInfo.storageGB || "Custom"} GB` },
              { label: "Recording Retention", value: `${planInfo.retentionDays} days` },
              { label: "Active Agents", value: loading ? "…" : agents.filter((a) => a.role === "agent").length },
              { label: "Active Managers", value: loading ? "…" : agents.filter((a) => a.role === "manager").length },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: SPACING.md, backgroundColor: COLORS.background, borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}` }}>
                <div style={{ fontFamily: FONTS.body, fontSize: FONTS.size.xs, color: COLORS.textMuted, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                <div style={{ fontFamily: FONTS.mono, fontSize: FONTS.size.lg, fontWeight: 700, color: COLORS.textPrimary }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsagePage;
