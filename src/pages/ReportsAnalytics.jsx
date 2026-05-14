// TIRAS CRM — ReportsAnalytics.jsx
// Company Admin — 4 pre-built reports: calls per agent, leads per stage,
// conversion by source, follow-up completion rate. Date range filter. CSV export.
//
// USAGE: In src/pages/index.js replace:
//   export const ReportsAnalytics = () => <Placeholder name="Reports & Analytics" />;
// with:
//   export { ReportsAnalytics } from "./ReportsAnalytics";

import React, { useState, useCallback } from "react";
import {
  collection, query, where, getDocs, Timestamp, orderBy,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS, STYLES, TRANSITIONS,
} from "../theme";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import {
  RiBarChartBoxLine, RiPieChartLine, RiLoader4Line,
  RiDownloadLine, RiCalendarLine, RiRefreshLine,
  RiPhoneLine, RiFundsLine, RiPercentLine, RiCheckboxCircleLine,
} from "react-icons/ri";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const downloadCSV = (filename, rows) => {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ─── Chart tooltip ────────────────────────────────────────────────────────────

const ChartTip = ({ active, payload, label, unit = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: COLORS.surfaceActive,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.md, padding: `${SPACING.sm} ${SPACING.md}`,
      boxShadow: SHADOWS.md,
    }}>
      <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.primary }}>
        {payload[0].value}{unit}
      </div>
    </div>
  );
};

// ─── Report Card wrapper ──────────────────────────────────────────────────────

