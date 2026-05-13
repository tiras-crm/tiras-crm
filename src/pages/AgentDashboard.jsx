// ─────────────────────────────────────────────────────────────────────────────
// TIRAS CRM — AgentDashboard
// File: src/pages/AgentDashboard.jsx
//
// HOW TO USE:
//   In src/pages/index.js replace:
//     export const AgentDashboard = () => <Placeholder name="Agent Dashboard" />;
//   with the contents of this file (everything above `export default`).
//
// FIRESTORE READS (all scoped to currentUser.uid + companyId):
//   leads        — assignedTo == uid, companyId
//   calls        — agentId == uid, companyId, createdAt >= today
//   followups    — agentId == uid, companyId, scheduledAt <= end-of-today, status == pending
//   calls (recent) — agentId == uid, companyId, ordered by createdAt desc, limit 5
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
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
  TRANSITIONS,
} from "../theme";

// ─── Keyframe injection ───────────────────────────────────────────────────────

const STYLE_ID = "tiras-dash-styles";
const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const tag = document.createElement("style");
  tag.id = STYLE_ID;
  tag.textContent = `
    @keyframes tiras-fade-up {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes tiras-bar-grow {
      from { width: 0%; }
    }
    @keyframes tiras-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes tiras-pulse-dot {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.35; }
    }
  `;
  document.head.appendChild(tag);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Start of today as a JS Date */
const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** End of today as a JS Date */
const todayEnd = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

