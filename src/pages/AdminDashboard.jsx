// TIRAS CRM — AdminDashboard.jsx
// God View Dashboard — Company Admin's command center
// Shows: total leads, calls today, conversion rate, best agent, overdue follow-ups,
//        open tickets, pipeline value, calls-per-day bar chart (last 7 days)
//
// USAGE:
//   1. Drop this file into src/pages/AdminDashboard.jsx
//   2. In src/pages/index.js, replace:
//        export const AdminDashboard = () => <Placeholder name="God View Dashboard" />;
//      with:
//        export { AdminDashboard } from "./AdminDashboard";

import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db, COLLECTIONS } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  SHADOWS,
  STYLES,
  TRANSITIONS,
} from "../theme";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  RiUserLine,
  RiPhoneLine,
  RiBarChartBoxLine,
  RiTrophyLine,
  RiAlertLine,
  RiCustomerServiceLine,
  RiRefreshLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiMoneyDollarCircleLine,
  RiLoader4Line,
  RiTeamLine,
  RiCheckboxCircleLine,
} from "react-icons/ri";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Format a number as Indian rupees — 1,10,000 → ₹1.1L */
const formatINR = (amount) => {
  if (!amount || amount === 0) return "₹0";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
};

/** Relative time — "3m ago", "Just now" */
const formatRelativeTime = (date) => {
  if (!date) return "—";
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 10) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
};

// ─── StatCard ────────────────────────────────────────────────────────────────
// Individual metric tile. Supports alert state (red glow strip), comparison line,
// and a loading skeleton state.

const StatCard = ({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  subValue,
  subColor,
  subIcon: SubIcon,
  alert = false,
  loading = false,
  onClick,
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: hovered && onClick ? COLORS.surfaceHover : COLORS.surface,
        border: `1px solid ${alert ? COLORS.danger + "55" : COLORS.border}`,
        borderRadius: RADIUS.lg,
        padding: SPACING.xl,
        cursor: onClick ? "pointer" : "default",
        transition: TRANSITIONS.base,
        boxShadow: alert
          ? `0 0 0 1px ${COLORS.danger}30, ${SHADOWS.sm}`
          : SHADOWS.sm,
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Alert accent strip at top */}
      {alert && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "2px",
            backgroundColor: COLORS.danger,
            borderRadius: `${RADIUS.lg} ${RADIUS.lg} 0 0`,
          }}
        />
      )}

      {/* Icon + Spinner row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: SPACING.base,
        }}
      >
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: RADIUS.md,
            backgroundColor: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={20} color={iconColor} />
        </div>

        {loading && (
          <RiLoader4Line
            size={15}
            color={COLORS.textMuted}
            style={{ animation: "tirasSpinKf 1s linear infinite" }}
          />
        )}
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: loading ? FONTS.size.xl : FONTS.size["4xl"],
          fontWeight: FONTS.weight.bold,
          color: loading ? COLORS.textMuted : COLORS.textPrimary,
          lineHeight: 1.1,
          marginBottom: "4px",
          transition: TRANSITIONS.base,
          letterSpacing: "-0.5px",
        }}
      >
        {loading ? "—" : value}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: FONTS.size.sm,
          fontWeight: FONTS.weight.medium,
          color: COLORS.textSecondary,
          marginBottom: subValue && !loading ? "6px" : 0,
        }}
      >
        {label}
      </div>

      {/* Sub-value comparison row */}
      {subValue && !loading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3px",
            fontSize: FONTS.size.xs,
            color: subColor || COLORS.textMuted,
            fontWeight: FONTS.weight.medium,
          }}
        >
          {SubIcon && <SubIcon size={11} />}
          <span>{subValue}</span>
        </div>
      )}
    </div>
  );
};

// ─── Custom Recharts Tooltip ─────────────────────────────────────────────────

const BarChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        backgroundColor: COLORS.surfaceActive,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        padding: `${SPACING.sm} ${SPACING.md}`,
        boxShadow: SHADOWS.md,
        minWidth: "100px",
      }}
    >
      <div
        style={{
          fontSize: FONTS.size.xs,
          color: COLORS.textSecondary,
          marginBottom: "2px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: FONTS.size.xl,
          fontWeight: FONTS.weight.bold,
          color: COLORS.primary,
        }}
      >
        {payload[0].value}
      </div>
      <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
        calls made
      </div>
    </div>
  );
};