const ReportCard = ({ icon: Icon, title, subtitle, onExport, exportLabel = "Export CSV", loading, children }) => (
  <div style={{ ...STYLES.card }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: SPACING.lg, flexWrap: "wrap", gap: SPACING.sm }}>
      <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm }}>
        <div style={{ width: "36px", height: "36px", borderRadius: RADIUS.md, backgroundColor: COLORS.primaryMuted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={18} color={COLORS.primary} />
        </div>
        <div>
          <div style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>{title}</div>
          {subtitle && <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: "2px" }}>{subtitle}</div>}
        </div>
      </div>
      {onExport && (
        <button
          onClick={onExport}
          disabled={loading}
          style={{ ...STYLES.buttonSecondary, display: "flex", alignItems: "center", gap: SPACING.xs, padding: `${SPACING.xs} ${SPACING.md}`, fontSize: FONTS.size.sm, opacity: loading ? 0.4 : 1 }}
        >
          <RiDownloadLine size={13} /> {exportLabel}
        </button>
      )}
    </div>

    {loading ? (
      <div style={{ height: "240px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <RiLoader4Line size={26} color={COLORS.textMuted} style={{ animation: "tirasSpinKf 1s linear infinite" }} />
      </div>
    ) : children}
  </div>
);

// ─── Stage colours for pie/bar ────────────────────────────────────────────────

const STAGE_COLORS_LIST = [
  COLORS.info, COLORS.primary, COLORS.accent, COLORS.warning,
  "#9B59B6", COLORS.success, COLORS.danger,
];

// ─── ReportsAnalytics ─────────────────────────────────────────────────────────

export const ReportsAnalytics = () => {
  const { companyId } = useAuth();

  // Date range — default: last 30 days
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 29);

  const [fromDate, setFromDate] = useState(defaultFrom.toISOString().split("T")[0]);
  const [toDate,   setToDate]   = useState(today.toISOString().split("T")[0]);
  const [loading,  setLoading]  = useState(false);
  const [ran,      setRan]      = useState(false);

  // Report data
  const [callsPerAgent,    setCallsPerAgent]    = useState([]);
  const [leadsPerStage,    setLeadsPerStage]    = useState([]);
  const [convBySource,     setConvBySource]     = useState([]);
  const [followUpRate,     setFollowUpRate]     = useState({ completed: 0, total: 0, pct: 0 });

  const generate = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
      const to   = new Date(toDate);   to.setHours(23, 59, 59, 999);
      const fromTs = Timestamp.fromDate(from);
      const toTs   = Timestamp.fromDate(to);

      // ── 1. Calls per agent ──────────────────────────────────────────────
      const callsSnap = await getDocs(query(
        collection(db, COLLECTIONS.CALLS),
        where("companyId", "==", companyId),
        where("createdAt", ">=", fromTs),
        where("createdAt", "<=", toTs),
      ));
      const agentMap = {};
      callsSnap.forEach(d => {
        const { agentName = "Unknown", agentId } = d.data();
        const key = agentId || agentName;
        if (!agentMap[key]) agentMap[key] = { name: agentName, calls: 0 };
        agentMap[key].calls++;
      });
      setCallsPerAgent(
        Object.values(agentMap)
          .sort((a, b) => b.calls - a.calls)
          .slice(0, 10)
          .map(a => ({ name: a.name.split(" ")[0], calls: a.calls }))
      );

      // ── 2. Leads per stage (all-time for this company) ──────────────────
      const leadsSnap = await getDocs(query(
        collection(db, COLLECTIONS.LEADS),
        where("companyId", "==", companyId),
      ));
      const stageMap = {};
      leadsSnap.forEach(d => {
        const s = d.data().stage || "Unknown";
        stageMap[s] = (stageMap[s] || 0) + 1;
      });
      setLeadsPerStage(
        Object.entries(stageMap)
          .sort((a, b) => b[1] - a[1])
          .map(([stage, count]) => ({ stage, count }))
      );

      // ── 3. Conversion rate by source ────────────────────────────────────
      const rangeLeadsSnap = await getDocs(query(
        collection(db, COLLECTIONS.LEADS),
        where("companyId", "==", companyId),
        where("createdAt", ">=", fromTs),
        where("createdAt", "<=", toTs),
      ));
      const sourceMap = {}; // source → { total, closed }
      rangeLeadsSnap.forEach(d => {
        const { source = "Unknown", stage } = d.data();
        if (!sourceMap[source]) sourceMap[source] = { total: 0, closed: 0 };
        sourceMap[source].total++;
        if (stage === "Closed Won") sourceMap[source].closed++;
      });
      setConvBySource(
        Object.entries(sourceMap)
          .filter(([, v]) => v.total >= 1)
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 8)
          .map(([source, { total, closed }]) => ({
            source,
            rate: total > 0 ? Math.round((closed / total) * 100) : 0,
            total,
          }))
      );

      // ── 4. Follow-up completion rate ─────────────────────────────────────
      const fupSnap = await getDocs(query(
        collection(db, COLLECTIONS.FOLLOW_UPS),
        where("companyId", "==", companyId),
        where("dueAt", ">=", fromTs),
        where("dueAt", "<=", toTs),
      ));
      let fuTotal = 0, fuDone = 0;
      fupSnap.forEach(d => {
        fuTotal++;
        if (d.data().status === "completed") fuDone++;
      });
      setFollowUpRate({
        completed: fuDone, total: fuTotal,
        pct: fuTotal > 0 ? Math.round((fuDone / fuTotal) * 100) : 0,
      });

    } catch (err) {
      console.error("ReportsAnalytics: generate error:", err);
    } finally {
      setLoading(false);
      setRan(true);
    }
  }, [companyId, fromDate, toDate]);

  // ── Exports ──────────────────────────────────────────────────────────────
  const exportCallsPerAgent = () => downloadCSV("calls-per-agent.csv", [
    ["Agent", "Calls"],
    ...callsPerAgent.map(r => [r.name, r.calls]),
  ]);

  const exportLeadsPerStage = () => downloadCSV("leads-per-stage.csv", [
    ["Stage", "Leads"],
    ...leadsPerStage.map(r => [r.stage, r.count]),
  ]);

  const exportConvBySource = () => downloadCSV("conversion-by-source.csv", [
    ["Source", "Conversion Rate (%)", "Total Leads"],
    ...convBySource.map(r => [r.source, r.rate, r.total]),
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      backgroundColor: COLORS.background, minHeight: "calc(100vh - 60px)",
      padding: `${SPACING["2xl"]} ${SPACING["2xl"]}`,
      fontFamily: FONTS.family, boxSizing: "border-box",
    }}>
      <style>{`
        @keyframes tirasSpinKf { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        select option { background: ${COLORS.surface}; color: ${COLORS.textPrimary}; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: SPACING.xl }}>
        <h1 style={{ margin: 0, fontSize: FONTS.size["4xl"], fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, letterSpacing: "-0.5px" }}>
          Reports & Analytics
        </h1>
        <p style={{ margin: `${SPACING.xs} 0 0`, fontSize: FONTS.size.base, color: COLORS.textSecondary }}>
          Pre-built reports for calls, leads, conversion, and follow-ups.
        </p>
      </div>

      {/* Date range + Generate */}
      <div style={{
        backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.lg, padding: SPACING.lg,
        display: "flex", alignItems: "center", gap: SPACING.base,
        flexWrap: "wrap", marginBottom: SPACING["2xl"],
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: SPACING.xs, color: COLORS.textSecondary, fontSize: FONTS.size.sm, flexShrink: 0 }}>
          <RiCalendarLine size={16} />
          Date Range
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" }}>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            style={{ ...STYLES.input, width: "150px" }} />
          <span style={{ color: COLORS.textSecondary, fontSize: FONTS.size.sm }}>to</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            style={{ ...STYLES.input, width: "150px" }} />
        </div>

        {/* Quick range buttons */}
        <div style={{ display: "flex", gap: SPACING.xs }}>
          {[
            { label: "7d",  days: 7 },
            { label: "30d", days: 30 },
            { label: "90d", days: 90 },
          ].map(({ label, days }) => (
            <button
              key={label}
              onClick={() => {
                const t = new Date();
                const f = new Date(t);
                f.setDate(f.getDate() - (days - 1));
                setFromDate(f.toISOString().split("T")[0]);
                setToDate(t.toISOString().split("T")[0]);
              }}
              style={{
                ...STYLES.buttonSecondary,
                padding: `${SPACING.xs} ${SPACING.sm}`,
                fontSize: FONTS.size.xs,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={generate}
          disabled={loading}
          style={{
            ...STYLES.buttonPrimary,
            display: "flex", alignItems: "center", gap: SPACING.xs,
            marginLeft: "auto",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading
            ? <><RiLoader4Line size={15} style={{ animation: "tirasSpinKf 0.7s linear infinite" }} /> Generating…</>
            : <><RiRefreshLine size={15} /> Generate Reports</>
          }
        </button>
      </div>

      {/* Prompt before first run */}
      {!ran && !loading && (
        <div style={{ textAlign: "center", padding: `${SPACING["5xl"]} 0` }}>
          <RiBarChartBoxLine size={48} color={COLORS.textMuted} style={{ marginBottom: SPACING.base }} />
          <div style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary, marginBottom: SPACING.xs }}>
            Select a date range and generate reports
          </div>
          <div style={{ fontSize: FONTS.size.base, color: COLORS.textSecondary }}>
            Reports are generated on demand — click "Generate Reports" above.
          </div>
        </div>
      )}

      {/* 2-column grid */}
      {(ran || loading) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SPACING.base }}>

          {/* ── Report 1: Calls Per Agent ──────────────────────────────── */}
          <ReportCard
            icon={RiPhoneLine}
            title="Calls Per Agent"
            subtitle="Top callers in the selected period"
            loading={loading}
            onExport={callsPerAgent.length ? exportCallsPerAgent : undefined}
          >
            {callsPerAgent.length === 0 ? (
              <div style={{ textAlign: "center", padding: SPACING.xl, color: COLORS.textMuted, fontSize: FONTS.size.sm }}>No call data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={callsPerAgent} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={28}>
                  <CartesianGrid strokeDasharray="2 4" stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: COLORS.textSecondary, fontSize: 11 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                  <YAxis tick={{ fill: COLORS.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: COLORS.surfaceHover }} />
                  <Bar dataKey="calls" radius={[4, 4, 0, 0]}>
                    {callsPerAgent.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? COLORS.primary : COLORS.primaryDark} opacity={i === 0 ? 1 : 0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ReportCard>

          {/* ── Report 2: Leads Per Stage ──────────────────────────────── */}
          <ReportCard
            icon={RiFundsLine}
            title="Leads Per Stage"
            subtitle="Current distribution across pipeline stages"
            loading={loading}
            onExport={leadsPerStage.length ? exportLeadsPerStage : undefined}
          >
            {leadsPerStage.length === 0 ? (
              <div style={{ textAlign: "center", padding: SPACING.xl, color: COLORS.textMuted, fontSize: FONTS.size.sm }}>No lead data found</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={leadsPerStage}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                  barSize={18}
                >
                  <CartesianGrid strokeDasharray="2 4" stroke={COLORS.border} horizontal={false} />
                  <XAxis type="number" tick={{ fill: COLORS.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="stage" type="category" tick={{ fill: COLORS.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: COLORS.surfaceHover }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {leadsPerStage.map((_, i) => (
                      <Cell key={i} fill={STAGE_COLORS_LIST[i % STAGE_COLORS_LIST.length]} opacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ReportCard>

          {/* ── Report 3: Conversion by Source ────────────────────────── */}
          <ReportCard
            icon={RiPercentLine}
            title="Conversion Rate by Source"
            subtitle="% of leads converted per acquisition channel"
            loading={loading}
            onExport={convBySource.length ? exportConvBySource : undefined}
          >
            {convBySource.length === 0 ? (
              <div style={{ textAlign: "center", padding: SPACING.xl, color: COLORS.textMuted, fontSize: FONTS.size.sm }}>No conversion data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={convBySource} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={28}>
                  <CartesianGrid strokeDasharray="2 4" stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="source" tick={{ fill: COLORS.textSecondary, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                  <YAxis tick={{ fill: COLORS.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                  <Tooltip content={<ChartTip unit="%" />} cursor={{ fill: COLORS.surfaceHover }} />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                    {convBySource.map((entry, i) => (
                      <Cell key={i}
                        fill={entry.rate >= 30 ? COLORS.success : entry.rate >= 15 ? COLORS.accent : COLORS.primary}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ReportCard>

          {/* ── Report 4: Follow-up Completion Rate ───────────────────── */}
          <ReportCard
            icon={RiCheckboxCircleLine}
            title="Follow-up Completion Rate"
            subtitle="Scheduled follow-ups completed on time"
            loading={loading}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "240px", gap: SPACING.xl }}>
              {/* Big number */}
              <div style={{ textAlign: "center" }}>
                <div style={{
                  fontSize: "64px", fontWeight: FONTS.weight.bold,
                  color: followUpRate.pct >= 70 ? COLORS.success : followUpRate.pct >= 40 ? COLORS.warning : COLORS.danger,
                  lineHeight: 1, letterSpacing: "-2px",
                }}>
                  {followUpRate.pct}%
                </div>
                <div style={{ fontSize: FONTS.size.base, color: COLORS.textSecondary, marginTop: SPACING.sm }}>
                  {followUpRate.completed} of {followUpRate.total} follow-ups completed
                </div>
              </div>

              {/* Progress bar */}
              {followUpRate.total > 0 && (
                <div style={{ width: "100%", maxWidth: "320px" }}>
                  <div style={{ height: "8px", backgroundColor: COLORS.surfaceActive, borderRadius: RADIUS.full, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: RADIUS.full,
                      width: `${followUpRate.pct}%`,
                      backgroundColor: followUpRate.pct >= 70 ? COLORS.success : followUpRate.pct >= 40 ? COLORS.warning : COLORS.danger,
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: SPACING.xs }}>
                    <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>0%</span>
                    <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>Target: 80%</span>
                    <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>100%</span>
                  </div>
                </div>
              )}

              {followUpRate.total === 0 && (
                <div style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted }}>
                  No follow-ups scheduled in this period
                </div>
              )}
            </div>
          </ReportCard>
        </div>
      )}
    </div>
  );
};
