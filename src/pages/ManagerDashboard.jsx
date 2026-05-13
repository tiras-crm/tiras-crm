// TIRAS CRM — Manager Dashboard
// Manager sees only his agents' data — all queries scoped to managerId == currentUser.uid
// Recharts bar chart for weekly calls | Live stats | Agent call list | Overdue follow-ups

import React, { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
};

const startOfWeekAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Build last-7-days chart skeleton: { label, calls }
const buildWeekSkeleton = () => {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push({
      label: i === 0 ? "Today" : DAY_LABELS[d.getDay()],
      dateKey: d.toDateString(),
      calls: 0,
    });
  }
  return result;
};

const STAGE_COLORS = {
  New: COLORS.info,
  Contacted: "#7B68EE",
  Interested: COLORS.accent,
  "Follow-up": COLORS.warning,
  Negotiation: COLORS.primary,
  "Closed Won": COLORS.success,
  "Closed Lost": COLORS.danger,
};

const getStageColor = (stage) =>
  STAGE_COLORS[stage] || COLORS.textSecondary;

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub, color, icon }) => (
  <div
    style={{
      ...STYLES.card,
      padding: SPACING.xl,
      display: "flex",
      flexDirection: "column",
      gap: SPACING.xs,
      position: "relative",
      overflow: "hidden",
      flex: "1 1 200px",
    }}
  >
    {/* Subtle background glow */}
    <div
      style={{
        position: "absolute",
        top: "-20px",
        right: "-20px",
        width: "80px",
        height: "80px",
        borderRadius: "50%",
        backgroundColor: color + "18",
        pointerEvents: "none",
      }}
    />
    <div
      style={{
        fontSize: "22px",
        marginBottom: SPACING.xs,
      }}
    >
      {icon}
    </div>
    <div
      style={{
        fontSize: FONTS.size["4xl"],
        fontWeight: FONTS.weight.bold,
        color: color,
        lineHeight: 1,
      }}
    >
      {value}
    </div>
    <div
      style={{
        fontSize: FONTS.size.sm,
        fontWeight: FONTS.weight.semibold,
        color: COLORS.textPrimary,
        marginTop: SPACING.xs,
      }}
    >
      {label}
    </div>
    {sub && (
      <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
        {sub}
      </div>
    )}
  </div>
);

const SectionTitle = ({ title, count }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: SPACING.sm,
      marginBottom: SPACING.base,
    }}
  >
    <div
      style={{
        width: "3px",
        height: "18px",
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.full,
      }}
    />
    <span
      style={{
        fontSize: FONTS.size.base,
        fontWeight: FONTS.weight.semibold,
        color: COLORS.textPrimary,
      }}
    >
      {title}
    </span>
    {count !== undefined && (
      <span
        style={{
          ...STYLES.badge,
          backgroundColor: COLORS.primaryMuted,
          color: COLORS.primary,
          fontSize: FONTS.size.xs,
        }}
      >
        {count}
      </span>
    )}
  </div>
);

// Custom recharts tooltip
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        backgroundColor: "#1E1E1E",
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        padding: `${SPACING.sm} ${SPACING.base}`,
        boxShadow: SHADOWS.md,
      }}
    >
      <div
        style={{
          fontSize: FONTS.size.xs,
          color: COLORS.textMuted,
          marginBottom: "2px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: FONTS.size.lg,
          fontWeight: FONTS.weight.bold,
          color: COLORS.accent,
        }}
      >
        {payload[0].value} call{payload[0].value !== 1 ? "s" : ""}
      </div>
    </div>
  );
};

