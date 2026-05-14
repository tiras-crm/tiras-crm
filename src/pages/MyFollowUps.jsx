// ─────────────────────────────────────────────────────────────────────────────
// TIRAS CRM — MyFollowUps
// File: src/pages/MyFollowUps.jsx
//
// HOW TO USE:
//   In src/pages/index.js replace:
//     export const MyFollowUps = () => <Placeholder name="My Follow-ups" />;
//   with the full contents of this file.
//
// ROUTE: /agent/followups
//
// FIRESTORE:
//   Real-time onSnapshot on followups
//   where agentId == currentUser.uid AND companyId == companyId
//   orderBy scheduledAt asc
//   Writes: updateDoc to mark done / reschedule
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
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

const STYLE_ID = "tiras-followups-styles";
const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const tag = document.createElement("style");
  tag.id = STYLE_ID;
  tag.textContent = `
    @keyframes tiras-fade-up   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes tiras-spin      { to{transform:rotate(360deg)} }
    @keyframes tiras-row-in    { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
    @keyframes tiras-done-out  { from{opacity:1;max-height:120px;margin-bottom:0} to{opacity:0;max-height:0;margin-bottom:-1px} }
    @keyframes tiras-pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.3} }
    @keyframes tiras-modal-bg  { from{opacity:0} to{opacity:1} }
    @keyframes tiras-modal-pop { from{opacity:0;transform:scale(0.94) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes tiras-toast-in  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  `;
  document.head.appendChild(tag);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayMidnight = () => {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
};
const tomorrowMidnight = () => {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); return d;
};
const endOfToday = () => {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d;
};

const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

const fmtDate = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};

const fmtFull = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const isoDate = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 10);
};

const isoTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toTimeString().slice(0, 5);
};

// Group followups into buckets
const bucket = (fu) => {
  const d = fu.scheduledAt?.toDate?.();
  if (!d) return "upcoming";
  if (fu.status === "done")     return "done";
  if (d < todayMidnight())      return "overdue";
  if (d <= endOfToday())        return "today";
  if (d < tomorrowMidnight())   return "today"; // edge
  return "upcoming";
};