/** Start of current calendar month */
const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Human-friendly relative time label */
const timeAgo = (ts) => {
  if (!ts) return "—";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

/** Format seconds as m:ss */
const formatDuration = (secs) => {
  if (!secs) return "0:00";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

// ─── Outcome config (colour + label) ─────────────────────────────────────────

const OUTCOME_CONFIG = {
  "Interested":     { color: COLORS.success,       bg: `${COLORS.success}18`,   label: "Interested" },
  "Not Interested": { color: COLORS.danger,        bg: `${COLORS.danger}18`,    label: "Not Interested" },
  "Call Back":      { color: COLORS.accent,        bg: `${COLORS.accent}18`,    label: "Call Back" },
  "No Answer":      { color: COLORS.textMuted,     bg: `${COLORS.surfaceActive}`,label: "No Answer" },
  "Wrong Number":   { color: COLORS.textMuted,     bg: `${COLORS.surfaceActive}`,label: "Wrong Number" },
  "Busy":           { color: COLORS.warning,       bg: `${COLORS.warning}18`,   label: "Busy" },
  "Voicemail":      { color: COLORS.info,          bg: `${COLORS.info}18`,      label: "Voicemail" },
};

// ─── Pipeline stage order ─────────────────────────────────────────────────────

const STAGE_ORDER = [
  "New",
  "Contacted",
  "Interested",
  "Follow-up",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

const STAGE_COLORS = {
  "New":          COLORS.textMuted,
  "Contacted":    COLORS.info,
  "Interested":   COLORS.accent,
  "Follow-up":    COLORS.warning,
  "Negotiation":  COLORS.primary,
  "Closed Won":   COLORS.success,
  "Closed Lost":  COLORS.danger,
};

// ─── Style objects ────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100%",
    backgroundColor: COLORS.background,
    padding: SPACING["2xl"],
    fontFamily: FONTS.family,
  },

  // Page header
  pageHeader: {
    marginBottom: SPACING["2xl"],
    animation: "tiras-fade-up 0.3s ease both",
  },
  pageTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size["3xl"],
    fontWeight: FONTS.weight.bold,
    letterSpacing: "-0.01em",
    marginBottom: SPACING.xs,
  },
  pageSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.base,
  },

  // Stat card grid
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: SPACING.base,
    marginBottom: SPACING["2xl"],
  },

  statCard: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    boxShadow: SHADOWS.sm,
    transition: TRANSITIONS.base,
    cursor: "default",
    position: "relative",
    overflow: "hidden",
  },

  statCardAccentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "2px",
  },

  statLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    marginBottom: SPACING.sm,
  },

  statValue: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size["5xl"],
    fontWeight: FONTS.weight.bold,
    letterSpacing: "-0.02em",
    lineHeight: 1,
    marginBottom: SPACING.xs,
  },

  statMeta: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
  },

  statIcon: {
    position: "absolute",
    bottom: SPACING.base,
    right: SPACING.base,
    opacity: 0.07,
  },

  // Two-column body layout
  bodyGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: SPACING.base,
  },

  // Card base
  card: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    boxShadow: SHADOWS.sm,
    overflow: "hidden",
  },

  cardHeader: {
    padding: `${SPACING.base} ${SPACING.xl}`,
    borderBottom: `1px solid ${COLORS.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.semibold,
  },

  cardBadge: {
    backgroundColor: COLORS.primaryMuted,
    color: COLORS.primary,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    padding: `2px ${SPACING.sm}`,
    borderRadius: RADIUS.full,
  },

  cardBody: {
    padding: SPACING.xl,
  },

  // Stage rows
  stageRow: {
    marginBottom: SPACING.md,
  },

  stageLabel: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },

  stageName: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    color: COLORS.textSecondary,
  },

  stageCount: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textPrimary,
  },

  stageTrack: {
    height: "5px",
    backgroundColor: COLORS.surfaceActive,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },

  // Activity list
  activityList: {
    display: "flex",
    flexDirection: "column",
  },

  activityItem: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.md,
    padding: `${SPACING.md} ${SPACING.xl}`,
    borderBottom: `1px solid ${COLORS.border}`,
    transition: TRANSITIONS.fast,
  },

  activityDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },

  activityMain: {
    flex: 1,
    minWidth: 0,
  },

  activityLeadName: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.medium,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  activityMeta: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    marginTop: "2px",
  },

  activityRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "3px",
    flexShrink: 0,
  },

  outcomeBadge: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    padding: `2px ${SPACING.sm}`,
    borderRadius: RADIUS.full,
    whiteSpace: "nowrap",
  },

  activityTime: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
  },

  // Follow-up items
  followupItem: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.md,
    padding: `${SPACING.md} ${SPACING.xl}`,
    borderBottom: `1px solid ${COLORS.border}`,
  },

  followupDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: COLORS.accent,
    flexShrink: 0,
    animation: "tiras-pulse-dot 2s ease infinite",
  },

  followupLeadName: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.medium,
    flex: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  followupTime: {
    color: COLORS.accent,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
    flexShrink: 0,
  },

  // Loading / empty states
  loadingWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: `${SPACING["3xl"]} ${SPACING.xl}`,
    gap: SPACING.sm,
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
  },

  spinner: {
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: `2px solid ${COLORS.border}`,
    borderTopColor: COLORS.primary,
    animation: "tiras-spin 0.7s linear infinite",
    flexShrink: 0,
  },

  emptyState: {
    textAlign: "center",
    padding: `${SPACING["2xl"]} ${SPACING.xl}`,
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
  },

  emptyIcon: {
    fontSize: "28px",
    marginBottom: SPACING.sm,
    opacity: 0.4,
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Stat card with top accent bar and big number */
const StatCard = ({ label, value, meta, accentColor, icon, delay = 0 }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        ...S.statCard,
        animation: `tiras-fade-up 0.35s ease ${delay}ms both`,
        ...(hovered ? { borderColor: accentColor + "60", boxShadow: `0 4px 16px ${accentColor}18` } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ ...S.statCardAccentBar, backgroundColor: accentColor }} />
      <div style={S.statLabel}>{label}</div>
      <div style={{ ...S.statValue, color: accentColor }}>{value}</div>
      {meta && <div style={S.statMeta}>{meta}</div>}
      <div style={S.statIcon}>{icon}</div>
    </div>
  );
};

/** Section card wrapper */
const SectionCard = ({ title, badge, children, style }) => (
  <div style={{ ...S.card, ...style }}>
    <div style={S.cardHeader}>
      <span style={S.cardTitle}>{title}</span>
      {badge != null && (
        <span style={S.cardBadge}>{badge}</span>
      )}
    </div>
    {children}
  </div>
);

/** Loading placeholder for a card body */
const LoadingRows = () => (
  <div style={S.loadingWrap}>
    <div style={S.spinner} />
    <span>Loading…</span>
  </div>
);

/** SVG icons (monochrome, sized inline) */
const PhoneIcon = ({ size = 40, color = COLORS.primary }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const LeadsIcon = ({ size = 40, color = COLORS.accent }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const CalendarIcon = ({ size = 40, color = COLORS.warning }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const TrendIcon = ({ size = 40, color = COLORS.success }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
    <polyline points="16 7 22 7 22 13"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// AgentDashboard Component
// ─────────────────────────────────────────────────────────────────────────────

export const AgentDashboard = () => {
  const { currentUser, companyId, userProfile } = useAuth();

  // ─── State ──────────────────────────────────────────────────────────────────
  const [callsToday,    setCallsToday]    = useState(null);   // number
  const [talkTimeToday, setTalkTimeToday] = useState(0);      // total seconds
  const [leadsByStage,  setLeadsByStage]  = useState(null);   // { stage: count }
  const [totalLeads,    setTotalLeads]    = useState(0);
  const [followupsDue,  setFollowupsDue]  = useState(null);   // array of followup docs
  const [convRate,      setConvRate]      = useState(null);   // percentage string
  const [recentCalls,   setRecentCalls]   = useState(null);   // array of call+lead docs
  const [loading,       setLoading]       = useState(true);

  // ─── Fetch all dashboard data ────────────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    if (!currentUser || !companyId) return;
    setLoading(true);

    try {
      await Promise.all([
        fetchCallsToday(),
        fetchLeads(),
        fetchFollowupsDue(),
        fetchRecentCalls(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, companyId]); // eslint-disable-line

  useEffect(() => {
    injectStyles();
    fetchDashboard();
  }, [fetchDashboard]);

  // ─── Fetch: calls made today ─────────────────────────────────────────────────

  const fetchCallsToday = async () => {
    const q = query(
      collection(db, COLLECTIONS.CALLS),
      where("agentId",   "==", currentUser.uid),
      where("companyId", "==", companyId),
      where("createdAt", ">=", Timestamp.fromDate(todayStart())),
      where("createdAt", "<=", Timestamp.fromDate(todayEnd()))
    );
    const snap = await getDocs(q);
    let totalSecs = 0;
    snap.docs.forEach((d) => { totalSecs += d.data().duration || 0; });
    setCallsToday(snap.size);
    setTalkTimeToday(totalSecs);
  };

  // ─── Fetch: all my leads + conversion rate ───────────────────────────────────

  const fetchLeads = async () => {
    const q = query(
      collection(db, COLLECTIONS.LEADS),
      where("assignedTo", "==", currentUser.uid),
      where("companyId",  "==", companyId)
    );
    const snap = await getDocs(q);

    // Count by stage
    const stages = {};
    let closedWon = 0;
    let monthClosed = 0;

    snap.docs.forEach((d) => {
      const data = d.data();
      const stage = data.stage || "New";
      stages[stage] = (stages[stage] || 0) + 1;

      // Conversion rate: Closed Won / all leads assigned this month
      const createdAt = data.createdAt?.toDate?.();
      if (createdAt && createdAt >= monthStart()) {
        monthClosed++;
        if (stage === "Closed Won") closedWon++;
      }
    });

    setLeadsByStage(stages);
    setTotalLeads(snap.size);

    const rate = monthClosed > 0
      ? Math.round((closedWon / monthClosed) * 100)
      : 0;
    setConvRate(rate);
  };

  // ─── Fetch: follow-ups due today ──────────────────────────────────────────────

  const fetchFollowupsDue = async () => {
    const q = query(
      collection(db, COLLECTIONS.FOLLOW_UPS),
      where("agentId",     "==", currentUser.uid),
      where("companyId",   "==", companyId),
      where("status",      "==", "pending"),
      where("scheduledAt", "<=", Timestamp.fromDate(todayEnd())),
      orderBy("scheduledAt", "asc")
    );
    const snap = await getDocs(q);
    setFollowupsDue(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  // ─── Fetch: 5 most recent calls with lead name ───────────────────────────────

  const fetchRecentCalls = async () => {
    const q = query(
      collection(db, COLLECTIONS.CALLS),
      where("agentId",   "==", currentUser.uid),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const snap = await getDocs(q);
    const calls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Batch-resolve lead names from the leadId on each call
    const withNames = await Promise.all(
      calls.map(async (call) => {
        if (!call.leadId) return { ...call, leadName: "Unknown Lead" };
        try {
          const leadSnap = await getDocs(
            query(
              collection(db, COLLECTIONS.LEADS),
              where("__name__", "==", call.leadId)
            )
          );
          // getDocs by __name__ filter is unreliable across SDKs —
          // safe fallback: use the leadName stored on the call doc if present
          const leadDoc = leadSnap.docs[0];
          return {
            ...call,
            leadName: leadDoc?.data()?.name ?? call.leadName ?? "Unknown Lead",
          };
        } catch {
          return { ...call, leadName: call.leadName ?? "Unknown Lead" };
        }
      })
    );
    setRecentCalls(withNames);
  };

  // ─── Derived values ───────────────────────────────────────────────────────────

  const displayName = userProfile?.displayName ?? currentUser?.email?.split("@")[0] ?? "Agent";
  const todayLabel  = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const talkTimeFmt = talkTimeToday >= 60
    ? `${Math.floor(talkTimeToday / 60)}m talk time`
    : `${talkTimeToday}s talk time`;

  // For stage bar chart: max count to calculate percentages
  const maxStageCount = leadsByStage
    ? Math.max(...Object.values(leadsByStage), 1)
    : 1;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>

      {/* Page header */}
      <div style={S.pageHeader}>
        <div style={S.pageTitle}>
          Good {greeting()},{" "}
          <span style={{ color: COLORS.primary }}>{displayName}</span>
        </div>
        <div style={S.pageSubtitle}>{todayLabel}</div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────────── */}
      <div style={S.statGrid}>

        <StatCard
          label="Calls Today"
          value={callsToday ?? "—"}
          meta={callsToday !== null ? talkTimeFmt : "Loading…"}
          accentColor={COLORS.primary}
          icon={<PhoneIcon />}
          delay={0}
        />

        <StatCard
          label="My Leads"
          value={leadsByStage !== null ? totalLeads : "—"}
          meta={leadsByStage !== null ? `${Object.keys(leadsByStage).length} active stages` : "Loading…"}
          accentColor={COLORS.accent}
          icon={<LeadsIcon />}
          delay={60}
        />

        <StatCard
          label="Follow-ups Due"
          value={followupsDue !== null ? followupsDue.length : "—"}
          meta={followupsDue !== null
            ? (followupsDue.length === 0 ? "All clear today" : "Due today")
            : "Loading…"}
          accentColor={followupsDue?.length > 0 ? COLORS.warning : COLORS.success}
          icon={<CalendarIcon />}
          delay={120}
        />

        <StatCard
          label="Conversion Rate"
          value={convRate !== null ? `${convRate}%` : "—"}
          meta="Closed Won / total this month"
          accentColor={COLORS.success}
          icon={<TrendIcon />}
          delay={180}
        />

      </div>

      {/* ── Body: two columns ─────────────────────────────────────────────────── */}
      <div style={S.bodyGrid}>

        {/* LEFT — Leads by Stage */}
        <SectionCard
          title="Leads by Stage"
          badge={leadsByStage !== null ? totalLeads : null}
        >
          {leadsByStage === null ? (
            <LoadingRows />
          ) : totalLeads === 0 ? (
            <div style={S.emptyState}>
              <div style={S.emptyIcon}>📋</div>
              <div>No leads assigned yet</div>
            </div>
          ) : (
            <div style={S.cardBody}>
              {STAGE_ORDER.map((stage) => {
                const count = leadsByStage[stage] || 0;
                const pct   = Math.round((count / maxStageCount) * 100);
                const color = STAGE_COLORS[stage] || COLORS.textMuted;
                return (
                  <div key={stage} style={S.stageRow}>
                    <div style={S.stageLabel}>
                      <span style={{ ...S.stageName, color }}>{stage}</span>
                      <span style={S.stageCount}>{count}</span>
                    </div>
                    <div style={S.stageTrack}>
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          backgroundColor: color,
                          borderRadius: RADIUS.full,
                          transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                          minWidth: count > 0 ? "6px" : "0",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* RIGHT — Follow-ups due today */}
        <SectionCard
          title="Follow-ups Due Today"
          badge={followupsDue !== null ? followupsDue.length : null}
        >
          {followupsDue === null ? (
            <LoadingRows />
          ) : followupsDue.length === 0 ? (
            <div style={S.emptyState}>
              <div style={S.emptyIcon}>✅</div>
              <div>No follow-ups due today</div>
            </div>
          ) : (
            <div>
              {followupsDue.map((fu, idx) => {
                const scheduledDate = fu.scheduledAt?.toDate?.();
                const timeStr = scheduledDate
                  ? scheduledDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                  : "—";
                const isOverdue = scheduledDate && scheduledDate < new Date();
                return (
                  <div
                    key={fu.id}
                    style={{
                      ...S.followupItem,
                      ...(idx === followupsDue.length - 1
                        ? { borderBottom: "none" }
                        : {}),
                    }}
                  >
                    <div
                      style={{
                        ...S.followupDot,
                        backgroundColor: isOverdue ? COLORS.danger : COLORS.accent,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.followupLeadName}>
                        {fu.leadName ?? "Lead"}
                      </div>
                      {fu.note && (
                        <div
                          style={{
                            color: COLORS.textMuted,
                            fontSize: FONTS.size.sm,
                            marginTop: "2px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {fu.note}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        ...S.followupTime,
                        color: isOverdue ? COLORS.danger : COLORS.accent,
                      }}
                    >
                      {isOverdue ? "Overdue" : timeStr}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

      </div>

      {/* ── Recent Activity ───────────────────────────────────────────────────── */}
      <div style={{ marginTop: SPACING.base }}>
        <SectionCard
          title="Recent Call Activity"
          badge={recentCalls !== null ? `Last ${recentCalls.length}` : null}
        >
          {recentCalls === null ? (
            <LoadingRows />
          ) : recentCalls.length === 0 ? (
            <div style={S.emptyState}>
              <div style={S.emptyIcon}>📞</div>
              <div>No calls logged yet — make your first call to see activity here</div>
            </div>
          ) : (
            <div style={S.activityList}>
              {recentCalls.map((call, idx) => {
                const outcomeConf = OUTCOME_CONFIG[call.outcome] ?? {
                  color: COLORS.textMuted,
                  bg: COLORS.surfaceActive,
                  label: call.outcome ?? "Unknown",
                };
                return (
                  <div
                    key={call.id}
                    style={{
                      ...S.activityItem,
                      ...(idx === recentCalls.length - 1
                        ? { borderBottom: "none" }
                        : {}),
                    }}
                  >
                    {/* Colour dot */}
                    <div
                      style={{
                        ...S.activityDot,
                        backgroundColor: outcomeConf.color,
                        boxShadow: `0 0 6px ${outcomeConf.color}60`,
                      }}
                    />

                    {/* Lead name + duration */}
                    <div style={S.activityMain}>
                      <div style={S.activityLeadName}>{call.leadName}</div>
                      <div style={S.activityMeta}>
                        {formatDuration(call.duration)}{" "}
                        {call.aiSummary && (
                          <span
                            style={{
                              color: COLORS.accent,
                              marginLeft: SPACING.xs,
                            }}
                          >
                            · AI summary ready
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Outcome badge + time */}
                    <div style={S.activityRight}>
                      <span
                        style={{
                          ...S.outcomeBadge,
                          color: outcomeConf.color,
                          backgroundColor: outcomeConf.bg,
                        }}
                      >
                        {outcomeConf.label}
                      </span>
                      <span style={S.activityTime}>
                        {timeAgo(call.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

    </div>
  );
};

// ─── Greeting helper (outside component — no re-render cost) ──────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default AgentDashboard;
