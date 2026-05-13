// TIRAS CRM — Agent Performance Comparison
// Manager sees side-by-side agent metrics, targets vs achievement, leaderboards
// Queries: agents under manager, calls this month, closed leads, follow-ups completed

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
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
  Legend,
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

const startOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
};

const fmtTalkTime = (seconds) => {
  if (!seconds || seconds === 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const initials = (name) => {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
};

// Deterministic avatar color per agent (from primary/accent palette)
const AVATAR_COLORS = [
  { bg: COLORS.primaryMuted, border: COLORS.primary + "55", text: COLORS.primary },
  { bg: COLORS.accentMuted,  border: COLORS.accent  + "55", text: COLORS.accent  },
  { bg: COLORS.infoMuted,    border: COLORS.info    + "55", text: COLORS.info    },
  { bg: COLORS.successMuted, border: COLORS.success + "55", text: COLORS.success },
  { bg: "#7B68EE26",         border: "#7B68EE55",           text: "#7B68EE"      },
];
const avatarColor = (idx) => AVATAR_COLORS[idx % AVATAR_COLORS.length];

// ─── Sub-components ───────────────────────────────────────────────────────────

const Shimmer = ({ width = "100%", height = "16px", radius = RADIUS.base }) => (
  <div
    style={{
      width, height, borderRadius: radius,
      background: `linear-gradient(90deg, ${COLORS.surface} 25%, #2a2a2a 50%, ${COLORS.surface} 75%)`,
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }}
  />
);

// Circular progress ring (SVG)
const RingProgress = ({ pct, color, size = 72 }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(pct / 100, 1) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.border} strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
    </svg>
  );
};

// Leaderboard top card
const LeaderCard = ({ title, icon, agent, value, label, loading }) => (
  <div
    style={{
      ...STYLES.card,
      flex: "1 1 220px",
      display: "flex",
      alignItems: "center",
      gap: SPACING.base,
      padding: SPACING.xl,
      background: `linear-gradient(135deg, ${COLORS.surface} 60%, ${COLORS.primaryMuted})`,
      border: `1px solid ${COLORS.primary}33`,
    }}
  >
    <div style={{ fontSize: "32px", flexShrink: 0 }}>{icon}</div>
    {loading ? (
      <div style={{ flex: 1 }}>
        <Shimmer height="12px" width="70%" />
        <div style={{ marginTop: SPACING.sm }}><Shimmer height="20px" width="50%" /></div>
      </div>
    ) : agent ? (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2px" }}>{title}</div>
        <div style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {agent}
        </div>
        <div style={{ fontSize: FONTS.size.sm, color: COLORS.accent, fontWeight: FONTS.weight.semibold, marginTop: "2px" }}>
          {value} {label}
        </div>
      </div>
    ) : (
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</div>
        <div style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, marginTop: SPACING.xs }}>No data yet</div>
      </div>
    )}
  </div>
);

// Stat pill inside agent card
const StatPill = ({ label, value, color }) => (
  <div
    style={{
      backgroundColor: COLORS.surfaceActive,
      borderRadius: RADIUS.md,
      padding: `${SPACING.sm} ${SPACING.md}`,
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: FONTS.size["2xl"], fontWeight: FONTS.weight.bold, color: color || COLORS.textPrimary }}>{value}</div>
    <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px" }}>{label}</div>
  </div>
);

// Target progress bar with inline edit
const TargetRow = ({ label, current, target, color, onEdit, saving }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(String(target || ""));
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  const save = async () => {
    const val = parseInt(draft, 10);
    if (!isNaN(val) && val > 0) await onEdit(val);
    setEditing(false);
  };

  return (
    <div style={{ marginBottom: SPACING.md }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: SPACING.xs }}>
          {editing ? (
            <>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
                style={{
                  ...STYLES.input,
                  width: "60px",
                  padding: "2px 6px",
                  fontSize: FONTS.size.xs,
                  textAlign: "center",
                }}
              />
              <button onClick={save} style={{ background: "none", border: "none", color: COLORS.success, cursor: "pointer", fontSize: FONTS.size.sm, padding: 0 }}>✓</button>
              <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: FONTS.size.sm, padding: 0 }}>✕</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, fontFamily: FONTS.mono }}>
                {current} / {target || "—"}
              </span>
              <button
                onClick={() => { setDraft(String(target || "")); setEditing(true); }}
                style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: "10px", padding: "0 2px", opacity: 0.7 }}
                title="Set target"
              >
                ✏
              </button>
            </>
          )}
        </div>
      </div>
      <div style={{ height: "6px", borderRadius: RADIUS.full, backgroundColor: COLORS.border, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: RADIUS.full,
            backgroundColor: pct >= 100 ? COLORS.success : color,
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <div style={{ fontSize: "10px", color: pct >= 100 ? COLORS.success : COLORS.textMuted, marginTop: "2px", textAlign: "right" }}>
        {target > 0 ? `${Math.round(pct)}%` : "No target set"}
        {pct >= 100 && " 🎯"}
      </div>
    </div>
  );
};