// Loading skeleton shimmer
const Shimmer = ({ width = "100%", height = "20px", radius = RADIUS.base }) => (
  <div
    style={{
      width,
      height,
      borderRadius: radius,
      background: `linear-gradient(90deg, ${COLORS.surface} 25%, #2a2a2a 50%, ${COLORS.surface} 75%)`,
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }}
  />
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const ManagerDashboard = () => {
  const { currentUser, companyId } = useAuth();

  // Raw data
  const [agents, setAgents] = useState([]);
  const [leads, setLeads] = useState([]);
  const [callsToday, setCallsToday] = useState([]);
  const [callsThisWeek, setCallsThisWeek] = useState([]);
  const [overdueFollowUps, setOverdueFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ─── Data fetch ─────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!currentUser?.uid || !companyId) return;

    try {
      setLoading(true);
      const uid = currentUser.uid;
      const todayTs = startOfToday();
      const weekAgoTs = startOfWeekAgo();
      const nowTs = Timestamp.now();

      // 1. Fetch agents under this manager
      const agentsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.USERS),
          where("managerId", "==", uid),
          where("companyId", "==", companyId)
        )
      );
      const fetchedAgents = agentsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setAgents(fetchedAgents);

      const agentIds = fetchedAgents.map((a) => a.id);

      // 2. Fetch leads scoped to this manager
      const leadsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.LEADS),
          where("managerId", "==", uid),
          where("companyId", "==", companyId)
        )
      );
      const fetchedLeads = leadsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setLeads(fetchedLeads);

      // 3 & 4. Fetch calls — only if we have agents (Firestore `in` needs ≥1 item)
      if (agentIds.length > 0) {
        // Firestore `in` supports max 30 items — safe for a team
        const batchIds = agentIds.slice(0, 30);

        // Calls today
        const callsTodaySnap = await getDocs(
          query(
            collection(db, COLLECTIONS.CALLS),
            where("agentId", "in", batchIds),
            where("createdAt", ">=", todayTs)
          )
        );
        const fetchedCallsToday = callsTodaySnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setCallsToday(fetchedCallsToday);

        // Calls this week (last 7 days) for chart
        const callsWeekSnap = await getDocs(
          query(
            collection(db, COLLECTIONS.CALLS),
            where("agentId", "in", batchIds),
            where("createdAt", ">=", weekAgoTs)
          )
        );
        const fetchedCallsWeek = callsWeekSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setCallsThisWeek(fetchedCallsWeek);
      }

      // 5. Overdue follow-ups — scheduledAt < now, status not completed/closed
      const overdueSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.FOLLOW_UPS),
          where("managerId", "==", uid),
          where("companyId", "==", companyId),
          where("scheduledAt", "<", nowTs),
          where("status", "in", ["pending", "scheduled"])
        )
      );
      const fetchedOverdue = overdueSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setOverdueFollowUps(fetchedOverdue);
    } catch (err) {
      console.error("ManagerDashboard fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid, companyId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Derived data ────────────────────────────────────────────────────────

  // Calls per agent today
  const callsPerAgent = agents.map((agent) => ({
    ...agent,
    callCount: callsToday.filter((c) => c.agentId === agent.id).length,
  }));

  // Sort: highest caller first
  callsPerAgent.sort((a, b) => b.callCount - a.callCount);

  // Leads grouped by stage
  const stageMap = {};
  leads.forEach((lead) => {
    const stage = lead.stage || "New";
    stageMap[stage] = (stageMap[stage] || 0) + 1;
  });
  const stageEntries = Object.entries(stageMap).sort((a, b) => b[1] - a[1]);

  // Weekly chart data
  const weekSkeleton = buildWeekSkeleton();
  callsThisWeek.forEach((call) => {
    const callDate = call.createdAt?.toDate
      ? call.createdAt.toDate().toDateString()
      : null;
    const slot = weekSkeleton.find((s) => s.dateKey === callDate);
    if (slot) slot.calls += 1;
  });

  const totalCallsToday = callsToday.length;
  const totalLeads = leads.length;
  const totalOverdue = overdueFollowUps.length;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {/* Shimmer keyframe injected once */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.scrollbarTrack}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.scrollbarThumb}; border-radius: 3px; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          backgroundColor: COLORS.background,
          padding: `${SPACING.xl} ${SPACING["2xl"]}`,
          fontFamily: FONTS.family,
          color: COLORS.textPrimary,
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: SPACING["2xl"],
          }}
        >
          <div>
            <div
              style={{
                fontSize: FONTS.size.xs,
                fontWeight: FONTS.weight.semibold,
                color: COLORS.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: SPACING.xs,
              }}
            >
              Manager View
            </div>
            <h1
              style={{
                fontSize: FONTS.size["4xl"],
                fontWeight: FONTS.weight.bold,
                color: COLORS.textPrimary,
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              Team Dashboard
            </h1>
            <div
              style={{
                fontSize: FONTS.size.sm,
                color: COLORS.textSecondary,
                marginTop: SPACING.xs,
              }}
            >
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchAll}
            style={{
              ...STYLES.buttonSecondary,
              display: "flex",
              alignItems: "center",
              gap: SPACING.sm,
              fontSize: FONTS.size.sm,
              padding: `${SPACING.sm} ${SPACING.base}`,
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* ── Error state ── */}
        {error && (
          <div
            style={{
              backgroundColor: COLORS.dangerMuted,
              border: `1px solid ${COLORS.danger}`,
              borderRadius: RADIUS.md,
              padding: SPACING.base,
              color: COLORS.danger,
              fontSize: FONTS.size.sm,
              marginBottom: SPACING.xl,
            }}
          >
            ⚠ Could not load dashboard data: {error}
          </div>
        )}

        {/* ── Stat Cards Row ── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: SPACING.base,
            marginBottom: SPACING["2xl"],
          }}
        >
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  ...STYLES.card,
                  flex: "1 1 200px",
                  height: "120px",
                }}
              >
                <Shimmer height="14px" width="60%" />
                <div style={{ marginTop: SPACING.md }}>
                  <Shimmer height="36px" width="40%" />
                </div>
              </div>
            ))
          ) : (
            <>
              <StatCard
                icon="📞"
                label="Calls Made Today"
                value={totalCallsToday}
                sub={`by ${agents.length} agent${agents.length !== 1 ? "s" : ""}`}
                color={COLORS.primary}
              />
              <StatCard
                icon="👥"
                label="Agents in My Team"
                value={agents.length}
                sub="active team members"
                color={COLORS.info}
              />
              <StatCard
                icon="📋"
                label="Total Leads"
                value={totalLeads}
                sub="across all stages"
                color={COLORS.accent}
              />
              <StatCard
                icon="🔴"
                label="Overdue Follow-ups"
                value={totalOverdue}
                sub={totalOverdue > 0 ? "needs attention" : "all on track"}
                color={totalOverdue > 0 ? COLORS.danger : COLORS.success}
              />
            </>
          )}
        </div>

        {/* ── Main Grid: Chart + Agents ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 360px",
            gap: SPACING.base,
            marginBottom: SPACING.base,
          }}
        >
          {/* Weekly Calls Chart */}
          <div style={{ ...STYLES.card }}>
            <SectionTitle title="Team Calls — Last 7 Days" />
            {loading ? (
              <div style={{ height: "240px", display: "flex", alignItems: "flex-end", gap: SPACING.sm }}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: SPACING.xs, alignItems: "stretch" }}>
                    <Shimmer height={`${30 + Math.random() * 120}px`} />
                  </div>
                ))}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={weekSkeleton}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={COLORS.border}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: COLORS.textMuted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: COLORS.textMuted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: COLORS.surfaceHover }}
                  />
                  <Bar dataKey="calls" radius={[4, 4, 0, 0]}>
                    {weekSkeleton.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.label === "Today"
                            ? COLORS.primary
                            : index === weekSkeleton.length - 2
                            ? COLORS.accent + "CC"
                            : COLORS.primary + "66"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Agent Call Count Today */}
          <div style={{ ...STYLES.card }}>
            <SectionTitle title="Agent Calls Today" count={agents.length} />
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: SPACING.sm,
                    }}
                  >
                    <Shimmer width="32px" height="32px" radius="50%" />
                    <div style={{ flex: 1 }}>
                      <Shimmer height="12px" width="60%" />
                    </div>
                    <Shimmer width="24px" height="20px" />
                  </div>
                ))}
              </div>
            ) : agents.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: COLORS.textMuted,
                  fontSize: FONTS.size.sm,
                  padding: `${SPACING.xl} 0`,
                }}
              >
                No agents assigned yet.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: SPACING.xs,
                  overflowY: "auto",
                  maxHeight: "280px",
                }}
              >
                {callsPerAgent.map((agent, idx) => {
                  const maxCalls = Math.max(...callsPerAgent.map((a) => a.callCount), 1);
                  const pct = (agent.callCount / maxCalls) * 100;

                  return (
                    <div
                      key={agent.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: SPACING.sm,
                        padding: `${SPACING.sm} ${SPACING.md}`,
                        borderRadius: RADIUS.base,
                        backgroundColor:
                          idx === 0 && agent.callCount > 0
                            ? COLORS.primaryMuted
                            : "transparent",
                        border:
                          idx === 0 && agent.callCount > 0
                            ? `1px solid ${COLORS.primary}33`
                            : "1px solid transparent",
                        transition: TRANSITIONS.base,
                      }}
                    >
                      {/* Rank badge */}
                      <div
                        style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: RADIUS.full,
                          backgroundColor:
                            idx === 0
                              ? COLORS.primary
                              : COLORS.surfaceActive,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: FONTS.size.xs,
                          fontWeight: FONTS.weight.bold,
                          color:
                            idx === 0
                              ? COLORS.textInverse
                              : COLORS.textSecondary,
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </div>

                      {/* Name + progress */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: FONTS.size.sm,
                            fontWeight: FONTS.weight.medium,
                            color: COLORS.textPrimary,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {agent.displayName || agent.email || "Agent"}
                        </div>
                        {/* Mini progress bar */}
                        <div
                          style={{
                            marginTop: "3px",
                            height: "3px",
                            borderRadius: RADIUS.full,
                            backgroundColor: COLORS.border,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              backgroundColor:
                                idx === 0 ? COLORS.primary : COLORS.textMuted,
                              borderRadius: RADIUS.full,
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                      </div>

                      {/* Call count */}
                      <div
                        style={{
                          fontSize: FONTS.size.base,
                          fontWeight: FONTS.weight.bold,
                          color:
                            agent.callCount > 0
                              ? COLORS.textPrimary
                              : COLORS.textMuted,
                          flexShrink: 0,
                        }}
                      >
                        {agent.callCount}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom Row: Leads by Stage + Overdue Follow-ups ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: SPACING.base,
          }}
        >
          {/* Leads by Stage */}
          <div style={{ ...STYLES.card }}>
            <SectionTitle title="Leads by Stage" count={totalLeads} />
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Shimmer key={i} height="32px" />
                ))}
              </div>
            ) : stageEntries.length === 0 ? (
              <div
                style={{
                  color: COLORS.textMuted,
                  fontSize: FONTS.size.sm,
                  textAlign: "center",
                  padding: `${SPACING.xl} 0`,
                }}
              >
                No leads assigned to your team yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: SPACING.xs }}>
                {stageEntries.map(([stage, count]) => {
                  const maxCount = Math.max(...stageEntries.map(([, c]) => c), 1);
                  const pct = (count / maxCount) * 100;
                  const color = getStageColor(stage);

                  return (
                    <div
                      key={stage}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: SPACING.md,
                        padding: `${SPACING.sm} 0`,
                        borderBottom: `1px solid ${COLORS.border}`,
                      }}
                    >
                      {/* Stage dot */}
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: color,
                          flexShrink: 0,
                        }}
                      />

                      {/* Stage name */}
                      <div
                        style={{
                          fontSize: FONTS.size.sm,
                          color: COLORS.textSecondary,
                          width: "110px",
                          flexShrink: 0,
                        }}
                      >
                        {stage}
                      </div>

                      {/* Progress bar */}
                      <div
                        style={{
                          flex: 1,
                          height: "6px",
                          borderRadius: RADIUS.full,
                          backgroundColor: COLORS.border,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            backgroundColor: color,
                            borderRadius: RADIUS.full,
                          }}
                        />
                      </div>

                      {/* Count */}
                      <div
                        style={{
                          fontSize: FONTS.size.sm,
                          fontWeight: FONTS.weight.semibold,
                          color: COLORS.textPrimary,
                          width: "28px",
                          textAlign: "right",
                          flexShrink: 0,
                        }}
                      >
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Overdue Follow-ups */}
          <div style={{ ...STYLES.card }}>
            <SectionTitle
              title="Overdue Follow-ups"
              count={overdueFollowUps.length}
            />
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: SPACING.sm }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <Shimmer key={i} height="52px" />
                ))}
              </div>
            ) : overdueFollowUps.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: `${SPACING.xl} 0`,
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: SPACING.sm }}>
                  ✓
                </div>
                <div
                  style={{
                    color: COLORS.success,
                    fontSize: FONTS.size.sm,
                    fontWeight: FONTS.weight.medium,
                  }}
                >
                  All follow-ups are on schedule!
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: SPACING.sm,
                  overflowY: "auto",
                  maxHeight: "280px",
                }}
              >
                {overdueFollowUps.map((fu) => {
                  const scheduledDate = fu.scheduledAt?.toDate
                    ? fu.scheduledAt.toDate()
                    : null;
                  const hoursLate = scheduledDate
                    ? Math.floor(
                        (Date.now() - scheduledDate.getTime()) / 3_600_000
                      )
                    : null;

                  return (
                    <div
                      key={fu.id}
                      style={{
                        backgroundColor: COLORS.dangerMuted,
                        border: `1px solid ${COLORS.danger}33`,
                        borderRadius: RADIUS.md,
                        padding: `${SPACING.sm} ${SPACING.md}`,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: SPACING.sm,
                      }}
                    >
                      {/* Red indicator */}
                      <div
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: COLORS.danger,
                          flexShrink: 0,
                          marginTop: "5px",
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: FONTS.size.sm,
                            fontWeight: FONTS.weight.medium,
                            color: COLORS.textPrimary,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {fu.leadName || "Unnamed Lead"}
                        </div>
                        <div
                          style={{
                            fontSize: FONTS.size.xs,
                            color: COLORS.textSecondary,
                            marginTop: "2px",
                          }}
                        >
                          Agent: {fu.agentName || fu.agentId || "—"}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: FONTS.size.xs,
                          color: COLORS.danger,
                          fontWeight: FONTS.weight.semibold,
                          flexShrink: 0,
                        }}
                      >
                        {hoursLate !== null
                          ? hoursLate >= 24
                            ? `${Math.floor(hoursLate / 24)}d late`
                            : `${hoursLate}h late`
                          : "Overdue"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ManagerDashboard;