// ─── Style objects ────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100%",
    backgroundColor: COLORS.background,
    fontFamily: FONTS.family,
    padding: SPACING["2xl"],
  },

  // Header
  pageHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: SPACING["2xl"],
    flexWrap: "wrap",
    gap: SPACING.base,
    animation: "tiras-fade-up 0.3s ease both",
  },
  pageTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size["3xl"],
    fontWeight: FONTS.weight.bold,
    letterSpacing: "-0.01em",
    marginBottom: "3px",
  },
  pageSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.base,
  },

  // Filter bar
  filterBar: {
    display: "flex",
    gap: SPACING.sm,
    marginBottom: SPACING["2xl"],
    flexWrap: "wrap",
    animation: "tiras-fade-up 0.3s ease 50ms both",
  },
  filterTab: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.full,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    padding: `${SPACING.xs} ${SPACING.lg}`,
    cursor: "pointer",
    transition: TRANSITIONS.fast,
    display: "flex",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: "transparent",
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    color: "#121212",
    fontWeight: FONTS.weight.bold,
    boxShadow: SHADOWS.primary,
  },
  filterTabCount: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    padding: "0px 5px",
    borderRadius: RADIUS.full,
    lineHeight: "1.6",
  },

  // Stats row
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: SPACING.base,
    marginBottom: SPACING["2xl"],
    animation: "tiras-fade-up 0.3s ease 80ms both",
  },
  statCard: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    position: "relative",
    overflow: "hidden",
  },
  statAccent: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: "2px",
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    fontWeight: FONTS.weight.semibold,
    marginBottom: SPACING.xs,
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size["3xl"],
    fontWeight: FONTS.weight.bold,
    lineHeight: 1,
  },

  // Section heading
  sectionHeading: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.base,
    marginTop: SPACING.xl,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.bold,
  },
  sectionCount: {
    backgroundColor: COLORS.surfaceActive,
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    padding: "1px 7px",
    borderRadius: RADIUS.full,
    lineHeight: "1.7",
  },

  // Follow-up card
  fuCard: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    marginBottom: SPACING.sm,
    transition: TRANSITIONS.base,
    animation: "tiras-row-in 0.2s ease both",
    boxShadow: SHADOWS.sm,
  },
  fuCardHover: {
    borderColor: `${COLORS.primary}40`,
    boxShadow: `0 4px 16px ${COLORS.primary}10`,
  },
  fuCardOverdue: {
    borderColor: `${COLORS.danger}35`,
    backgroundColor: `${COLORS.danger}04`,
  },
  fuCardDone: {
    opacity: 0.5,
  },

  fuRow: {
    display: "flex",
    alignItems: "center",
    padding: `${SPACING.md} ${SPACING.xl}`,
    gap: SPACING.md,
  },

  // Left: colour indicator
  fuIndicator: {
    width: "3px",
    alignSelf: "stretch",
    borderRadius: RADIUS.full,
    flexShrink: 0,
    minHeight: "48px",
  },

  // Time column
  fuTimeCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1px",
    minWidth: "56px",
    flexShrink: 0,
  },
  fuTimeMain: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.bold,
    fontFamily: FONTS.mono,
    lineHeight: 1.2,
  },
  fuTimeDate: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  },

  // Body
  fuBody: {
    flex: 1,
    minWidth: 0,
  },
  fuLeadName: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.semibold,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginBottom: "2px",
  },
  fuNote: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  // Tags
  fuTagRow: {
    display: "flex",
    gap: SPACING.xs,
    marginTop: "4px",
    flexWrap: "wrap",
  },
  fuTag: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    padding: "1px 7px",
    borderRadius: RADIUS.full,
  },

  // Actions column
  fuActions: {
    display: "flex",
    gap: SPACING.xs,
    flexShrink: 0,
  },
  actionBtn: {
    background: "none",
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.base,
    cursor: "pointer",
    padding: "6px 10px",
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontFamily: FONTS.family,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textSecondary,
    transition: TRANSITIONS.fast,
    whiteSpace: "nowrap",
  },

  // Empty state
  emptyState: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    padding: `${SPACING["3xl"]} ${SPACING.xl}`,
    textAlign: "center",
    color: COLORS.textMuted,
  },
  emptyIcon: { fontSize: "36px", marginBottom: SPACING.md, opacity: 0.4 },
  emptyTitle: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.semibold,
    marginBottom: SPACING.xs,
  },

  // Loading
  loadingWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: `${SPACING["5xl"]} ${SPACING.xl}`,
    gap: SPACING.sm,
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
  },
  spinner: {
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    border: `2px solid ${COLORS.border}`,
    borderTopColor: COLORS.primary,
    animation: "tiras-spin 0.7s linear infinite",
    flexShrink: 0,
  },

  // Reschedule modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: SPACING.base,
    animation: "tiras-modal-bg 0.2s ease both",
  },
  modal: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.xl,
    boxShadow: SHADOWS.lg,
    width: "100%",
    maxWidth: "420px",
    animation: "tiras-modal-pop 0.25s ease both",
    overflow: "hidden",
  },
  modalHeader: {
    padding: `${SPACING.xl} ${SPACING["2xl"]} ${SPACING.base}`,
    borderBottom: `1px solid ${COLORS.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
  },
  modalCloseBtn: {
    background: "none",
    border: "none",
    color: COLORS.textMuted,
    cursor: "pointer",
    fontSize: "20px",
    lineHeight: 1,
    padding: "2px",
  },
  modalBody: { padding: SPACING["2xl"] },
  modalFooter: {
    padding: `${SPACING.base} ${SPACING["2xl"]} ${SPACING.xl}`,
    display: "flex",
    gap: SPACING.sm,
    justifyContent: "flex-end",
  },
  modalLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    marginBottom: SPACING.xs,
    display: "block",
    letterSpacing: "0.02em",
  },
  modalInput: {
    backgroundColor: COLORS.inputBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    padding: `${SPACING.sm} ${SPACING.md}`,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    marginBottom: SPACING.base,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    color: "#121212",
    border: "none",
    borderRadius: RADIUS.md,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
    padding: `${SPACING.sm} ${SPACING.xl}`,
    cursor: "pointer",
    transition: TRANSITIONS.base,
    boxShadow: SHADOWS.primary,
  },
  btnSecondary: {
    backgroundColor: "transparent",
    color: COLORS.textSecondary,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    padding: `${SPACING.sm} ${SPACING.xl}`,
    cursor: "pointer",
    transition: TRANSITIONS.base,
  },

  // Toast
  toast: {
    position: "fixed",
    bottom: SPACING["2xl"],
    right: SPACING["2xl"],
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    padding: `${SPACING.md} ${SPACING.xl}`,
    color: COLORS.textPrimary,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    boxShadow: SHADOWS.lg,
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    gap: SPACING.sm,
    animation: "tiras-toast-in 0.3s ease both",
    maxWidth: "320px",
  },
};

// ─── SVG icons ────────────────────────────────────────────────────────────────

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const PhoneIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const EyeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// FollowUpCard — single follow-up row
// ─────────────────────────────────────────────────────────────────────────────

const FollowUpCard = ({ fu, onDone, onReschedule, onCallNow, onViewLead, animDelay }) => {
  const [hovered, setHovered] = useState(false);
  const [doneExiting, setDoneExiting] = useState(false);

  const isOverdue = bucket(fu) === "overdue";
  const isDone    = fu.status === "done";
  const isToday   = bucket(fu) === "today";

  const indicatorColor = isDone    ? COLORS.success
                       : isOverdue ? COLORS.danger
                       : isToday   ? COLORS.accent
                       : COLORS.primary;

  const handleDone = () => {
    setDoneExiting(true);
    setTimeout(() => onDone(fu.id), 320);
  };

  return (
    <div
      style={{
        ...S.fuCard,
        ...(hovered && !isDone ? S.fuCardHover : {}),
        ...(isOverdue ? S.fuCardOverdue : {}),
        ...(isDone    ? S.fuCardDone    : {}),
        animationDelay: `${animDelay}ms`,
        ...(doneExiting ? { animation: "tiras-done-out 0.32s ease forwards", overflow: "hidden" } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={S.fuRow}>
        {/* Coloured left bar */}
        <div style={{ ...S.fuIndicator, backgroundColor: indicatorColor }} />

        {/* Time */}
        <div style={S.fuTimeCol}>
          <div style={{ ...S.fuTimeMain, color: indicatorColor }}>
            {fmtTime(fu.scheduledAt)}
          </div>
          <div style={S.fuTimeDate}>
            {fmtDate(fu.scheduledAt)}
          </div>
        </div>

        {/* Content */}
        <div style={S.fuBody}>
          <div style={S.fuLeadName}>{fu.leadName ?? "—"}</div>
          {fu.note && <div style={S.fuNote}>{fu.note}</div>}
          <div style={S.fuTagRow}>
            {isOverdue && (
              <span style={{ ...S.fuTag, color: COLORS.danger, backgroundColor: `${COLORS.danger}18` }}>
                Overdue
              </span>
            )}
            {isDone && (
              <span style={{ ...S.fuTag, color: COLORS.success, backgroundColor: `${COLORS.success}18` }}>
                ✓ Done
              </span>
            )}
            {isToday && !isDone && (
              <span style={{
                ...S.fuTag,
                color: COLORS.accent,
                backgroundColor: `${COLORS.accent}18`,
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}>
                <span style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  backgroundColor: COLORS.accent,
                  animation: "tiras-pulse-dot 1.5s ease infinite",
                  display: "inline-block",
                }} />
                Today
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isDone && (
          <div style={S.fuActions}>
            {/* View lead */}
            {fu.leadId && (
              <button
                style={S.actionBtn}
                title="View lead"
                onClick={() => onViewLead(fu.leadId)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${COLORS.info}60`; e.currentTarget.style.color = COLORS.info; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.textSecondary; }}
              >
                <EyeIcon />
              </button>
            )}

            {/* Call now */}
            {fu.leadId && (
              <button
                style={S.actionBtn}
                title="Call now"
                onClick={() => onCallNow(fu)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${COLORS.success}60`; e.currentTarget.style.color = COLORS.success; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.textSecondary; }}
              >
                <PhoneIcon />
              </button>
            )}

            {/* Reschedule */}
            <button
              style={S.actionBtn}
              title="Reschedule"
              onClick={() => onReschedule(fu)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${COLORS.warning}60`; e.currentTarget.style.color = COLORS.warning; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.textSecondary; }}
            >
              <ClockIcon />
              <span>Reschedule</span>
            </button>

            {/* Mark done */}
            <button
              style={S.actionBtn}
              title="Mark as done"
              onClick={handleDone}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${COLORS.success}60`; e.currentTarget.style.color = COLORS.success; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.textSecondary; }}
            >
              <CheckIcon />
              <span>Done</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MyFollowUps Component
// ─────────────────────────────────────────────────────────────────────────────

export const MyFollowUps = () => {
  const { currentUser, companyId } = useAuth();
  const navigate = useNavigate();

  // ─── Data state ─────────────────────────────────────────────────────────────
  const [followups, setFollowups] = useState(null);

  // ─── UI state ───────────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState("pending"); // pending | overdue | today | done | all
  const [rescheduleTarget, setRescheduleTarget] = useState(null); // fu doc being rescheduled
  const [reDate,  setReDate]  = useState("");
  const [reTime,  setReTime]  = useState("");
  const [reNote,  setReNote]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState(null);
  const toastRef = useRef(null);

  // ─── Style helpers ───────────────────────────────────────────────────────────
  const showToast = (msg, color = COLORS.success) => {
    clearTimeout(toastRef.current);
    setToast({ msg, color });
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  // ─── Firestore real-time listener ───────────────────────────────────────────
  useEffect(() => {
    injectStyles();
    if (!currentUser || !companyId) return;

    const q = query(
      collection(db, COLLECTIONS.FOLLOW_UPS),
      where("agentId",   "==", currentUser.uid),
      where("companyId", "==", companyId),
      orderBy("scheduledAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setFollowups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("MyFollowUps snapshot error:", err);
    });

    return () => unsub();
  }, [currentUser, companyId]);

  // ─── Counts for filter tabs ─────────────────────────────────────────────────
  const counts = useMemo(() => {
    if (!followups) return {};
    const pending  = followups.filter((f) => f.status === "pending").length;
    const overdue  = followups.filter((f) => bucket(f) === "overdue").length;
    const today    = followups.filter((f) => bucket(f) === "today").length;
    const done     = followups.filter((f) => f.status === "done").length;
    return { pending, overdue, today, done, all: followups.length };
  }, [followups]);

  // ─── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!followups) return [];
    switch (activeFilter) {
      case "overdue":  return followups.filter((f) => bucket(f) === "overdue");
      case "today":    return followups.filter((f) => bucket(f) === "today");
      case "done":     return followups.filter((f) => f.status === "done");
      case "all":      return followups;
      default:         return followups.filter((f) => f.status === "pending");
    }
  }, [followups, activeFilter]);

  // ─── Group pending by date ───────────────────────────────────────────────────
  const grouped = useMemo(() => {
    if (activeFilter === "done" || activeFilter === "all") return null;
    const groups = {};
    filtered.forEach((fu) => {
      const key = isoDate(fu.scheduledAt) || "unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(fu);
    });
    return groups;
  }, [filtered, activeFilter]);

  // ─── Mark done ──────────────────────────────────────────────────────────────
  const handleDone = async (fuId) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.FOLLOW_UPS, fuId), {
        status:      "done",
        completedAt: serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
      showToast("Follow-up marked as done ✓");
    } catch (err) {
      console.error("TIRAS: Could not mark done", err);
      showToast("Could not update. Try again.", COLORS.danger);
    }
  };

  // ─── Open reschedule modal ───────────────────────────────────────────────────
  const openReschedule = (fu) => {
    setRescheduleTarget(fu);
    setReDate(isoDate(fu.scheduledAt) || "");
    setReTime(isoTime(fu.scheduledAt) || "");
    setReNote(fu.note || "");
  };

  // ─── Save reschedule ─────────────────────────────────────────────────────────
  const handleReschedule = async () => {
    if (!reDate || !reTime || !rescheduleTarget) return;
    setSaving(true);
    try {
      const { Timestamp } = await import("firebase/firestore");
      const newDate = new Date(`${reDate}T${reTime}`);
      await updateDoc(doc(db, COLLECTIONS.FOLLOW_UPS, rescheduleTarget.id), {
        scheduledAt: Timestamp.fromDate(newDate),
        note:        reNote.trim(),
        status:      "pending",
        updatedAt:   serverTimestamp(),
      });
      // Also update lead's nextFollowupAt
      if (rescheduleTarget.leadId) {
        await updateDoc(doc(db, COLLECTIONS.LEADS, rescheduleTarget.leadId), {
          nextFollowupAt: Timestamp.fromDate(newDate),
          updatedAt:      serverTimestamp(),
        });
      }
      setRescheduleTarget(null);
      showToast("Follow-up rescheduled");
    } catch (err) {
      console.error("TIRAS: Reschedule failed", err);
      showToast("Could not reschedule. Try again.", COLORS.danger);
    } finally {
      setSaving(false);
    }
  };

  // ─── Navigation helpers ──────────────────────────────────────────────────────
  const handleCallNow = (fu) => {
    navigate("/agent/call", {
      state: {
        lead: { id: fu.leadId, name: fu.leadName, phone: fu.leadPhone ?? null },
      },
    });
  };

  const handleViewLead = (leadId) => navigate(`/agent/lead/${leadId}`);

  // ─── Render date group label ─────────────────────────────────────────────────
  const dateLabel = (isoKey) => {
    if (isoKey === "unknown") return "Unscheduled";
    const d = new Date(isoKey + "T00:00:00");
    const today    = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0,0,0,0);
    if (d.getTime() === today.getTime())    return "Today";
    if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
    if (d < today) return `Overdue — ${d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}`;
    return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  };

  const FILTERS = [
    { key: "pending",  label: "Pending",  color: COLORS.primary },
    { key: "overdue",  label: "Overdue",  color: COLORS.danger  },
    { key: "today",    label: "Today",    color: COLORS.accent  },
    { key: "done",     label: "Done",     color: COLORS.success },
    { key: "all",      label: "All",      color: COLORS.textMuted },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>My Follow-ups</div>
          <div style={S.pageSubtitle}>
            {followups !== null
              ? `${counts.pending ?? 0} pending · ${counts.overdue ?? 0} overdue`
              : "Loading…"}
          </div>
        </div>
      </div>

      {/* Stats row */}
      {followups !== null && (
        <div style={S.statsRow}>
          {[
            { label: "Pending",  value: counts.pending,  color: COLORS.primary },
            { label: "Overdue",  value: counts.overdue,  color: COLORS.danger  },
            { label: "Due Today",value: counts.today,    color: COLORS.accent  },
            { label: "Done",     value: counts.done,     color: COLORS.success },
          ].map(({ label, value, color }) => (
            <div key={label} style={S.statCard}>
              <div style={{ ...S.statAccent, backgroundColor: color }} />
              <div style={S.statLabel}>{label}</div>
              <div style={{ ...S.statValue, color }}>{value ?? 0}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div style={S.filterBar}>
        {FILTERS.map(({ key, label, color }) => {
          const isActive = activeFilter === key;
          const count    = counts[key] ?? 0;
          return (
            <button
              key={key}
              style={{
                ...S.filterTab,
                ...(isActive
                  ? { ...S.filterTabActive, backgroundColor: color, borderColor: color }
                  : { color: COLORS.textSecondary }),
              }}
              onClick={() => setActiveFilter(key)}
            >
              {label}
              {count > 0 && (
                <span style={{
                  ...S.filterTabCount,
                  backgroundColor: isActive ? "rgba(0,0,0,0.2)" : COLORS.surfaceActive,
                  color:           isActive ? "#121212" : COLORS.textMuted,
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {followups === null ? (
        <div style={S.loadingWrap}>
          <div style={S.spinner} />
          <span>Loading follow-ups…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={S.emptyState}>
          <div style={S.emptyIcon}>
            {activeFilter === "done" ? "✅" : activeFilter === "overdue" ? "⏰" : "📅"}
          </div>
          <div style={S.emptyTitle}>
            {activeFilter === "done"    ? "No completed follow-ups yet"    :
             activeFilter === "overdue" ? "No overdue follow-ups — great!" :
             activeFilter === "today"   ? "Nothing due today"              :
             "No follow-ups scheduled"}
          </div>
          <div style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm, marginTop: SPACING.xs }}>
            {activeFilter === "pending" && "Open a lead and schedule a follow-up from the lead detail page."}
          </div>
        </div>
      ) : grouped ? (
        // ── Grouped by date (pending / overdue / today) ─────────────────────
        Object.entries(grouped)
          .sort(([a], [b]) => new Date(a) - new Date(b))
          .map(([dateKey, items]) => {
            const label    = dateLabel(dateKey);
            const isOD     = label.startsWith("Overdue");
            return (
              <div key={dateKey}>
                <div style={S.sectionHeading}>
                  <div style={{
                    width: "8px", height: "8px", borderRadius: "50%",
                    backgroundColor: isOD ? COLORS.danger : COLORS.primary,
                    flexShrink: 0,
                  }} />
                  <span style={{ ...S.sectionTitle, color: isOD ? COLORS.danger : COLORS.textPrimary }}>
                    {label}
                  </span>
                  <span style={S.sectionCount}>{items.length}</span>
                </div>
                {items.map((fu, idx) => (
                  <FollowUpCard
                    key={fu.id}
                    fu={fu}
                    onDone={handleDone}
                    onReschedule={openReschedule}
                    onCallNow={handleCallNow}
                    onViewLead={handleViewLead}
                    animDelay={idx * 30}
                  />
                ))}
              </div>
            );
          })
      ) : (
        // ── Flat list (all / done) ──────────────────────────────────────────
        filtered.map((fu, idx) => (
          <FollowUpCard
            key={fu.id}
            fu={fu}
            onDone={handleDone}
            onReschedule={openReschedule}
            onCallNow={handleCallNow}
            onViewLead={handleViewLead}
            animDelay={idx * 25}
          />
        ))
      )}

      {/* ── Reschedule modal ─────────────────────────────────────────────────── */}
      {rescheduleTarget && (
        <div style={S.modalOverlay} onClick={() => setRescheduleTarget(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <span style={S.modalTitle}>Reschedule Follow-up</span>
              <button style={S.modalCloseBtn} onClick={() => setRescheduleTarget(null)}>×</button>
            </div>
            <div style={S.modalBody}>
              {/* Lead name hint */}
              <div style={{
                backgroundColor: COLORS.surfaceActive,
                borderRadius: RADIUS.md,
                padding: `${SPACING.sm} ${SPACING.md}`,
                marginBottom: SPACING.base,
                color: COLORS.textSecondary,
                fontSize: FONTS.size.sm,
              }}>
                <strong style={{ color: COLORS.textPrimary }}>{rescheduleTarget.leadName}</strong>
                {rescheduleTarget.scheduledAt && (
                  <span style={{ color: COLORS.textMuted }}> · was {fmtFull(rescheduleTarget.scheduledAt)}</span>
                )}
              </div>

              <label style={S.modalLabel}>New Date</label>
              <input
                type="date"
                value={reDate}
                onChange={(e) => setReDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                style={S.modalInput}
              />

              <label style={S.modalLabel}>New Time</label>
              <input
                type="time"
                value={reTime}
                onChange={(e) => setReTime(e.target.value)}
                style={S.modalInput}
              />

              <label style={S.modalLabel}>Note (optional)</label>
              <input
                type="text"
                placeholder="What to discuss…"
                value={reNote}
                onChange={(e) => setReNote(e.target.value)}
                style={S.modalInput}
              />
            </div>
            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={() => setRescheduleTarget(null)}>
                Cancel
              </button>
              <button
                style={{ ...S.btnPrimary, opacity: saving || !reDate || !reTime ? 0.6 : 1 }}
                onClick={handleReschedule}
                disabled={saving || !reDate || !reTime}
              >
                {saving ? "Saving…" : "Reschedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, borderLeft: `3px solid ${toast.color}` }}>
          <span style={{ color: toast.color }}>{toast.color === COLORS.danger ? "✕" : "✓"}</span>
          {toast.msg}
        </div>
      )}

    </div>
  );
};

export default MyFollowUps;
