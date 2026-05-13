// TIRAS CRM — Follow-Up Calendar View
// Manager sees all team follow-ups in Day / Week / Month calendar views
// Overdue = red, Today = amber, Completed = muted green, Upcoming = copper
// Queries: followups where managerId == currentUser.uid + companyId

import React, { useEffect, useState, useCallback, useMemo } from "react";
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

// ─── Constants ────────────────────────────────────────────────────────────────

const VIEWS = ["Day", "Week", "Month"];

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL  = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES     = ["January", "February", "March", "April", "May", "June",
                         "July", "August", "September", "October", "November", "December"];

const STATUS_META = {
  completed: { color: COLORS.success,  bg: COLORS.successMuted, label: "Done",    dot: "●" },
  pending:   { color: COLORS.primary,  bg: COLORS.primaryMuted, label: "Pending", dot: "○" },
  scheduled: { color: COLORS.info,     bg: COLORS.infoMuted,    label: "Set",     dot: "○" },
  overdue:   { color: COLORS.danger,   bg: COLORS.dangerMuted,  label: "Overdue", dot: "!" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const startOfWeek = (d) => {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
};

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth   = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

const fmtDayFull = (d) =>
  d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const fmtWeekRange = (d) => {
  const s = startOfWeek(d);
  const e = addDays(s, 6);
  const sStr = s.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const eStr = e.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${sStr} – ${eStr}`;
};

// Resolve effective status of a follow-up
const resolveStatus = (fu) => {
  if (fu.status === "completed") return "completed";
  const ts = fu.scheduledAt?.toDate ? fu.scheduledAt.toDate() : null;
  if (ts && ts < new Date()) return "overdue";
  return fu.status || "pending";
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Shimmer = ({ width = "100%", height = "16px", radius = RADIUS.base }) => (
  <div style={{
    width, height, borderRadius: radius,
    background: `linear-gradient(90deg, ${COLORS.surface} 25%, #2a2a2a 50%, ${COLORS.surface} 75%)`,
    backgroundSize: "200% 100%",
    animation: "shimmer 1.4s infinite",
  }} />
);

// Compact follow-up chip for month/week cells
const FuChip = ({ fu, onClick }) => {
  const status = resolveStatus(fu);
  const meta   = STATUS_META[status];
  const timeStr = fmtTime(fu.scheduledAt);

  return (
    <div
      onClick={() => onClick(fu)}
      style={{
        backgroundColor: meta.bg,
        border: `1px solid ${meta.color}44`,
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: RADIUS.sm,
        padding: `2px ${SPACING.xs}`,
        fontSize: "11px",
        color: meta.color,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "3px",
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        transition: TRANSITIONS.fast,
        marginBottom: "2px",
      }}
      title={`${fu.leadName || "Lead"} — ${timeStr}`}
    >
      <span style={{ flexShrink: 0, fontSize: "9px" }}>{meta.dot}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {timeStr && <span style={{ opacity: 0.75, marginRight: "3px" }}>{timeStr}</span>}
        {fu.leadName || "Lead"}
      </span>
    </div>
  );
};

// Detail drawer (slides in from right)
const DetailDrawer = ({ fu, onClose, agentMap }) => {
  if (!fu) return null;
  const status  = resolveStatus(fu);
  const meta    = STATUS_META[status];
  const timeStr = fmtTime(fu.scheduledAt);
  const dateStr = fu.scheduledAt?.toDate
    ? fu.scheduledAt.toDate().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
    : "—";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 100,
        }}
      />
      {/* Drawer */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "360px",
          backgroundColor: COLORS.surface,
          borderLeft: `1px solid ${COLORS.border}`,
          boxShadow: SHADOWS.lg,
          zIndex: 101,
          padding: SPACING.xl,
          overflowY: "auto",
          fontFamily: FONTS.family,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: SPACING.xl }}>
          <div>
            <span
              style={{
                ...STYLES.badge,
                backgroundColor: meta.bg,
                color: meta.color,
                fontSize: FONTS.size.xs,
                marginBottom: SPACING.sm,
                display: "inline-flex",
              }}
            >
              {meta.dot} {meta.label}
            </span>
            <div style={{ fontSize: FONTS.size["2xl"], fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>
              {fu.leadName || "Unnamed Lead"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: COLORS.textMuted,
              cursor: "pointer", fontSize: FONTS.size["2xl"], padding: 0, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Details */}
        {[
          { label: "Date",    value: dateStr },
          { label: "Time",    value: timeStr || "—" },
          { label: "Agent",   value: agentMap[fu.agentId] || fu.agentId || "—" },
          { label: "Phone",   value: fu.leadPhone || "—" },
          { label: "Status",  value: meta.label },
          { label: "Source",  value: fu.leadSource || "—" },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: `${SPACING.sm} 0`,
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            <span style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted }}>{label}</span>
            <span style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary, fontWeight: FONTS.weight.medium, textAlign: "right", maxWidth: "60%" }}>
              {value}
            </span>
          </div>
        ))}

        {/* Note */}
        {fu.note && (
          <div style={{ marginTop: SPACING.base }}>
            <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: SPACING.xs }}>
              Note
            </div>
            <div style={{
              backgroundColor: COLORS.surfaceActive,
              borderRadius: RADIUS.md,
              padding: SPACING.md,
              fontSize: FONTS.size.sm,
              color: COLORS.textSecondary,
              lineHeight: 1.6,
            }}>
              {fu.note}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ─── Month View ───────────────────────────────────────────────────────────────