// Custom chart tooltip
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ backgroundColor: "#1E1E1E", border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, padding: `${SPACING.sm} ${SPACING.base}`, boxShadow: SHADOWS.md }}>
      <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginBottom: SPACING.xs }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: SPACING.xs, fontSize: FONTS.size.sm }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "2px", backgroundColor: p.fill }} />
          <span style={{ color: COLORS.textSecondary }}>{p.name}:</span>
          <span style={{ color: COLORS.textPrimary, fontWeight: FONTS.weight.semibold }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const AgentPerformance = () => {
  const { currentUser, companyId } = useAuth();

  const [agents, setAgents]         = useState([]);
  const [callsToday, setCallsToday] = useState([]);
  const [callsMonth, setCallsMonth] = useState([]);
  const [leadsMonth, setLeadsMonth] = useState([]);
  const [followUps, setFollowUps]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [savingTarget, setSavingTarget] = useState(null); // agentId being saved
  const [error, setError]           = useState(null);
  const [view, setView]             = useState("cards"); // cards | chart

  // ─── Fetch ───────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!currentUser?.uid || !companyId) return;
    try {
      setLoading(true);
      const uid      = currentUser.uid;
      const monthTs  = startOfMonth();
      const todayTs  = startOfToday();

      // 1. Agents under this manager
      const agentsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.USERS),
          where("managerId", "==", uid),
          where("companyId", "==", companyId)
        )
      );
      const fetchedAgents = agentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAgents(fetchedAgents);

      if (fetchedAgents.length === 0) { setLoading(false); return; }

      const agentIds = fetchedAgents.map((a) => a.id).slice(0, 30);

      // 2. Calls today (for leaderboard)
      const todaySnap = await getDocs(
        query(
          collection(db, COLLECTIONS.CALLS),
          where("agentId", "in", agentIds),
          where("createdAt", ">=", todayTs)
        )
      );
      setCallsToday(todaySnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // 3. Calls this month (for monthly stats + chart)
      const monthSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.CALLS),
          where("agentId", "in", agentIds),
          where("createdAt", ">=", monthTs)
        )
      );
      setCallsMonth(monthSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // 4. Leads closed this month (stage == "Closed Won")
      const closedSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.LEADS),
          where("agentId", "in", agentIds),
          where("companyId", "==", companyId),
          where("stage", "==", "Closed Won"),
          where("updatedAt", ">=", monthTs)
        )
      );
      setLeadsMonth(closedSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // 5. Follow-ups completed this month
      const fuSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.FOLLOW_UPS),
          where("agentId", "in", agentIds),
          where("companyId", "==", companyId),
          where("status", "==", "completed"),
          where("completedAt", ">=", monthTs)
        )
      );
      setFollowUps(fuSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("AgentPerformance fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid, companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Save target ──────────────────────────────────────────────────────────

  const saveTarget = async (agentId, field, value) => {
    setSavingTarget(agentId);
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, agentId), { [field]: value });
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, [field]: value } : a))
      );
    } catch (err) {
      console.error("saveTarget error:", err);
    } finally {
      setSavingTarget(null);
    }
  };

  // ─── Derived stats per agent ──────────────────────────────────────────────

  const agentStats = useMemo(() => {
    return agents.map((agent, idx) => {
      const myCallsToday = callsToday.filter((c) => c.agentId === agent.id);
      const myCallsMonth = callsMonth.filter((c) => c.agentId === agent.id);
      const myClosed     = leadsMonth.filter((l) => l.agentId === agent.id);
      const myFu         = followUps.filter((f)  => f.agentId === agent.id);

      // Total talk time this month in seconds
      const talkTimeSec  = myCallsMonth.reduce((sum, c) => sum + (c.duration || 0), 0);

      return {
        ...agent,
        colorSet:        avatarColor(idx),
        callsToday:      myCallsToday.length,
        callsMonth:      myCallsMonth.length,
        closedMonth:     myClosed.length,
        followUpsMonth:  myFu.length,
        talkTimeSec,
      };
    });
  }, [agents, callsToday, callsMonth, leadsMonth, followUps]);

  // Leaderboard
  const topCallerToday  = [...agentStats].sort((a, b) => b.callsToday  - a.callsToday)[0];
  const topCloserMonth  = [...agentStats].sort((a, b) => b.closedMonth - a.closedMonth)[0];
  const topTalkerMonth  = [...agentStats].sort((a, b) => b.talkTimeSec - a.talkTimeSec)[0];

  // Chart data
  const chartData = agentStats.map((a) => ({
    name:     (a.displayName || a.email || "Agent").split(" ")[0],
    Calls:    a.callsMonth,
    Closures: a.closedMonth,
    "Follow-ups": a.followUpsMonth,
  }));

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
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
            <div style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: SPACING.xs }}>
              Manager View
            </div>
            <h1 style={{ fontSize: FONTS.size["4xl"], fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, margin: 0, lineHeight: 1.1 }}>
              Agent Performance
            </h1>
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: SPACING.xs }}>
              {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })} · {agents.length} agent{agents.length !== 1 ? "s" : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: SPACING.sm }}>
            {/* View toggle */}
            <div
              style={{
                display: "flex",
                backgroundColor: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.base,
                overflow: "hidden",
              }}
            >
              {[{ id: "cards", label: "⊞ Cards" }, { id: "chart", label: "📊 Chart" }].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  style={{
                    padding: `${SPACING.sm} ${SPACING.base}`,
                    fontSize: FONTS.size.sm,
                    fontFamily: FONTS.family,
                    cursor: "pointer",
                    border: "none",
                    backgroundColor: view === v.id ? COLORS.primaryMuted : "transparent",
                    color: view === v.id ? COLORS.primary : COLORS.textSecondary,
                    fontWeight: view === v.id ? FONTS.weight.semibold : FONTS.weight.regular,
                    transition: TRANSITIONS.fast,
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <button onClick={fetchAll} style={{ ...STYLES.buttonSecondary, fontSize: FONTS.size.sm, padding: `${SPACING.sm} ${SPACING.base}` }}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ backgroundColor: COLORS.dangerMuted, border: `1px solid ${COLORS.danger}`, borderRadius: RADIUS.md, padding: SPACING.base, color: COLORS.danger, fontSize: FONTS.size.sm, marginBottom: SPACING.xl }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Leaderboard Row ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACING.base, marginBottom: SPACING["2xl"] }}>
          <LeaderCard title="Top Caller Today"    icon="📞" loading={loading} agent={topCallerToday?.displayName || topCallerToday?.email}  value={topCallerToday?.callsToday}  label="calls today"   />
          <LeaderCard title="Top Closer This Month" icon="🏆" loading={loading} agent={topCloserMonth?.displayName || topCloserMonth?.email}  value={topCloserMonth?.closedMonth} label="deals closed"  />
          <LeaderCard title="Most Talk Time"       icon="🎙️" loading={loading} agent={topTalkerMonth?.displayName || topTalkerMonth?.email}   value={fmtTalkTime(topTalkerMonth?.talkTimeSec)} label="this month" />
        </div>

        {/* ── No agents state ── */}
        {!loading && agents.length === 0 && (
          <div style={{ ...STYLES.card, textAlign: "center", padding: `${SPACING["5xl"]} ${SPACING["2xl"]}` }}>
            <div style={{ fontSize: "40px", marginBottom: SPACING.base }}>👥</div>
            <div style={{ fontSize: FONTS.size.lg, color: COLORS.textSecondary }}>No agents assigned to you yet.</div>
          </div>
        )}

        {/* ── CARDS VIEW ── */}
        {view === "cards" && !loading && agentStats.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: SPACING.base,
            }}
          >
            {agentStats.map((agent) => {
              const callPct  = (agent.monthlyCallTarget  || 0) > 0 ? (agent.callsMonth  / agent.monthlyCallTarget)  * 100 : 0;
              const closePct = (agent.monthlyCloseTarget || 0) > 0 ? (agent.closedMonth / agent.monthlyCloseTarget) * 100 : 0;

              return (
                <div
                  key={agent.id}
                  style={{
                    ...STYLES.card,
                    padding: 0,
                    overflow: "hidden",
                    border: `1px solid ${agent.colorSet.border}`,
                  }}
                >
                  {/* Agent card header */}
                  <div
                    style={{
                      padding: `${SPACING.lg} ${SPACING.xl}`,
                      background: `linear-gradient(135deg, ${COLORS.surface}, ${agent.colorSet.bg})`,
                      borderBottom: `1px solid ${COLORS.border}`,
                      display: "flex",
                      alignItems: "center",
                      gap: SPACING.base,
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: "52px",
                        height: "52px",
                        borderRadius: "50%",
                        backgroundColor: agent.colorSet.bg,
                        border: `2px solid ${agent.colorSet.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: FONTS.size.xl,
                        fontWeight: FONTS.weight.bold,
                        color: agent.colorSet.text,
                        flexShrink: 0,
                      }}
                    >
                      {initials(agent.displayName || agent.email)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {agent.displayName || "Agent"}
                      </div>
                      <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {agent.email}
                      </div>
                    </div>

                    {/* Today badge */}
                    <div style={{ textAlign: "center", flexShrink: 0 }}>
                      <div style={{ fontSize: FONTS.size["2xl"], fontWeight: FONTS.weight.bold, color: agent.colorSet.text, lineHeight: 1 }}>
                        {agent.callsToday}
                      </div>
                      <div style={{ fontSize: "10px", color: COLORS.textMuted }}>today</div>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div style={{ padding: SPACING.base }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: SPACING.sm, marginBottom: SPACING.base }}>
                      <StatPill label="Calls"      value={agent.callsMonth}     color={COLORS.primary} />
                      <StatPill label="Closed"     value={agent.closedMonth}    color={COLORS.success} />
                      <StatPill label="Follow-ups" value={agent.followUpsMonth} color={COLORS.accent}  />
                      <StatPill label="Talk Time"  value={fmtTalkTime(agent.talkTimeSec)} color={COLORS.info} />
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: `1px solid ${COLORS.border}`, marginBottom: SPACING.base }} />

                    {/* Target progress */}
                    <div style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: SPACING.sm }}>
                      Monthly Targets
                    </div>

                    <TargetRow
                      label="Call Target"
                      current={agent.callsMonth}
                      target={agent.monthlyCallTarget || 0}
                      color={COLORS.primary}
                      saving={savingTarget === agent.id}
                      onEdit={(val) => saveTarget(agent.id, "monthlyCallTarget", val)}
                    />
                    <TargetRow
                      label="Closure Target"
                      current={agent.closedMonth}
                      target={agent.monthlyCloseTarget || 0}
                      color={COLORS.success}
                      saving={savingTarget === agent.id}
                      onEdit={(val) => saveTarget(agent.id, "monthlyCloseTarget", val)}
                    />

                    {/* Achievement rings row */}
                    {(agent.monthlyCallTarget > 0 || agent.monthlyCloseTarget > 0) && (
                      <div style={{ display: "flex", justifyContent: "center", gap: SPACING["2xl"], marginTop: SPACING.base, paddingTop: SPACING.base, borderTop: `1px solid ${COLORS.border}` }}>
                        {agent.monthlyCallTarget > 0 && (
                          <div style={{ textAlign: "center" }}>
                            <div style={{ position: "relative", display: "inline-block" }}>
                              <RingProgress
                                pct={Math.min((agent.callsMonth / agent.monthlyCallTarget) * 100, 100)}
                                color={COLORS.primary}
                              />
                              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>
                                {Math.round(Math.min((agent.callsMonth / agent.monthlyCallTarget) * 100, 100))}%
                              </div>
                            </div>
                            <div style={{ fontSize: "10px", color: COLORS.textMuted, marginTop: "4px" }}>Calls</div>
                          </div>
                        )}
                        {agent.monthlyCloseTarget > 0 && (
                          <div style={{ textAlign: "center" }}>
                            <div style={{ position: "relative", display: "inline-block" }}>
                              <RingProgress
                                pct={Math.min((agent.closedMonth / agent.monthlyCloseTarget) * 100, 100)}
                                color={COLORS.success}
                              />
                              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: FONTS.size.xs, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>
                                {Math.round(Math.min((agent.closedMonth / agent.monthlyCloseTarget) * 100, 100))}%
                              </div>
                            </div>
                            <div style={{ fontSize: "10px", color: COLORS.textMuted, marginTop: "4px" }}>Closures</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Loading skeleton cards ── */}
        {view === "cards" && loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: SPACING.base }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ ...STYLES.card, padding: 0, overflow: "hidden" }}>
                <div style={{ padding: `${SPACING.lg} ${SPACING.xl}`, borderBottom: `1px solid ${COLORS.border}`, display: "flex", gap: SPACING.base, alignItems: "center" }}>
                  <Shimmer width="52px" height="52px" radius="50%" />
                  <div style={{ flex: 1 }}>
                    <Shimmer height="16px" width="60%" />
                    <div style={{ marginTop: SPACING.xs }}><Shimmer height="12px" width="80%" /></div>
                  </div>
                </div>
                <div style={{ padding: SPACING.base }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: SPACING.sm, marginBottom: SPACING.base }}>
                    {[...Array(4)].map((_, j) => <Shimmer key={j} height="56px" />)}
                  </div>
                  <Shimmer height="8px" />
                  <div style={{ marginTop: SPACING.md }}><Shimmer height="8px" /></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CHART VIEW ── */}
        {view === "chart" && !loading && agentStats.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: SPACING.base }}>
            {/* Grouped bar chart */}
            <div style={{ ...STYLES.card }}>
              <div style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary, marginBottom: SPACING.base }}>
                Monthly Performance Comparison
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: -16, bottom: 0 }} barCategoryGap="25%" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: COLORS.textSecondary, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: COLORS.surfaceHover }} />
                  <Legend
                    wrapperStyle={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, paddingTop: SPACING.sm }}
                    iconType="square"
                    iconSize={10}
                  />
                  <Bar dataKey="Calls"       fill={COLORS.primary}  radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Closures"    fill={COLORS.success}  radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Follow-ups"  fill={COLORS.accent}   radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Comparison table */}
            <div style={{ ...STYLES.card, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: `${SPACING.md} ${SPACING.xl}`, borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>Side-by-Side Comparison</span>
              </div>
              {/* Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `180px repeat(${agentStats.length}, 1fr)`,
                  backgroundColor: COLORS.surfaceActive,
                  borderBottom: `1px solid ${COLORS.border}`,
                }}
              >
                <div style={{ ...STYLES.tableHeader, padding: `${SPACING.md} ${SPACING.xl}` }}>Metric</div>
                {agentStats.map((a) => (
                  <div key={a.id} style={{ ...STYLES.tableHeader, padding: `${SPACING.md} ${SPACING.base}`, textAlign: "center" }}>
                    <div style={{ color: a.colorSet.text }}>{(a.displayName || "Agent").split(" ")[0]}</div>
                  </div>
                ))}
              </div>

              {/* Metric rows */}
              {[
                { label: "Calls Today",         key: "callsToday",     fmt: (v) => v,                     color: COLORS.primary },
                { label: "Calls This Month",    key: "callsMonth",     fmt: (v) => v,                     color: COLORS.primary },
                { label: "Closures This Month", key: "closedMonth",    fmt: (v) => v,                     color: COLORS.success },
                { label: "Follow-ups Done",     key: "followUpsMonth", fmt: (v) => v,                     color: COLORS.accent  },
                { label: "Talk Time (Month)",   key: "talkTimeSec",    fmt: (v) => fmtTalkTime(v),        color: COLORS.info    },
                { label: "Call Target",         key: "monthlyCallTarget",  fmt: (v) => v || "—",         color: COLORS.textMuted },
                { label: "Closure Target",      key: "monthlyCloseTarget", fmt: (v) => v || "—",         color: COLORS.textMuted },
              ].map((row, rowIdx) => {
                // Find max value for highlighting
                const values = agentStats.map((a) => a[row.key] || 0);
                const maxVal  = Math.max(...values);

                return (
                  <div
                    key={row.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: `180px repeat(${agentStats.length}, 1fr)`,
                      borderBottom: `1px solid ${COLORS.border}`,
                      backgroundColor: rowIdx % 2 === 0 ? "transparent" : COLORS.surface + "66",
                    }}
                  >
                    <div style={{ padding: `${SPACING.md} ${SPACING.xl}`, fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>
                      {row.label}
                    </div>
                    {agentStats.map((a) => {
                      const val     = a[row.key] || 0;
                      const isTop   = val === maxVal && maxVal > 0;
                      return (
                        <div
                          key={a.id}
                          style={{
                            padding: `${SPACING.md} ${SPACING.base}`,
                            textAlign: "center",
                            fontSize: FONTS.size.base,
                            fontWeight: isTop ? FONTS.weight.bold : FONTS.weight.regular,
                            color: isTop ? row.color : COLORS.textSecondary,
                          }}
                        >
                          {row.fmt(val)}
                          {isTop && maxVal > 0 && (
                            <span style={{ marginLeft: "4px", fontSize: "10px" }}>▲</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Chart loading ── */}
        {view === "chart" && loading && (
          <div style={{ ...STYLES.card }}>
            <Shimmer height="320px" />
          </div>
        )}
      </div>
    </>
  );
};

export default AgentPerformance;