// ─── Section header ──────────────────────────────────────────────────────────

const SectionTitle = ({ title, subtitle }) => (
  <div style={{ marginBottom: SPACING.base }}>
    <div
      style={{
        fontSize: FONTS.size.lg,
        fontWeight: FONTS.weight.semibold,
        color: COLORS.textPrimary,
        lineHeight: 1.3,
      }}
    >
      {title}
    </div>
    {subtitle && (
      <div
        style={{
          fontSize: FONTS.size.sm,
          color: COLORS.textSecondary,
          marginTop: "3px",
        }}
      >
        {subtitle}
      </div>
    )}
  </div>
);

// ─── Inline data row for the quick-stats panel ───────────────────────────────

const QuickRow = ({ label, value, valueColor }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: `${SPACING.xs} 0`,
      borderBottom: `1px solid ${COLORS.border}`,
    }}
  >
    <span style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>
      {label}
    </span>
    <span
      style={{
        fontSize: FONTS.size.base,
        fontWeight: FONTS.weight.semibold,
        color: valueColor || COLORS.textPrimary,
      }}
    >
      {value}
    </span>
  </div>
);

// ─── AdminDashboard ──────────────────────────────────────────────────────────

export const AdminDashboard = () => {
  const { companyId, userProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [stats, setStats] = useState({
    totalLeads: 0,
    callsToday: 0,
    callsYesterday: 0,
    conversionRate: 0,
    closedWonCount: 0,
    monthLeadCount: 0,
    bestAgent: null, // { name, calls }
    overdueFollowUps: 0,
    openTickets: 0,
    pipelineValue: 0,
    weeklyCallData: [], // [{ day, calls }]
    weeklyTotal: 0,
  });

  // ── Data Loader ────────────────────────────────────────────────────────────
  const loadDashboardData = useCallback(async () => {
    if (!companyId) return;

    try {
      const now = new Date();

      // Boundary dates
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      // 6 days back so today is the 7th day
      const sevenDaysAgo = new Date(todayStart);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // ── 1. All leads for this company (total count + pipeline value) ─────
      const leadsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.LEADS),
          where("companyId", "==", companyId)
        )
      );
      let totalLeads = leadsSnap.size;
      let pipelineValue = 0;
      leadsSnap.forEach((doc) => {
        const d = doc.data();
        if (typeof d.dealValue === "number") pipelineValue += d.dealValue;
      });

      // ── 2. Month's leads for conversion rate ─────────────────────────────
      const monthLeadsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.LEADS),
          where("companyId", "==", companyId),
          where("createdAt", ">=", Timestamp.fromDate(monthStart))
        )
      );
      let monthLeadCount = monthLeadsSnap.size;
      let closedWonCount = 0;
      monthLeadsSnap.forEach((doc) => {
        if (doc.data().stage === "Closed Won") closedWonCount++;
      });
      const conversionRate =
        monthLeadCount > 0
          ? Math.round((closedWonCount / monthLeadCount) * 100)
          : 0;

      // ── 3. Calls — last 7 days (includes today) ──────────────────────────
      const callsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.CALLS),
          where("companyId", "==", companyId),
          where("createdAt", ">=", Timestamp.fromDate(sevenDaysAgo))
        )
      );

      // Build the 7-day date map (keys: "YYYY-MM-DD")
      const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dailyMap = {}; // key → { dayLabel, count }
      for (let i = 6; i >= 0; i--) {
        const d = new Date(todayStart);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        dailyMap[key] = {
          dayLabel: i === 0 ? "Today" : DAY_NAMES[d.getDay()],
          count: 0,
        };
      }

      let callsToday = 0;
      let callsYesterday = 0;
      const agentMap = {}; // agentId → { name, count }

      callsSnap.forEach((doc) => {
        const call = doc.data();
        const ts = call.createdAt?.toDate();
        if (!ts) return;

        // Weekly map
        const key = ts.toISOString().split("T")[0];
        if (dailyMap[key]) dailyMap[key].count++;

        // Today / yesterday split
        if (ts >= todayStart) {
          callsToday++;
          const id = call.agentId;
          if (id) {
            if (!agentMap[id])
              agentMap[id] = { name: call.agentName || "Agent", count: 0 };
            agentMap[id].count++;
          }
        } else if (ts >= yesterdayStart && ts < todayStart) {
          callsYesterday++;
        }
      });

      // Best agent today
      let bestAgent = null;
      let topCount = 0;
      Object.entries(agentMap).forEach(([, data]) => {
        if (data.count > topCount) {
          topCount = data.count;
          bestAgent = { name: data.name, calls: data.count };
        }
      });

      // Weekly chart array (oldest first)
      const weeklyCallData = Object.values(dailyMap).map(({ dayLabel, count }) => ({
        day: dayLabel,
        calls: count,
      }));
      const weeklyTotal = weeklyCallData.reduce((s, d) => s + d.calls, 0);

      // ── 4. Overdue follow-ups ─────────────────────────────────────────────
      // Fetch past-due follow-ups, then filter out "completed" in JS to avoid
      // a Firestore double-inequality restriction.
      const fupSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.FOLLOW_UPS),
          where("companyId", "==", companyId),
          where("dueAt", "<", Timestamp.fromDate(now))
        )
      );
      let overdueFollowUps = 0;
      fupSnap.forEach((doc) => {
        if (doc.data().status !== "completed") overdueFollowUps++;
      });

      // ── 5. Open support tickets ───────────────────────────────────────────
      const ticketsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.TICKETS),
          where("companyId", "==", companyId),
          where("status", "in", ["open", "assigned", "in_progress"])
        )
      );
      const openTickets = ticketsSnap.size;

      // ── Commit to state ───────────────────────────────────────────────────
      setStats({
        totalLeads,
        callsToday,
        callsYesterday,
        conversionRate,
        closedWonCount,
        monthLeadCount,
        bestAgent,
        overdueFollowUps,
        openTickets,
        pipelineValue,
        weeklyCallData,
        weeklyTotal,
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error("TIRAS AdminDashboard — loadDashboardData error:", err);
    }
  }, [companyId]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    loadDashboardData().finally(() => setLoading(false));
  }, [loadDashboardData]);

  // Manual refresh
  const handleRefresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // ── Derived values ──────────────────────────────────────────────────────────
  const callsDiff = stats.callsToday - stats.callsYesterday;
  const callsUp = callsDiff >= 0;

  const firstName = userProfile?.displayName?.split(" ")[0] || "Admin";

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        backgroundColor: COLORS.background,
        minHeight: "calc(100vh - 60px)",
        padding: `${SPACING["2xl"]} ${SPACING["2xl"]}`,
        fontFamily: FONTS.family,
        boxSizing: "border-box",
      }}
    >
      {/* Spinner keyframe injected once */}
      <style>{`
        @keyframes tirasSpinKf {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: SPACING.base,
          marginBottom: SPACING["2xl"],
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: SPACING.sm,
              marginBottom: SPACING.xs,
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: COLORS.success,
                boxShadow: `0 0 6px ${COLORS.success}`,
              }}
            />
            <span
              style={{
                fontSize: FONTS.size.xs,
                fontWeight: FONTS.weight.semibold,
                color: COLORS.success,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Live
            </span>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: FONTS.size["5xl"],
              fontWeight: FONTS.weight.bold,
              color: COLORS.textPrimary,
              lineHeight: 1.1,
              letterSpacing: "-1px",
            }}
          >
            God View
          </h1>

          <p
            style={{
              margin: `${SPACING.xs} 0 0`,
              fontSize: FONTS.size.base,
              color: COLORS.textSecondary,
            }}
          >
            Welcome back, {firstName}. Here's everything at a glance.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: SPACING.md,
            flexShrink: 0,
          }}
        >
          {lastUpdated && !loading && (
            <span
              style={{
                fontSize: FONTS.size.xs,
                color: COLORS.textMuted,
              }}
            >
              {formatRelativeTime(lastUpdated)}
            </span>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            style={{
              ...STYLES.buttonSecondary,
              display: "flex",
              alignItems: "center",
              gap: SPACING.xs,
              padding: `${SPACING.sm} ${SPACING.md}`,
              opacity: refreshing || loading ? 0.4 : 1,
              cursor: refreshing || loading ? "not-allowed" : "pointer",
            }}
          >
            <RiRefreshLine
              size={15}
              style={{
                animation: refreshing
                  ? "tirasSpinKf 0.7s linear infinite"
                  : "none",
              }}
            />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── 6 Stat Cards ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: SPACING.base,
          marginBottom: SPACING["2xl"],
        }}
      >
        {/* 1 — Total Leads */}
        <StatCard
          icon={RiUserLine}
          iconColor={COLORS.info}
          iconBg={COLORS.infoMuted}
          label="Total Leads"
          value={stats.totalLeads.toLocaleString("en-IN")}
          subValue={`${formatINR(stats.pipelineValue)} pipeline value`}
          subColor={COLORS.textMuted}
          loading={loading}
        />

        {/* 2 — Calls Today */}
        <StatCard
          icon={RiPhoneLine}
          iconColor={COLORS.primary}
          iconBg={COLORS.primaryMuted}
          label="Calls Made Today"
          value={stats.callsToday.toLocaleString("en-IN")}
          subValue={
            stats.callsYesterday > 0
              ? `${Math.abs(callsDiff)} ${callsUp ? "more" : "fewer"} than yesterday`
              : "No calls yesterday"
          }
          subColor={
            callsDiff === 0
              ? COLORS.textMuted
              : callsUp
              ? COLORS.success
              : COLORS.danger
          }
          subIcon={
            callsDiff === 0 ? null : callsUp ? RiArrowUpLine : RiArrowDownLine
          }
          loading={loading}
        />

        {/* 3 — Conversion Rate */}
        <StatCard
          icon={RiBarChartBoxLine}
          iconColor={COLORS.success}
          iconBg={COLORS.successMuted}
          label="Conversion Rate (This Month)"
          value={`${stats.conversionRate}%`}
          subValue={`${stats.closedWonCount} of ${stats.monthLeadCount} leads closed`}
          subColor={COLORS.textMuted}
          loading={loading}
        />

        {/* 4 — Best Agent */}
        <StatCard
          icon={RiTrophyLine}
          iconColor={COLORS.accent}
          iconBg={COLORS.accentMuted}
          label="Top Caller Today"
          value={
            stats.bestAgent
              ? stats.bestAgent.name.split(" ")[0]
              : "—"
          }
          subValue={
            stats.bestAgent
              ? `${stats.bestAgent.calls} calls today`
              : "No calls logged yet"
          }
          subColor={stats.bestAgent ? COLORS.accent : COLORS.textMuted}
          loading={loading}
        />

        {/* 5 — Overdue Follow-ups */}
        <StatCard
          icon={RiAlertLine}
          iconColor={
            stats.overdueFollowUps > 0 ? COLORS.danger : COLORS.success
          }
          iconBg={
            stats.overdueFollowUps > 0
              ? COLORS.dangerMuted
              : COLORS.successMuted
          }
          label="Overdue Follow-ups"
          value={stats.overdueFollowUps.toLocaleString("en-IN")}
          subValue={
            stats.overdueFollowUps > 0
              ? "Action needed — agents are behind"
              : "All follow-ups on track"
          }
          subColor={
            stats.overdueFollowUps > 0 ? COLORS.danger : COLORS.success
          }
          subIcon={
            stats.overdueFollowUps === 0 ? RiCheckboxCircleLine : undefined
          }
          alert={stats.overdueFollowUps > 0}
          loading={loading}
        />

        {/* 6 — Open Tickets */}
        <StatCard
          icon={RiCustomerServiceLine}
          iconColor={
            stats.openTickets > 5 ? COLORS.warning : COLORS.info
          }
          iconBg={
            stats.openTickets > 5 ? COLORS.warningMuted : COLORS.infoMuted
          }
          label="Open Support Tickets"
          value={stats.openTickets.toLocaleString("en-IN")}
          subValue={
            stats.openTickets > 5
              ? "High volume — escalate to support team"
              : stats.openTickets > 0
              ? "Being handled"
              : "No open tickets"
          }
          subColor={
            stats.openTickets > 5
              ? COLORS.warning
              : stats.openTickets > 0
              ? COLORS.textMuted
              : COLORS.success
          }
          subIcon={stats.openTickets === 0 ? RiCheckboxCircleLine : undefined}
          alert={stats.openTickets > 5}
          loading={loading}
        />
      </div>

      {/* ── Bottom Row: Chart + Side Panel ──────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: SPACING.base,
          alignItems: "start",
        }}
      >
        {/* ── Bar Chart Card ─────────────────────────────────────────────── */}
        <div style={{ ...STYLES.card }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: SPACING.lg,
              flexWrap: "wrap",
              gap: SPACING.sm,
            }}
          >
            <SectionTitle
              title="Calls Per Day — Last 7 Days"
              subtitle="Daily call volume across your entire team"
            />

            {!loading && (
              <div
                style={{
                  backgroundColor: COLORS.primaryMuted,
                  border: `1px solid ${COLORS.primary}30`,
                  borderRadius: RADIUS.full,
                  padding: `3px ${SPACING.md}`,
                  fontSize: FONTS.size.xs,
                  color: COLORS.primary,
                  fontWeight: FONTS.weight.semibold,
                  whiteSpace: "nowrap",
                }}
              >
                {stats.weeklyTotal} calls this week
              </div>
            )}
          </div>

          {loading ? (
            <div
              style={{
                height: "260px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: SPACING.sm,
              }}
            >
              <RiLoader4Line
                size={28}
                color={COLORS.textMuted}
                style={{ animation: "tirasSpinKf 1s linear infinite" }}
              />
              <span style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted }}>
                Loading chart…
              </span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={stats.weeklyCallData}
                margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
                barSize={34}
              >
                <CartesianGrid
                  strokeDasharray="2 4"
                  stroke={COLORS.border}
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{
                    fill: COLORS.textSecondary,
                    fontSize: 12,
                    fontFamily: FONTS.family,
                  }}
                  axisLine={{ stroke: COLORS.border }}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fill: COLORS.textSecondary,
                    fontSize: 12,
                    fontFamily: FONTS.family,
                  }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<BarChartTooltip />}
                  cursor={{ fill: COLORS.surfaceHover, radius: 4 }}
                />
                <Bar dataKey="calls" radius={[5, 5, 0, 0]}>
                  {stats.weeklyCallData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        entry.day === "Today"
                          ? COLORS.primary
                          : COLORS.primaryDark
                      }
                      opacity={entry.day === "Today" ? 1 : 0.65}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Chart legend */}
          {!loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: SPACING.lg,
                marginTop: SPACING.base,
                paddingTop: SPACING.base,
                borderTop: `1px solid ${COLORS.border}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "2px",
                    backgroundColor: COLORS.primary,
                  }}
                />
                <span
                  style={{
                    fontSize: FONTS.size.xs,
                    color: COLORS.textSecondary,
                  }}
                >
                  Today
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "2px",
                    backgroundColor: COLORS.primaryDark,
                    opacity: 0.65,
                  }}
                />
                <span
                  style={{
                    fontSize: FONTS.size.xs,
                    color: COLORS.textSecondary,
                  }}
                >
                  Previous days
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Side Panel ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: SPACING.base }}>

          {/* Pipeline Value Card */}
          <div
            style={{
              ...STYLES.card,
              background: `linear-gradient(145deg, ${COLORS.surface} 0%, ${COLORS.accentMuted} 100%)`,
              border: `1px solid ${COLORS.accent}25`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: SPACING.sm,
                marginBottom: SPACING.sm,
              }}
            >
              <RiMoneyDollarCircleLine size={17} color={COLORS.accent} />
              <span
                style={{
                  fontSize: FONTS.size.xs,
                  fontWeight: FONTS.weight.semibold,
                  color: COLORS.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Total Pipeline Value
              </span>
            </div>

            <div
              style={{
                fontSize: loading ? FONTS.size.xl : FONTS.size["3xl"],
                fontWeight: FONTS.weight.bold,
                color: loading ? COLORS.textMuted : COLORS.accent,
                letterSpacing: "-0.5px",
                lineHeight: 1.1,
                marginBottom: "4px",
              }}
            >
              {loading ? "—" : formatINR(stats.pipelineValue)}
            </div>

            <div
              style={{
                fontSize: FONTS.size.xs,
                color: COLORS.textMuted,
              }}
            >
              Combined deal value of all active leads
            </div>
          </div>

          {/* Quick Stats Card */}
          <div style={{ ...STYLES.card }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: SPACING.sm,
                marginBottom: SPACING.md,
              }}
            >
              <RiTeamLine size={17} color={COLORS.info} />
              <span
                style={{
                  fontSize: FONTS.size.xs,
                  fontWeight: FONTS.weight.semibold,
                  color: COLORS.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                At a Glance
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <QuickRow
                label="Calls made today"
                value={loading ? "—" : stats.callsToday}
                valueColor={COLORS.primary}
              />
              <QuickRow
                label="Calls yesterday"
                value={loading ? "—" : stats.callsYesterday}
                valueColor={COLORS.textSecondary}
              />
              <QuickRow
                label="Deals closed (month)"
                value={loading ? "—" : stats.closedWonCount}
                valueColor={COLORS.success}
              />
              <QuickRow
                label="Overdue follow-ups"
                value={loading ? "—" : stats.overdueFollowUps}
                valueColor={
                  stats.overdueFollowUps > 0 ? COLORS.danger : COLORS.success
                }
              />
              <QuickRow
                label="Open tickets"
                value={loading ? "—" : stats.openTickets}
                valueColor={
                  stats.openTickets > 5
                    ? COLORS.warning
                    : stats.openTickets > 0
                    ? COLORS.textSecondary
                    : COLORS.success
                }
              />
              {/* Last row — no bottom border */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: `${SPACING.xs} 0 0`,
                }}
              >
                <span
                  style={{
                    fontSize: FONTS.size.sm,
                    color: COLORS.textSecondary,
                  }}
                >
                  Calls this week
                </span>
                <span
                  style={{
                    fontSize: FONTS.size.base,
                    fontWeight: FONTS.weight.semibold,
                    color: COLORS.textPrimary,
                  }}
                >
                  {loading ? "—" : stats.weeklyTotal}
                </span>
              </div>
            </div>
          </div>

          {/* Best Agent Spotlight — only visible when data exists */}
          {!loading && stats.bestAgent && (
            <div
              style={{
                ...STYLES.card,
                background: `linear-gradient(135deg, ${COLORS.surface} 0%, ${COLORS.primaryMuted} 100%)`,
                border: `1px solid ${COLORS.primary}30`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: SPACING.sm,
                  marginBottom: SPACING.sm,
                }}
              >
                <RiTrophyLine size={15} color={COLORS.accent} />
                <span
                  style={{
                    fontSize: FONTS.size.xs,
                    fontWeight: FONTS.weight.semibold,
                    color: COLORS.accent,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Top Caller Today
                </span>
              </div>

              {/* Avatar initial + name */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: SPACING.md,
                }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "50%",
                    backgroundColor: COLORS.primaryMuted,
                    border: `2px solid ${COLORS.primary}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: FONTS.size.lg,
                    fontWeight: FONTS.weight.bold,
                    color: COLORS.primary,
                    flexShrink: 0,
                  }}
                >
                  {stats.bestAgent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: FONTS.size.md,
                      fontWeight: FONTS.weight.bold,
                      color: COLORS.textPrimary,
                      lineHeight: 1.2,
                    }}
                  >
                    {stats.bestAgent.name}
                  </div>
                  <div
                    style={{
                      fontSize: FONTS.size.sm,
                      color: COLORS.textSecondary,
                      marginTop: "2px",
                    }}
                  >
                    {stats.bestAgent.calls} calls completed today
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