const MonthView = ({ cursor, followUps, onFuClick, agentFilter, agentMap }) => {
  const first  = startOfMonth(cursor);
  const last   = endOfMonth(cursor);
  const todayD = today();

  // Build 6-week grid
  const gridStart = startOfWeek(first);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    cells.push(addDays(gridStart, i));
  }

  const fuForDay = (d) =>
    followUps.filter((fu) => {
      if (agentFilter !== "all" && fu.agentId !== agentFilter) return false;
      const ts = fu.scheduledAt?.toDate ? fu.scheduledAt.toDate() : null;
      return ts && sameDay(ts, d);
    }).sort((a, b) => {
      const ta = a.scheduledAt?.seconds || 0;
      const tb = b.scheduledAt?.seconds || 0;
      return ta - tb;
    });

  return (
    <div style={{ flex: 1, overflow: "hidden" }}>
      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${COLORS.border}` }}>
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} style={{ ...STYLES.tableHeader, textAlign: "center", padding: `${SPACING.sm} 0` }}>{d}</div>
        ))}
      </div>

      {/* Weeks */}
      <div style={{ display: "grid", gridTemplateRows: "repeat(6, 1fr)", height: "calc(100% - 36px)" }}>
        {Array.from({ length: 6 }).map((_, wi) => (
          <div
            key={wi}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            {Array.from({ length: 7 }).map((_, di) => {
              const cellDate   = cells[wi * 7 + di];
              const isToday    = sameDay(cellDate, todayD);
              const inMonth    = cellDate.getMonth() === cursor.getMonth();
              const dayFus     = fuForDay(cellDate);
              const MAX_SHOWN  = 3;

              return (
                <div
                  key={di}
                  style={{
                    borderRight: di < 6 ? `1px solid ${COLORS.border}` : "none",
                    padding: `${SPACING.xs} ${SPACING.xs}`,
                    minHeight: "90px",
                    backgroundColor: isToday ? COLORS.primaryMuted + "44" : "transparent",
                    overflow: "hidden",
                  }}
                >
                  {/* Day number */}
                  <div style={{ marginBottom: "3px", textAlign: "right" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        fontSize: FONTS.size.xs,
                        fontWeight: isToday ? FONTS.weight.bold : FONTS.weight.regular,
                        color: isToday ? COLORS.textInverse : inMonth ? COLORS.textSecondary : COLORS.textMuted,
                        backgroundColor: isToday ? COLORS.primary : "transparent",
                      }}
                    >
                      {cellDate.getDate()}
                    </span>
                  </div>

                  {/* Follow-up chips */}
                  {dayFus.slice(0, MAX_SHOWN).map((fu) => (
                    <FuChip key={fu.id} fu={fu} onClick={onFuClick} />
                  ))}
                  {dayFus.length > MAX_SHOWN && (
                    <div style={{ fontSize: "10px", color: COLORS.textMuted, padding: "1px 3px" }}>
                      +{dayFus.length - MAX_SHOWN} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Week View ────────────────────────────────────────────────────────────────

const WeekView = ({ cursor, followUps, onFuClick, agentFilter }) => {
  const weekStart = startOfWeek(cursor);
  const todayD    = today();
  const days      = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fuForDay = (d) =>
    followUps.filter((fu) => {
      if (agentFilter !== "all" && fu.agentId !== agentFilter) return false;
      const ts = fu.scheduledAt?.toDate ? fu.scheduledAt.toDate() : null;
      return ts && sameDay(ts, d);
    }).sort((a, b) => (a.scheduledAt?.seconds || 0) - (b.scheduledAt?.seconds || 0));

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", minWidth: "700px" }}>
        {days.map((d, idx) => {
          const isToday = sameDay(d, todayD);
          const dayFus  = fuForDay(d);

          return (
            <div
              key={idx}
              style={{
                borderRight: idx < 6 ? `1px solid ${COLORS.border}` : "none",
                minHeight: "500px",
              }}
            >
              {/* Day header */}
              <div
                style={{
                  padding: `${SPACING.md} ${SPACING.sm}`,
                  textAlign: "center",
                  borderBottom: `1px solid ${COLORS.border}`,
                  backgroundColor: isToday ? COLORS.primaryMuted + "55" : COLORS.surfaceActive,
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>{DAY_NAMES_SHORT[d.getDay()]}</div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    margin: "4px auto 0",
                    backgroundColor: isToday ? COLORS.primary : "transparent",
                    fontSize: FONTS.size.lg,
                    fontWeight: FONTS.weight.bold,
                    color: isToday ? COLORS.textInverse : COLORS.textPrimary,
                  }}
                >
                  {d.getDate()}
                </div>
                {dayFus.length > 0 && (
                  <div style={{ fontSize: "10px", color: isToday ? COLORS.accent : COLORS.textMuted, marginTop: "2px" }}>
                    {dayFus.length} item{dayFus.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>

              {/* Follow-ups */}
              <div style={{ padding: SPACING.xs }}>
                {dayFus.length === 0 ? (
                  <div style={{ textAlign: "center", paddingTop: SPACING.xl, fontSize: "10px", color: COLORS.textMuted }}>—</div>
                ) : (
                  dayFus.map((fu) => {
                    const status = resolveStatus(fu);
                    const meta   = STATUS_META[status];
                    return (
                      <div
                        key={fu.id}
                        onClick={() => onFuClick(fu)}
                        style={{
                          backgroundColor: meta.bg,
                          border: `1px solid ${meta.color}44`,
                          borderLeft: `3px solid ${meta.color}`,
                          borderRadius: RADIUS.sm,
                          padding: `${SPACING.sm} ${SPACING.xs}`,
                          marginBottom: SPACING.xs,
                          cursor: "pointer",
                          transition: TRANSITIONS.fast,
                        }}
                      >
                        <div style={{ fontSize: "11px", fontWeight: FONTS.weight.semibold, color: meta.color }}>
                          {fmtTime(fu.scheduledAt)}
                        </div>
                        <div style={{ fontSize: "11px", color: COLORS.textPrimary, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {fu.leadName || "Lead"}
                        </div>
                        <div style={{ fontSize: "10px", color: COLORS.textMuted, marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {fu.agentName || ""}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Day View ─────────────────────────────────────────────────────────────────

const DayView = ({ cursor, followUps, onFuClick, agentFilter, agentMap }) => {
  const todayD = today();
  const isToday = sameDay(cursor, todayD);

  const dayFus = followUps
    .filter((fu) => {
      if (agentFilter !== "all" && fu.agentId !== agentFilter) return false;
      const ts = fu.scheduledAt?.toDate ? fu.scheduledAt.toDate() : null;
      return ts && sameDay(ts, cursor);
    })
    .sort((a, b) => (a.scheduledAt?.seconds || 0) - (b.scheduledAt?.seconds || 0));

  if (dayFus.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: SPACING.base, color: COLORS.textMuted }}>
        <div style={{ fontSize: "40px" }}>📅</div>
        <div style={{ fontSize: FONTS.size.base }}>
          {isToday ? "No follow-ups scheduled for today" : "No follow-ups on this day"}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: `0 ${SPACING["2xl"]} ${SPACING["2xl"]}` }}>
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        {dayFus.map((fu, idx) => {
          const status = resolveStatus(fu);
          const meta   = STATUS_META[status];
          const timeStr = fmtTime(fu.scheduledAt);

          return (
            <div
              key={fu.id}
              onClick={() => onFuClick(fu)}
              style={{
                display: "flex",
                gap: SPACING.base,
                marginBottom: SPACING.base,
                cursor: "pointer",
              }}
            >
              {/* Time column */}
              <div style={{ width: "56px", flexShrink: 0, textAlign: "right" }}>
                <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.semibold, color: COLORS.textMuted, paddingTop: SPACING.md, fontFamily: FONTS.mono }}>
                  {timeStr || "—"}
                </div>
              </div>

              {/* Timeline line */}
              <div style={{ width: "2px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: meta.color, border: `2px solid ${COLORS.surface}`, zIndex: 1, marginTop: SPACING.base + 3, flexShrink: 0 }} />
                {idx < dayFus.length - 1 && (
                  <div style={{ flex: 1, width: "2px", backgroundColor: COLORS.border, marginTop: "4px" }} />
                )}
              </div>

              {/* Card */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: meta.bg,
                  border: `1px solid ${meta.color}44`,
                  borderLeft: `4px solid ${meta.color}`,
                  borderRadius: RADIUS.md,
                  padding: SPACING.base,
                  marginBottom: idx < dayFus.length - 1 ? SPACING.sm : 0,
                  transition: TRANSITIONS.base,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: SPACING.sm }}>
                  <div>
                    <div style={{ fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary }}>
                      {fu.leadName || "Unnamed Lead"}
                    </div>
                    <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginTop: "2px" }}>
                      Agent: {agentMap[fu.agentId] || "—"}
                    </div>
                    {fu.note && (
                      <div style={{ fontSize: FONTS.size.sm, color: COLORS.textMuted, marginTop: SPACING.xs, fontStyle: "italic" }}>
                        "{fu.note}"
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      ...STYLES.badge,
                      backgroundColor: meta.bg,
                      color: meta.color,
                      border: `1px solid ${meta.color}44`,
                      fontSize: FONTS.size.xs,
                      flexShrink: 0,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const FollowUpCalendar = () => {
  const { currentUser, companyId } = useAuth();

  const [followUps, setFollowUps] = useState([]);
  const [agents, setAgents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const [view, setView]           = useState("Month");
  const [cursor, setCursor]       = useState(today()); // date the calendar is "at"
  const [agentFilter, setAgentFilter] = useState("all");
  const [selectedFu, setSelectedFu]   = useState(null);

  // ─── Fetch ───────────────────────────────────────────────────────────────
  // Fetch a 3-month window (prev, current, next) so navigation feels instant

  const fetchAll = useCallback(async () => {
    if (!currentUser?.uid || !companyId) return;
    try {
      setLoading(true);
      const uid = currentUser.uid;

      // Agents
      const agentsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.USERS),
          where("managerId", "==", uid),
          where("companyId", "==", companyId)
        )
      );
      const fetchedAgents = agentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAgents(fetchedAgents);

      // Date window: 45 days back to 90 days ahead
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - 45);
      windowStart.setHours(0, 0, 0, 0);

      const windowEnd = new Date();
      windowEnd.setDate(windowEnd.getDate() + 90);
      windowEnd.setHours(23, 59, 59, 999);

      // Follow-ups
      const fuSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.FOLLOW_UPS),
          where("managerId", "==", uid),
          where("companyId", "==", companyId),
          where("scheduledAt", ">=", Timestamp.fromDate(windowStart)),
          where("scheduledAt", "<=", Timestamp.fromDate(windowEnd))
        )
      );
      const fetchedFus = fuSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setFollowUps(fetchedFus);
    } catch (err) {
      console.error("FollowUpCalendar fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid, companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Navigation ───────────────────────────────────────────────────────────

  const navigate = (dir) => {
    setCursor((prev) => {
      const d = new Date(prev);
      if (view === "Day")   d.setDate(d.getDate() + dir);
      if (view === "Week")  d.setDate(d.getDate() + dir * 7);
      if (view === "Month") d.setMonth(d.getMonth() + dir);
      return d;
    });
  };

  const goToday = () => setCursor(today());

  // ─── Derived ─────────────────────────────────────────────────────────────

  const agentMap = useMemo(() => {
    const m = {};
    agents.forEach((a) => { m[a.id] = a.displayName || a.email || "Agent"; });
    return m;
  }, [agents]);

  // Summary stats
  const now         = new Date();
  const todayD      = today();
  const overdueAll  = followUps.filter((fu) => {
    const ts = fu.scheduledAt?.toDate ? fu.scheduledAt.toDate() : null;
    return ts && ts < now && fu.status !== "completed";
  });
  const dueToday    = followUps.filter((fu) => {
    const ts = fu.scheduledAt?.toDate ? fu.scheduledAt.toDate() : null;
    return ts && sameDay(ts, todayD);
  });
  const completedToday = dueToday.filter((fu) => fu.status === "completed");

  // Cursor label
  const cursorLabel = (() => {
    if (view === "Day")   return fmtDayFull(cursor);
    if (view === "Week")  return fmtWeekRange(cursor);
    if (view === "Month") return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
  })();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${COLORS.scrollbarTrack}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.scrollbarThumb}; border-radius: 3px; }
      `}</style>

      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: COLORS.background,
          fontFamily: FONTS.family,
          color: COLORS.textPrimary,
          overflow: "hidden",
        }}
      >
        {/* ── Top bar ── */}
        <div
          style={{
            padding: `${SPACING.base} ${SPACING["2xl"]}`,
            borderBottom: `1px solid ${COLORS.border}`,
            backgroundColor: COLORS.surface,
            display: "flex",
            alignItems: "center",
            gap: SPACING.base,
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          {/* Page title */}
          <div style={{ marginRight: SPACING.base }}>
            <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Manager</div>
            <div style={{ fontSize: FONTS.size.xl, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, lineHeight: 1.2 }}>
              Follow-up Calendar
            </div>
          </div>

          {/* Stats pills */}
          {!loading && (
            <>
              {[
                { label: "Due Today",  value: dueToday.length,         color: COLORS.accent  },
                { label: "Completed",  value: completedToday.length,   color: COLORS.success },
                { label: "Overdue",    value: overdueAll.length,        color: overdueAll.length > 0 ? COLORS.danger : COLORS.textMuted },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: SPACING.xs,
                    backgroundColor: COLORS.surfaceActive,
                    borderRadius: RADIUS.full,
                    padding: `${SPACING.xs} ${SPACING.md}`,
                    fontSize: FONTS.size.sm,
                  }}
                >
                  <span style={{ fontWeight: FONTS.weight.bold, color }}>{value}</span>
                  <span style={{ color: COLORS.textMuted }}>{label}</span>
                </div>
              ))}
            </>
          )}

          <div style={{ flex: 1 }} />

          {/* Agent filter */}
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            style={{
              ...STYLES.input,
              width: "auto",
              padding: `${SPACING.xs} ${SPACING.md}`,
              fontSize: FONTS.size.sm,
              cursor: "pointer",
            }}
          >
            <option value="all">All Agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.displayName || a.email || "Agent"}</option>
            ))}
          </select>

          {/* View toggle */}
          <div
            style={{
              display: "flex",
              backgroundColor: COLORS.surfaceActive,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.base,
              overflow: "hidden",
            }}
          >
            {VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: `${SPACING.xs} ${SPACING.md}`,
                  fontSize: FONTS.size.sm,
                  fontFamily: FONTS.family,
                  cursor: "pointer",
                  border: "none",
                  backgroundColor: view === v ? COLORS.primaryMuted : "transparent",
                  color: view === v ? COLORS.primary : COLORS.textSecondary,
                  fontWeight: view === v ? FONTS.weight.semibold : FONTS.weight.regular,
                  transition: TRANSITIONS.fast,
                }}
              >
                {v}
              </button>
            ))}
          </div>

          <button
            onClick={fetchAll}
            style={{ ...STYLES.buttonSecondary, fontSize: FONTS.size.sm, padding: `${SPACING.xs} ${SPACING.md}` }}
          >
            ↻
          </button>
        </div>

        {/* ── Calendar nav bar ── */}
        <div
          style={{
            padding: `${SPACING.sm} ${SPACING["2xl"]}`,
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            gap: SPACING.base,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              ...STYLES.buttonSecondary,
              padding: `${SPACING.xs} ${SPACING.md}`,
              fontSize: FONTS.size.base,
            }}
          >
            ‹
          </button>
          <button
            onClick={() => navigate(1)}
            style={{
              ...STYLES.buttonSecondary,
              padding: `${SPACING.xs} ${SPACING.md}`,
              fontSize: FONTS.size.base,
            }}
          >
            ›
          </button>

          <div
            style={{
              fontSize: FONTS.size.xl,
              fontWeight: FONTS.weight.semibold,
              color: COLORS.textPrimary,
              flex: 1,
            }}
          >
            {cursorLabel}
          </div>

          <button
            onClick={goToday}
            style={{
              ...STYLES.buttonSecondary,
              padding: `${SPACING.xs} ${SPACING.md}`,
              fontSize: FONTS.size.sm,
              backgroundColor: sameDay(cursor, today()) ? COLORS.primaryMuted : "transparent",
              color: sameDay(cursor, today()) ? COLORS.primary : COLORS.textSecondary,
              borderColor: sameDay(cursor, today()) ? COLORS.primary : COLORS.border,
            }}
          >
            Today
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ backgroundColor: COLORS.dangerMuted, border: `1px solid ${COLORS.danger}`, borderRadius: RADIUS.md, padding: SPACING.base, color: COLORS.danger, fontSize: FONTS.size.sm, margin: SPACING.base }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Calendar body ── */}
        {loading ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: SPACING.sm, padding: SPACING.xl }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: SPACING.sm }}>
              {Array.from({ length: 7 }).map((_, i) => <Shimmer key={i} height="32px" />)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: SPACING.sm, flex: 1 }}>
              {Array.from({ length: 35 }).map((_, i) => <Shimmer key={i} height="80px" />)}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: view === "Day" ? `${SPACING.xl} 0 0` : 0 }}>
            {view === "Month" && (
              <MonthView
                cursor={cursor}
                followUps={followUps}
                onFuClick={setSelectedFu}
                agentFilter={agentFilter}
                agentMap={agentMap}
              />
            )}
            {view === "Week" && (
              <WeekView
                cursor={cursor}
                followUps={followUps}
                onFuClick={setSelectedFu}
                agentFilter={agentFilter}
              />
            )}
            {view === "Day" && (
              <DayView
                cursor={cursor}
                followUps={followUps}
                onFuClick={setSelectedFu}
                agentFilter={agentFilter}
                agentMap={agentMap}
              />
            )}
          </div>
        )}

        {/* ── Legend ── */}
        <div
          style={{
            padding: `${SPACING.sm} ${SPACING["2xl"]}`,
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex",
            gap: SPACING.xl,
            flexShrink: 0,
            backgroundColor: COLORS.surface,
          }}
        >
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: SPACING.xs }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "2px", backgroundColor: meta.color }} />
              <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>{meta.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Follow-up detail drawer ── */}
      {selectedFu && (
        <DetailDrawer
          fu={selectedFu}
          onClose={() => setSelectedFu(null)}
          agentMap={agentMap}
        />
      )}
    </>
  );
};

export default FollowUpCalendar;
