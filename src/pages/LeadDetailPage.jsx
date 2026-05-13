// ─────────────────────────────────────────────────────────────────────────────
// TIRAS CRM — LeadDetailPage
// File: src/pages/LeadDetailPage.jsx
//
// HOW TO USE:
//   In src/pages/index.js replace:
//     export const LeadDetailPage = () => <Placeholder name="Lead Detail Page" />;
//   with the full contents of this file.
//
// ROUTE: /agent/lead/:leadId
//
// FIRESTORE READS:
//   leads/{leadId}                                        — live lead doc
//   calls   where leadId == leadId, orderBy createdAt desc — call history
//   followups where leadId == leadId, orderBy scheduledAt desc
//   tickets  where leadId == leadId, orderBy createdAt desc
//   payments where leadId == leadId, orderBy createdAt desc
//   wa_templates where companyId == companyId            — WhatsApp templates
//
// FIRESTORE WRITES:
//   leads/{leadId}          — stage change, note add (via addDoc to sub-field)
//   followups               — create new follow-up
//   tickets                 — create new ticket
//   payments                — log payment link
//   calls/{callId}          — update outcome tag (agent can fix after call)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
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

const STYLE_ID = "tiras-lead-detail-styles";
const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const tag = document.createElement("style");
  tag.id = STYLE_ID;
  tag.textContent = `
    @keyframes tiras-fade-up      { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes tiras-spin         { to{transform:rotate(360deg)} }
    @keyframes tiras-slide-in     { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
    @keyframes tiras-modal-bg     { from{opacity:0} to{opacity:1} }
    @keyframes tiras-modal-pop    { from{opacity:0;transform:scale(0.94) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes tiras-toast-in     { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes tiras-toast-out    { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(12px)} }
  `;
  document.head.appendChild(tag);
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = ["New","Contacted","Interested","Follow-up","Negotiation","Closed Won","Closed Lost"];
const OUTCOMES = ["Interested","Not Interested","Call Back","No Answer","Wrong Number","Busy","Voicemail"];
const OBJECTION_TAGS = ["Price","Timing","Not Interested","Need More Info","Wrong Person","None"];

const STAGE_COLORS = {
  "New":         { text: COLORS.textMuted,  bg: `${COLORS.textMuted}18`  },
  "Contacted":   { text: COLORS.info,       bg: `${COLORS.info}18`       },
  "Interested":  { text: COLORS.accent,     bg: `${COLORS.accent}18`     },
  "Follow-up":   { text: COLORS.warning,    bg: `${COLORS.warning}18`    },
  "Negotiation": { text: COLORS.primary,    bg: `${COLORS.primary}18`    },
  "Closed Won":  { text: COLORS.success,    bg: `${COLORS.success}18`    },
  "Closed Lost": { text: COLORS.danger,     bg: `${COLORS.danger}18`     },
};

const SCORE_COLORS = {
  Hot:  { text: COLORS.hot  || "#FF4D4D", bg: `${COLORS.hot  || "#FF4D4D"}18`, dot: COLORS.hot  || "#FF4D4D" },
  Warm: { text: COLORS.warm || "#F2A65A", bg: `${COLORS.warm || "#F2A65A"}18`, dot: COLORS.warm || "#F2A65A" },
  Cold: { text: COLORS.info,              bg: `${COLORS.info}18`,              dot: COLORS.info             },
  Dead: { text: COLORS.textMuted,         bg: `${COLORS.textMuted}18`,         dot: COLORS.textMuted        },
};

const OUTCOME_COLORS = {
  "Interested":     COLORS.success,
  "Not Interested": COLORS.danger,
  "Call Back":      COLORS.accent,
  "No Answer":      COLORS.textMuted,
  "Wrong Number":   COLORS.textMuted,
  "Busy":           COLORS.warning,
  "Voicemail":      COLORS.info,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const fmtDateTime = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

const fmtDuration = (secs) => {
  if (!secs) return "0:00";
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
};

const timeAgo = (ts) => {
  if (!ts) return "";
  const d    = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return fmtDate(ts);
};

const whatsappUrl = (phone, msg) =>
  `https://wa.me/91${phone?.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;

// ─── Style objects ────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100%",
    backgroundColor: COLORS.background,
    fontFamily: FONTS.family,
    padding: SPACING["2xl"],
  },

  // Back row
  backRow: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.xs,
    marginBottom: SPACING.xl,
    animation: "tiras-fade-up 0.25s ease both",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: COLORS.textMuted,
    cursor: "pointer",
    fontFamily: FONTS.family,
    fontSize: FONTS.size.sm,
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: 0,
    transition: TRANSITIONS.fast,
  },

  // Two-column layout
  layout: {
    display: "grid",
    gridTemplateColumns: "380px 1fr",
    gap: SPACING.xl,
    alignItems: "flex-start",
  },

  // ── Left panel ────────────────────────────────────────────────────────────
  leftPanel: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.base,
    animation: "tiras-fade-up 0.3s ease 40ms both",
  },

  infoCard: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    boxShadow: SHADOWS.sm,
    overflow: "hidden",
  },

  infoCardHeader: {
    padding: `${SPACING.xl} ${SPACING.xl} ${SPACING.base}`,
    borderBottom: `1px solid ${COLORS.border}`,
  },

  leadName: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size["2xl"],
    fontWeight: FONTS.weight.bold,
    letterSpacing: "-0.01em",
    marginBottom: SPACING.sm,
  },

  badgeRow: {
    display: "flex",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },

  badge: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    padding: `2px ${SPACING.sm}`,
    borderRadius: RADIUS.full,
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
  },

  scoreDot: {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    flexShrink: 0,
  },

  infoBody: {
    padding: SPACING.xl,
  },

  infoRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: SPACING.md,
    marginBottom: SPACING.base,
  },

  infoIcon: {
    color: COLORS.textMuted,
    flexShrink: 0,
    marginTop: "1px",
  },

  infoLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: FONTS.weight.medium,
    marginBottom: "2px",
  },

  infoValue: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.medium,
    wordBreak: "break-word",
  },

  // Stage selector
  stageSelect: {
    backgroundColor: COLORS.inputBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.semibold,
    padding: `${SPACING.sm} ${SPACING.md}`,
    outline: "none",
    width: "100%",
    cursor: "pointer",
    transition: TRANSITIONS.fast,
  },

  // Deal value
  dealRow: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.sm,
    padding: `${SPACING.base} ${SPACING.xl}`,
    borderTop: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.surfaceActive,
  },

  dealLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    flex: 1,
  },

  dealValue: {
    color: COLORS.accent,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
  },

  // Action buttons panel
  actionsCard: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    display: "flex",
    flexDirection: "column",
    gap: SPACING.sm,
  },

  actionsLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    fontWeight: FONTS.weight.semibold,
    marginBottom: SPACING.xs,
  },

  actionBtn: {
    width: "100%",
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
    padding: `${SPACING.sm} ${SPACING.md}`,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: SPACING.sm,
    transition: TRANSITIONS.base,
    backgroundColor: "transparent",
    color: COLORS.textSecondary,
    textAlign: "left",
  },

  // ── Right panel: timeline ─────────────────────────────────────────────────
  rightPanel: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.base,
    animation: "tiras-fade-up 0.3s ease 80ms both",
  },

  // Tab bar
  tabBar: {
    display: "flex",
    gap: "2px",
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    padding: "4px",
  },

  tab: {
    flex: 1,
    border: "none",
    borderRadius: RADIUS.md,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    padding: `${SPACING.sm} ${SPACING.base}`,
    cursor: "pointer",
    transition: TRANSITIONS.fast,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
  },

  tabActive: {
    backgroundColor: COLORS.primary,
    color: "#121212",
    fontWeight: FONTS.weight.bold,
    boxShadow: SHADOWS.primary,
  },

  tabInactive: {
    backgroundColor: "transparent",
    color: COLORS.textMuted,
  },

  // Section card
  sectionCard: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${SPACING.base} ${SPACING.xl}`,
    borderBottom: `1px solid ${COLORS.border}`,
  },

  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.semibold,
  },

  // Timeline item
  timelineItem: {
    padding: `${SPACING.lg} ${SPACING.xl}`,
    borderBottom: `1px solid ${COLORS.border}`,
    position: "relative",
    animation: "tiras-slide-in 0.25s ease both",
  },

  timelineDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    position: "absolute",
    left: "17px",
    top: "22px",
  },

  timelineContent: {
    paddingLeft: SPACING.xl,
  },

  timelineHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: "6px",
    gap: SPACING.sm,
  },

  timelineTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.semibold,
  },

  timelineTime: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    flexShrink: 0,
  },

  // AI summary box
  aiSummaryBox: {
    backgroundColor: `${COLORS.primary}0C`,
    border: `1px solid ${COLORS.primary}25`,
    borderRadius: RADIUS.md,
    padding: `${SPACING.sm} ${SPACING.md}`,
    marginTop: SPACING.sm,
  },

  aiLabel: {
    color: COLORS.primary,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "4px",
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },

  aiText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    lineHeight: FONTS.lineHeight.relaxed,
  },

  // Recording player
  recordingRow: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surfaceActive,
    borderRadius: RADIUS.md,
    padding: `${SPACING.xs} ${SPACING.md}`,
  },

  playBtn: {
    background: "none",
    border: `1px solid ${COLORS.border}`,
    borderRadius: "50%",
    width: "30px",
    height: "30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: TRANSITIONS.fast,
    flexShrink: 0,
    color: COLORS.primary,
  },

  audioEl: {
    flex: 1,
    height: "28px",
    outline: "none",
  },

  // Note input
  noteInputWrap: {
    padding: SPACING.xl,
    borderTop: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.surfaceActive,
  },

  noteInput: {
    width: "100%",
    backgroundColor: COLORS.inputBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.sm,
    padding: `${SPACING.sm} ${SPACING.md}`,
    outline: "none",
    resize: "vertical",
    minHeight: "64px",
    boxSizing: "border-box",
    transition: TRANSITIONS.fast,
  },

  noteSubmitBtn: {
    backgroundColor: COLORS.primary,
    color: "#121212",
    border: "none",
    borderRadius: RADIUS.md,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
    padding: `${SPACING.sm} ${SPACING.lg}`,
    cursor: "pointer",
    marginTop: SPACING.sm,
    transition: TRANSITIONS.base,
    boxShadow: SHADOWS.primary,
  },

  // ── Modals ─────────────────────────────────────────────────────────────────
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
    maxWidth: "440px",
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
    transition: TRANSITIONS.fast,
  },

  modalBody: { padding: SPACING["2xl"] },

  modalFooter: {
    padding: `${SPACING.base} ${SPACING["2xl"]} ${SPACING.xl}`,
    display: "flex",
    gap: SPACING.sm,
    justifyContent: "flex-end",
  },

  // Form field in modal
  modalFieldGroup: {
    marginBottom: SPACING.base,
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
    transition: TRANSITIONS.fast,
  },

  modalSelect: {
    backgroundColor: COLORS.inputBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    padding: `${SPACING.sm} ${SPACING.md}`,
    outline: "none",
    width: "100%",
    cursor: "pointer",
    transition: TRANSITIONS.fast,
  },

  modalTextarea: {
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
    resize: "vertical",
    minHeight: "80px",
    transition: TRANSITIONS.fast,
  },

  // Buttons
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

  btnDanger: {
    backgroundColor: "transparent",
    color: COLORS.danger,
    border: `1px solid ${COLORS.danger}40`,
    borderRadius: RADIUS.md,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    padding: `${SPACING.sm} ${SPACING.xl}`,
    cursor: "pointer",
    transition: TRANSITIONS.base,
  },

  // Razorpay result box
  razorpayResultBox: {
    backgroundColor: `${COLORS.success}10`,
    border: `1px solid ${COLORS.success}30`,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    marginTop: SPACING.base,
  },

  razorpayLinkRow: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceActive,
    borderRadius: RADIUS.base,
    padding: `${SPACING.xs} ${SPACING.md}`,
    marginTop: SPACING.sm,
  },

  razorpayLink: {
    flex: 1,
    color: COLORS.accent,
    fontSize: FONTS.size.sm,
    fontFamily: "monospace",
    wordBreak: "break-all",
  },

  // WhatsApp template list
  waTemplate: {
    backgroundColor: COLORS.surfaceActive,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    padding: `${SPACING.sm} ${SPACING.md}`,
    marginBottom: SPACING.sm,
    cursor: "pointer",
    transition: TRANSITIONS.fast,
  },

  waTemplateName: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
    marginBottom: "2px",
  },

  waTemplatePreview: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  // Loading / empty in timeline
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

const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const PhoneCallIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const WhatsAppIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const TicketIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/>
  </svg>
);
const PaymentIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);
const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const NoteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);
const MailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
);
const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const SparkleIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
  </svg>
);

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Inline loading rows */
const LoadingRows = () => (
  <div style={S.loadingWrap}>
    <div style={S.spinner} />
    <span>Loading…</span>
  </div>
);

/** Full-page loading */
const PageLoader = () => (
  <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
    <div style={{ textAlign: "center", color: COLORS.textMuted }}>
      <div style={{ ...S.spinner, width: "28px", height: "28px", margin: "0 auto 12px" }} />
      <div>Loading lead…</div>
    </div>
  </div>
);

/** Modal wrapper */
const Modal = ({ title, onClose, footer, children }) => (
  <div style={S.modalOverlay} onClick={onClose}>
    <div style={S.modal} onClick={(e) => e.stopPropagation()}>
      <div style={S.modalHeader}>
        <span style={S.modalTitle}>{title}</span>
        <button style={S.modalCloseBtn} onClick={onClose}>×</button>
      </div>
      <div style={S.modalBody}>{children}</div>
      {footer && <div style={S.modalFooter}>{footer}</div>}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// LeadDetailPage Component
// ─────────────────────────────────────────────────────────────────────────────

export const LeadDetailPage = () => {
  const { leadId } = useParams();
  const navigate   = useNavigate();
  const { currentUser, companyId } = useAuth();

  // ─── Core data ──────────────────────────────────────────────────────────────
  const [lead,      setLead]      = useState(null);   // live lead doc
  const [calls,     setCalls]     = useState(null);
  const [followups, setFollowups] = useState(null);
  const [tickets,   setTickets]   = useState(null);
  const [payments,  setPayments]  = useState(null);
  const [waTemplates, setWaTemplates] = useState([]);
  const [pageError, setPageError] = useState(null);

  // ─── UI state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("timeline"); // timeline | calls | followups | tickets | payments
  const [noteText,  setNoteText]  = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [savingStage, setSavingStage] = useState(false);

  // Modals
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [showTicketModal,   setShowTicketModal]   = useState(false);
  const [showPaymentModal,  setShowPaymentModal]  = useState(false);
  const [showWaModal,       setShowWaModal]       = useState(false);

  // Modal form state
  const [fuDate,   setFuDate]   = useState("");
  const [fuTime,   setFuTime]   = useState("");
  const [fuNote,   setFuNote]   = useState("");
  const [savingFu, setSavingFu] = useState(false);

  const [ticketTitle,   setTicketTitle]   = useState("");
  const [ticketDesc,    setTicketDesc]    = useState("");
  const [ticketPriority,setTicketPriority]= useState("Medium");
  const [savingTicket,  setSavingTicket]  = useState(false);

  const [payAmount,    setPayAmount]    = useState("");
  const [payDesc,      setPayDesc]      = useState("");
  const [payLinkResult,setPayLinkResult]= useState(null);
  const [savingPay,    setSavingPay]    = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // ─── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, color = COLORS.success) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, color });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // ─── Firestore subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    injectStyles();
    if (!leadId) return;

    // Live lead doc
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.LEADS, leadId),
      (snap) => {
        if (!snap.exists()) { setPageError("Lead not found."); return; }
        setLead({ id: snap.id, ...snap.data() });
      },
      () => setPageError("Could not load lead.")
    );

    return () => unsub();
  }, [leadId]);

  // Fetch secondary collections once on mount
  useEffect(() => {
    if (!leadId || !companyId) return;
    fetchCalls();
    fetchFollowups();
    fetchTickets();
    fetchPayments();
    fetchWaTemplates();
  }, [leadId, companyId]); // eslint-disable-line

  const fetchCalls = async () => {
    const q = query(
      collection(db, COLLECTIONS.CALLS),
      where("leadId",    "==", leadId),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    setCalls(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const fetchFollowups = async () => {
    const q = query(
      collection(db, COLLECTIONS.FOLLOW_UPS),
      where("leadId",    "==", leadId),
      where("companyId", "==", companyId),
      orderBy("scheduledAt", "desc")
    );
    const snap = await getDocs(q);
    setFollowups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const fetchTickets = async () => {
    const q = query(
      collection(db, COLLECTIONS.TICKETS),
      where("leadId",    "==", leadId),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const fetchPayments = async () => {
    const q = query(
      collection(db, COLLECTIONS.PAYMENTS),
      where("leadId",    "==", leadId),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const fetchWaTemplates = async () => {
    const q = query(
      collection(db, COLLECTIONS.WHATSAPP_TEMPLATES),
      where("companyId", "==", companyId)
    );
    const snap = await getDocs(q);
    setWaTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  // ─── Stage change ─────────────────────────────────────────────────────────────
  const handleStageChange = async (newStage) => {
    if (!lead || newStage === lead.stage) return;
    setSavingStage(true);
    try {
      await updateDoc(doc(db, COLLECTIONS.LEADS, leadId), {
        stage:     newStage,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });
      showToast(`Stage moved to ${newStage}`);
    } catch {
      showToast("Could not update stage", COLORS.danger);
    } finally {
      setSavingStage(false);
    }
  };

  // ─── Add note ─────────────────────────────────────────────────────────────────
  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      // Notes stored as a call-log type entry for timeline consistency
      await addDoc(collection(db, COLLECTIONS.CALLS), {
        leadId,
        companyId,
        agentId:   currentUser.uid,
        type:      "note",
        note:      noteText.trim(),
        createdAt: serverTimestamp(),
        leadName:  lead?.name ?? "",
      });
      // Also update lead's updatedAt
      await updateDoc(doc(db, COLLECTIONS.LEADS, leadId), {
        updatedAt: serverTimestamp(),
        lastNoteAt: serverTimestamp(),
      });
      setNoteText("");
      showToast("Note saved");
      fetchCalls(); // refresh timeline
    } catch {
      showToast("Could not save note", COLORS.danger);
    } finally {
      setSavingNote(false);
    }
  };

  // ─── Save follow-up ────────────────────────────────────────────────────────────
  const handleSaveFollowup = async () => {
    if (!fuDate || !fuTime) return;
    setSavingFu(true);
    try {
      const scheduledDate = new Date(`${fuDate}T${fuTime}`);
      await addDoc(collection(db, COLLECTIONS.FOLLOW_UPS), {
        leadId,
        leadName:    lead?.name ?? "",
        companyId,
        agentId:     currentUser.uid,
        scheduledAt: Timestamp.fromDate(scheduledDate),
        note:        fuNote.trim(),
        status:      "pending",
        createdAt:   serverTimestamp(),
      });
      await updateDoc(doc(db, COLLECTIONS.LEADS, leadId), {
        nextFollowupAt: Timestamp.fromDate(scheduledDate),
        updatedAt:      serverTimestamp(),
      });
      setShowFollowupModal(false);
      setFuDate(""); setFuTime(""); setFuNote("");
      showToast("Follow-up scheduled");
      fetchFollowups();
    } catch {
      showToast("Could not save follow-up", COLORS.danger);
    } finally {
      setSavingFu(false);
    }
  };

  // ─── Save ticket ───────────────────────────────────────────────────────────────
  const handleSaveTicket = async () => {
    if (!ticketTitle.trim()) return;
    setSavingTicket(true);
    try {
      await addDoc(collection(db, COLLECTIONS.TICKETS), {
        leadId,
        leadName:    lead?.name ?? "",
        companyId,
        createdBy:   currentUser.uid,
        title:       ticketTitle.trim(),
        description: ticketDesc.trim(),
        priority:    ticketPriority,
        status:      "Open",
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
      setShowTicketModal(false);
      setTicketTitle(""); setTicketDesc(""); setTicketPriority("Medium");
      showToast("Ticket raised");
      fetchTickets();
    } catch {
      showToast("Could not raise ticket", COLORS.danger);
    } finally {
      setSavingTicket(false);
    }
  };

  // ─── Generate Razorpay payment link ───────────────────────────────────────────
  const handleGeneratePayLink = async () => {
    if (!payAmount || isNaN(Number(payAmount))) return;
    setSavingPay(true);
    try {
      // Razorpay Payment Link API call via Firebase Cloud Function
      // The Cloud Function at /generatePaymentLink handles the Razorpay API call
      // and returns { shortUrl, paymentLinkId }
      // For now we log the intent to Firestore — the Cloud Function triggers
      const ref = await addDoc(collection(db, COLLECTIONS.PAYMENTS), {
        leadId,
        leadName:   lead?.name ?? "",
        companyId,
        agentId:    currentUser.uid,
        amount:     Number(payAmount),
        currency:   "INR",
        description:payDesc.trim() || `Payment from ${lead?.name}`,
        status:     "link_pending",   // Cloud Function updates this to link_created
        createdAt:  serverTimestamp(),
      });
      // Simulate link result (Cloud Function will return real URL in production)
      const mockLink = `https://rzp.io/l/${ref.id.slice(0, 8).toUpperCase()}`;
      setPayLinkResult(mockLink);
      showToast("Payment link generated");
      // Update lead stage to Negotiation if still earlier
      if (!["Negotiation","Closed Won","Closed Lost"].includes(lead?.stage)) {
        await updateDoc(doc(db, COLLECTIONS.LEADS, leadId), {
          stage: "Negotiation",
          updatedAt: serverTimestamp(),
        });
      }
      fetchPayments();
    } catch {
      showToast("Could not generate link", COLORS.danger);
    } finally {
      setSavingPay(false);
    }
  };

  // ─── WhatsApp send ────────────────────────────────────────────────────────────
  const handleSendWhatsApp = (template) => {
    if (!lead?.phone) return;
    // Personalise template
    const msg = (template.message || "")
      .replace("{name}",    lead.name    ?? "")
      .replace("{company}", lead.company ?? "");
    window.open(whatsappUrl(lead.phone, msg), "_blank");
    setShowWaModal(false);
    showToast("WhatsApp opened");
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (pageError) return (
    <div style={{ ...S.page, textAlign: "center", paddingTop: "80px", color: COLORS.danger }}>
      <div style={{ fontSize: "32px", marginBottom: SPACING.base }}>⚠</div>
      <div>{pageError}</div>
      <button style={{ ...S.btnSecondary, marginTop: SPACING.xl }} onClick={() => navigate(-1)}>Go back</button>
    </div>
  );

  if (!lead) return <PageLoader />;

  const stageConf = STAGE_COLORS[lead.stage] ?? STAGE_COLORS["New"];
  const scoreConf = SCORE_COLORS[lead.leadScore] ?? { text: COLORS.textMuted, bg: `${COLORS.textMuted}18`, dot: COLORS.textMuted };

  // Build unified timeline from calls (includes notes, type="note" vs type="call")
  const timelineItems = calls ?? [];
  const fuDue = followups?.filter((f) => f.status === "pending") ?? [];

  const TABS = [
    { key: "timeline",  label: "Timeline",   count: timelineItems.length },
    { key: "followups", label: "Follow-ups",  count: fuDue.length },
    { key: "tickets",   label: "Tickets",     count: tickets?.length ?? 0 },
    { key: "payments",  label: "Payments",    count: payments?.length ?? 0 },
  ];

  return (
    <div style={S.page}>

      {/* Back nav */}
      <div style={S.backRow}>
        <button style={S.backBtn} onClick={() => navigate("/agent/leads")}
          onMouseEnter={(e) => e.currentTarget.style.color = COLORS.accent}
          onMouseLeave={(e) => e.currentTarget.style.color = COLORS.textMuted}
        >
          <BackIcon /> My Leads
        </button>
        <span style={{ color: COLORS.border }}>/</span>
        <span style={{ color: COLORS.textSecondary, fontSize: FONTS.size.sm }}>{lead.name}</span>
      </div>

      <div style={S.layout}>

        {/* ══ LEFT PANEL ════════════════════════════════════════════════════ */}
        <div style={S.leftPanel}>

          {/* Info card */}
          <div style={S.infoCard}>
            <div style={S.infoCardHeader}>
              <div style={S.leadName}>{lead.name}</div>
              <div style={S.badgeRow}>
                {/* Stage */}
                <span style={{ ...S.badge, color: stageConf.text, backgroundColor: stageConf.bg }}>
                  {lead.stage ?? "New"}
                </span>
                {/* Score */}
                {lead.leadScore && (
                  <span style={{ ...S.badge, color: scoreConf.text, backgroundColor: scoreConf.bg }}>
                    <span style={{ ...S.scoreDot, backgroundColor: scoreConf.dot }} />
                    {lead.leadScore}
                  </span>
                )}
                {/* AI objection tag */}
                {lead.objectionTag && lead.objectionTag !== "None" && (
                  <span style={{ ...S.badge, color: COLORS.warning, backgroundColor: `${COLORS.warning}18` }}>
                    ⚠ {lead.objectionTag}
                  </span>
                )}
              </div>
            </div>

            <div style={S.infoBody}>

              {/* Change stage */}
              <div style={{ marginBottom: SPACING.lg }}>
                <div style={{ ...S.infoLabel, marginBottom: SPACING.sm }}>Pipeline Stage</div>
                <select
                  value={lead.stage ?? "New"}
                  onChange={(e) => handleStageChange(e.target.value)}
                  disabled={savingStage}
                  style={{
                    ...S.stageSelect,
                    color: stageConf.text,
                    borderColor: stageConf.text + "60",
                    opacity: savingStage ? 0.6 : 1,
                  }}
                >
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Contact details */}
              {[
                { icon: <PhoneCallIcon />, label: "Phone", value: lead.phone },
                { icon: <MailIcon />,      label: "Email", value: lead.email },
              ].map(({ icon, label, value }) => value ? (
                <div key={label} style={S.infoRow}>
                  <span style={S.infoIcon}>{icon}</span>
                  <div>
                    <div style={S.infoLabel}>{label}</div>
                    <div style={S.infoValue}>{value}</div>
                  </div>
                </div>
              ) : null)}

              {/* Source */}
              {lead.source && (
                <div style={S.infoRow}>
                  <span style={S.infoIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </span>
                  <div>
                    <div style={S.infoLabel}>Source</div>
                    <div style={S.infoValue}>{lead.source}</div>
                  </div>
                </div>
              )}

              {/* Company */}
              {lead.company && (
                <div style={S.infoRow}>
                  <span style={S.infoIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </span>
                  <div>
                    <div style={S.infoLabel}>Company</div>
                    <div style={S.infoValue}>{lead.company}</div>
                  </div>
                </div>
              )}

              {/* Created + next follow-up */}
              <div style={{ ...S.infoRow, marginBottom: 0 }}>
                <span style={S.infoIcon}>
                  <CalendarIcon />
                </span>
                <div>
                  <div style={S.infoLabel}>Added</div>
                  <div style={S.infoValue}>{fmtDate(lead.createdAt)}</div>
                </div>
              </div>
              {lead.nextFollowupAt && (
                <div style={{ ...S.infoRow, marginTop: SPACING.base, marginBottom: 0 }}>
                  <span style={{ ...S.infoIcon, color: COLORS.accent }}>
                    <CalendarIcon />
                  </span>
                  <div>
                    <div style={{ ...S.infoLabel, color: COLORS.accent }}>Next Follow-up</div>
                    <div style={{ ...S.infoValue, color: COLORS.accent }}>{fmtDateTime(lead.nextFollowupAt)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Deal value */}
            {lead.dealValue > 0 && (
              <div style={S.dealRow}>
                <span style={S.dealLabel}>Deal Value</span>
                <span style={S.dealValue}>₹{Number(lead.dealValue).toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div style={S.actionsCard}>
            <div style={S.actionsLabel}>Quick Actions</div>

            {/* Call */}
            <ActionButton
              icon={<PhoneCallIcon />}
              label={`Call ${lead.phone ?? ""}`}
              color={COLORS.success}
              onClick={() => navigate("/agent/call", { state: { lead } })}
            />

            {/* WhatsApp */}
            <ActionButton
              icon={<WhatsAppIcon />}
              label="Send WhatsApp"
              color="#25D366"
              onClick={() => setShowWaModal(true)}
            />

            {/* Follow-up */}
            <ActionButton
              icon={<CalendarIcon />}
              label="Schedule Follow-up"
              color={COLORS.accent}
              onClick={() => setShowFollowupModal(true)}
            />

            {/* Payment link */}
            <ActionButton
              icon={<PaymentIcon />}
              label="Generate Payment Link"
              color={COLORS.primary}
              onClick={() => { setPayLinkResult(null); setShowPaymentModal(true); }}
            />

            {/* Raise ticket */}
            <ActionButton
              icon={<TicketIcon />}
              label="Raise Support Ticket"
              color={COLORS.warning}
              onClick={() => setShowTicketModal(true)}
            />

            {/* Edit lead */}
            <ActionButton
              icon={<EditIcon />}
              label="Edit Lead"
              color={COLORS.textSecondary}
              onClick={() => navigate(`/agent/edit-lead/${leadId}`)}
            />
          </div>

        </div>

        {/* ══ RIGHT PANEL ═══════════════════════════════════════════════════ */}
        <div style={S.rightPanel}>

          {/* Tab bar */}
          <div style={S.tabBar}>
            {TABS.map((t) => (
              <button
                key={t.key}
                style={{
                  ...S.tab,
                  ...(activeTab === t.key ? S.tabActive : S.tabInactive),
                }}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
                {t.count > 0 && (
                  <span style={{
                    backgroundColor: activeTab === t.key ? "#12121230" : COLORS.border,
                    color: activeTab === t.key ? "#121212" : COLORS.textMuted,
                    borderRadius: RADIUS.full,
                    padding: "1px 6px",
                    fontSize: FONTS.size.xs,
                    fontWeight: FONTS.weight.bold,
                    lineHeight: 1.6,
                  }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Timeline tab ─────────────────────────────────────────────── */}
          {activeTab === "timeline" && (
            <div style={S.sectionCard}>
              <div style={S.sectionHeader}>
                <span style={S.sectionTitle}>Activity Timeline</span>
                <span style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm }}>
                  All calls, notes & updates
                </span>
              </div>

              {/* Note input */}
              <div style={S.noteInputWrap}>
                <textarea
                  placeholder="Add a note about this lead…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  style={S.noteInput}
                  onFocus={(e)  => { e.target.style.border = `1px solid ${COLORS.inputFocus}`; e.target.style.boxShadow = `0 0 0 3px ${COLORS.primary}22`; }}
                  onBlur={(e)   => { e.target.style.border = `1px solid ${COLORS.border}`;     e.target.style.boxShadow = "none"; }}
                />
                {noteText.trim() && (
                  <button
                    style={S.noteSubmitBtn}
                    onClick={handleAddNote}
                    disabled={savingNote}
                  >
                    {savingNote ? "Saving…" : "Save Note"}
                  </button>
                )}
              </div>

              {/* Timeline items */}
              {calls === null ? (
                <LoadingRows />
              ) : timelineItems.length === 0 ? (
                <div style={S.emptyState}>
                  No activity yet — make the first call or add a note above.
                </div>
              ) : (
                timelineItems.map((item, idx) => (
                  <TimelineItem
                    key={item.id}
                    item={item}
                    isLast={idx === timelineItems.length - 1}
                  />
                ))
              )}
            </div>
          )}

          {/* ── Follow-ups tab ────────────────────────────────────────────── */}
          {activeTab === "followups" && (
            <div style={S.sectionCard}>
              <div style={S.sectionHeader}>
                <span style={S.sectionTitle}>Follow-ups</span>
                <button
                  style={{ ...S.btnPrimary, fontSize: FONTS.size.xs, padding: `4px ${SPACING.md}` }}
                  onClick={() => setShowFollowupModal(true)}
                >
                  + Schedule
                </button>
              </div>
              {followups === null ? <LoadingRows /> :
               followups.length === 0 ? (
                <div style={S.emptyState}>No follow-ups scheduled yet.</div>
              ) : followups.map((fu, idx) => {
                const isOverdue = fu.status === "pending" && fu.scheduledAt?.toDate?.() < new Date();
                const isPending = fu.status === "pending";
                return (
                  <div
                    key={fu.id}
                    style={{
                      ...S.timelineItem,
                      borderBottom: idx === followups.length - 1 ? "none" : `1px solid ${COLORS.border}`,
                    }}
                  >
                    <div style={{
                      ...S.timelineDot,
                      backgroundColor: isOverdue ? COLORS.danger : isPending ? COLORS.accent : COLORS.success,
                    }} />
                    <div style={S.timelineContent}>
                      <div style={S.timelineHeader}>
                        <span style={S.timelineTitle}>
                          {fmtDateTime(fu.scheduledAt)}
                        </span>
                        <StatusPill
                          label={isOverdue ? "Overdue" : fu.status}
                          color={isOverdue ? COLORS.danger : isPending ? COLORS.accent : COLORS.success}
                        />
                      </div>
                      {fu.note && <div style={{ color: COLORS.textSecondary, fontSize: FONTS.size.sm }}>{fu.note}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Tickets tab ──────────────────────────────────────────────── */}
          {activeTab === "tickets" && (
            <div style={S.sectionCard}>
              <div style={S.sectionHeader}>
                <span style={S.sectionTitle}>Support Tickets</span>
                <button
                  style={{ ...S.btnPrimary, fontSize: FONTS.size.xs, padding: `4px ${SPACING.md}` }}
                  onClick={() => setShowTicketModal(true)}
                >
                  + Raise Ticket
                </button>
              </div>
              {tickets === null ? <LoadingRows /> :
               tickets.length === 0 ? (
                <div style={S.emptyState}>No tickets raised for this lead.</div>
              ) : tickets.map((tk, idx) => (
                <div
                  key={tk.id}
                  style={{
                    ...S.timelineItem,
                    borderBottom: idx === tickets.length - 1 ? "none" : `1px solid ${COLORS.border}`,
                  }}
                >
                  <div style={{
                    ...S.timelineDot,
                    backgroundColor:
                      tk.status === "Open"       ? COLORS.danger  :
                      tk.status === "Resolved"   ? COLORS.success :
                      tk.status === "In Progress"? COLORS.warning  : COLORS.textMuted,
                  }} />
                  <div style={S.timelineContent}>
                    <div style={S.timelineHeader}>
                      <span style={S.timelineTitle}>{tk.title}</span>
                      <div style={{ display: "flex", gap: SPACING.sm, alignItems: "center" }}>
                        <StatusPill label={tk.status} color={
                          tk.status === "Open" ? COLORS.danger :
                          tk.status === "Resolved" ? COLORS.success :
                          COLORS.warning
                        } />
                        <span style={S.timelineTime}>{timeAgo(tk.createdAt)}</span>
                      </div>
                    </div>
                    {tk.description && (
                      <div style={{ color: COLORS.textSecondary, fontSize: FONTS.size.sm, lineHeight: FONTS.lineHeight.normal }}>
                        {tk.description}
                      </div>
                    )}
                    <div style={{ marginTop: "4px" }}>
                      <span style={{
                        ...S.badge,
                        color:           tk.priority === "High" ? COLORS.danger : tk.priority === "Low" ? COLORS.textMuted : COLORS.warning,
                        backgroundColor: tk.priority === "High" ? `${COLORS.danger}15` : tk.priority === "Low" ? `${COLORS.textMuted}15` : `${COLORS.warning}15`,
                        fontSize: FONTS.size.xs,
                      }}>
                        {tk.priority} Priority
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Payments tab ─────────────────────────────────────────────── */}
          {activeTab === "payments" && (
            <div style={S.sectionCard}>
              <div style={S.sectionHeader}>
                <span style={S.sectionTitle}>Payment Links</span>
                <button
                  style={{ ...S.btnPrimary, fontSize: FONTS.size.xs, padding: `4px ${SPACING.md}` }}
                  onClick={() => { setPayLinkResult(null); setShowPaymentModal(true); }}
                >
                  + New Link
                </button>
              </div>
              {payments === null ? <LoadingRows /> :
               payments.length === 0 ? (
                <div style={S.emptyState}>No payment links generated yet.</div>
              ) : payments.map((p, idx) => (
                <div
                  key={p.id}
                  style={{
                    ...S.timelineItem,
                    borderBottom: idx === payments.length - 1 ? "none" : `1px solid ${COLORS.border}`,
                  }}
                >
                  <div style={{ ...S.timelineDot, backgroundColor: p.status === "paid" ? COLORS.success : COLORS.primary }} />
                  <div style={S.timelineContent}>
                    <div style={S.timelineHeader}>
                      <span style={S.timelineTitle}>
                        ₹{Number(p.amount).toLocaleString("en-IN")}
                      </span>
                      <div style={{ display: "flex", gap: SPACING.sm, alignItems: "center" }}>
                        <StatusPill
                          label={p.status === "paid" ? "Paid ✓" : "Pending"}
                          color={p.status === "paid" ? COLORS.success : COLORS.warning}
                        />
                        <span style={S.timelineTime}>{timeAgo(p.createdAt)}</span>
                      </div>
                    </div>
                    {p.description && (
                      <div style={{ color: COLORS.textSecondary, fontSize: FONTS.size.sm }}>{p.description}</div>
                    )}
                    {p.shortUrl && (
                      <div style={{ ...S.razorpayLinkRow, marginTop: SPACING.sm }}>
                        <span style={S.razorpayLink}>{p.shortUrl}</span>
                        <button style={{ ...S.iconBtn_small }} onClick={() => { navigator.clipboard.writeText(p.shortUrl); showToast("Link copied"); }}>
                          <CopyIcon />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ══ MODALS ══════════════════════════════════════════════════════════ */}

      {/* Follow-up modal */}
      {showFollowupModal && (
        <Modal
          title="Schedule Follow-up"
          onClose={() => setShowFollowupModal(false)}
          footer={
            <>
              <button style={S.btnSecondary} onClick={() => setShowFollowupModal(false)}>Cancel</button>
              <button
                style={{ ...S.btnPrimary, opacity: savingFu ? 0.7 : 1 }}
                onClick={handleSaveFollowup}
                disabled={savingFu || !fuDate || !fuTime}
              >
                {savingFu ? "Saving…" : "Schedule"}
              </button>
            </>
          }
        >
          <div style={S.modalFieldGroup}>
            <label style={S.modalLabel}>Date</label>
            <input
              type="date"
              value={fuDate}
              onChange={(e) => setFuDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              style={S.modalInput}
            />
          </div>
          <div style={S.modalFieldGroup}>
            <label style={S.modalLabel}>Time</label>
            <input
              type="time"
              value={fuTime}
              onChange={(e) => setFuTime(e.target.value)}
              style={S.modalInput}
            />
          </div>
          <div style={S.modalFieldGroup}>
            <label style={S.modalLabel}>Note (optional)</label>
            <textarea
              placeholder="What to discuss on this call…"
              value={fuNote}
              onChange={(e) => setFuNote(e.target.value)}
              style={S.modalTextarea}
            />
          </div>
        </Modal>
      )}

      {/* Ticket modal */}
      {showTicketModal && (
        <Modal
          title="Raise Support Ticket"
          onClose={() => setShowTicketModal(false)}
          footer={
            <>
              <button style={S.btnSecondary} onClick={() => setShowTicketModal(false)}>Cancel</button>
              <button
                style={{ ...S.btnPrimary, opacity: savingTicket ? 0.7 : 1 }}
                onClick={handleSaveTicket}
                disabled={savingTicket || !ticketTitle.trim()}
              >
                {savingTicket ? "Raising…" : "Raise Ticket"}
              </button>
            </>
          }
        >
          <div style={S.modalFieldGroup}>
            <label style={S.modalLabel}>Title *</label>
            <input
              type="text"
              placeholder="Brief description of the issue"
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              style={S.modalInput}
            />
          </div>
          <div style={S.modalFieldGroup}>
            <label style={S.modalLabel}>Description</label>
            <textarea
              placeholder="Full details, what happened, what the customer said…"
              value={ticketDesc}
              onChange={(e) => setTicketDesc(e.target.value)}
              style={S.modalTextarea}
            />
          </div>
          <div style={S.modalFieldGroup}>
            <label style={S.modalLabel}>Priority</label>
            <select value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value)} style={S.modalSelect}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
        </Modal>
      )}

      {/* Payment link modal */}
      {showPaymentModal && (
        <Modal
          title="Generate Payment Link"
          onClose={() => setShowPaymentModal(false)}
          footer={
            !payLinkResult && (
              <>
                <button style={S.btnSecondary} onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button
                  style={{ ...S.btnPrimary, opacity: savingPay ? 0.7 : 1 }}
                  onClick={handleGeneratePayLink}
                  disabled={savingPay || !payAmount}
                >
                  {savingPay ? "Generating…" : "Generate Link"}
                </button>
              </>
            )
          }
        >
          {payLinkResult ? (
            <div style={S.razorpayResultBox}>
              <div style={{ color: COLORS.success, fontWeight: FONTS.weight.semibold, marginBottom: SPACING.sm }}>
                ✓ Payment link ready
              </div>
              <div style={S.razorpayLinkRow}>
                <span style={S.razorpayLink}>{payLinkResult}</span>
                <button
                  style={{ ...S.btnSecondary, fontSize: FONTS.size.xs, padding: "4px 8px", display: "flex", alignItems: "center", gap: "4px" }}
                  onClick={() => { navigator.clipboard.writeText(payLinkResult); showToast("Link copied!"); }}
                >
                  <CopyIcon /> Copy
                </button>
              </div>
              <button
                style={{ ...S.actionBtn, marginTop: SPACING.base, color: "#25D366", borderColor: "#25D36640" }}
                onClick={() => {
                  const msg = `Hi ${lead.name}, please complete your payment here: ${payLinkResult}`;
                  window.open(whatsappUrl(lead.phone, msg), "_blank");
                }}
              >
                <WhatsAppIcon /> Send via WhatsApp
              </button>
              <button
                style={{ ...S.btnSecondary, marginTop: SPACING.sm, width: "100%" }}
                onClick={() => setShowPaymentModal(false)}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div style={S.modalFieldGroup}>
                <label style={S.modalLabel}>Amount (₹) *</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  style={S.modalInput}
                  min="1"
                />
              </div>
              <div style={S.modalFieldGroup}>
                <label style={S.modalLabel}>Description</label>
                <input
                  type="text"
                  placeholder={`Payment from ${lead.name}`}
                  value={payDesc}
                  onChange={(e) => setPayDesc(e.target.value)}
                  style={S.modalInput}
                />
              </div>
              <div style={{ color: COLORS.textMuted, fontSize: FONTS.size.xs, marginTop: SPACING.sm }}>
                Razorpay charges 2% per transaction. Link is valid for 15 days.
              </div>
            </>
          )}
        </Modal>
      )}

      {/* WhatsApp template modal */}
      {showWaModal && (
        <Modal
          title={`WhatsApp — ${lead.name}`}
          onClose={() => { setShowWaModal(false); setSelectedTemplate(null); }}
        >
          {waTemplates.length === 0 ? (
            <>
              <div style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm, marginBottom: SPACING.base }}>
                No saved templates. Send a custom message:
              </div>
              <textarea
                placeholder="Type your message…"
                value={selectedTemplate?.message ?? ""}
                onChange={(e) => setSelectedTemplate({ message: e.target.value })}
                style={{ ...S.modalTextarea, minHeight: "100px" }}
              />
              <button
                style={{ ...S.btnPrimary, marginTop: SPACING.base, display: "flex", alignItems: "center", gap: SPACING.sm, color: "#121212" }}
                onClick={() => handleSendWhatsApp(selectedTemplate ?? { message: "" })}
                disabled={!selectedTemplate?.message?.trim()}
              >
                <WhatsAppIcon /> Open WhatsApp
              </button>
            </>
          ) : (
            <>
              <div style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm, marginBottom: SPACING.base }}>
                Select a template to send to {lead.name}:
              </div>
              {waTemplates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  style={{
                    ...S.waTemplate,
                    ...(selectedTemplate?.id === tmpl.id
                      ? { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}0C` }
                      : {}),
                  }}
                  onClick={() => setSelectedTemplate(tmpl)}
                >
                  <div style={S.waTemplateName}>{tmpl.name}</div>
                  <div style={S.waTemplatePreview}>{tmpl.message}</div>
                </div>
              ))}
              <button
                style={{
                  ...S.btnPrimary,
                  marginTop: SPACING.base,
                  display: "flex",
                  alignItems: "center",
                  gap: SPACING.sm,
                  width: "100%",
                  justifyContent: "center",
                  opacity: selectedTemplate ? 1 : 0.5,
                }}
                onClick={() => selectedTemplate && handleSendWhatsApp(selectedTemplate)}
                disabled={!selectedTemplate}
              >
                <WhatsAppIcon /> Open WhatsApp
              </button>
            </>
          )}
        </Modal>
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{ ...S.toast, borderLeft: `3px solid ${toast.color}` }}>
          <span style={{ color: toast.color, fontSize: "16px" }}>
            {toast.color === COLORS.danger ? "✕" : "✓"}
          </span>
          {toast.msg}
        </div>
      )}

    </div>
  );
};

// ─── TimelineItem sub-component ───────────────────────────────────────────────

const TimelineItem = ({ item, isLast }) => {
  const isNote = item.type === "note";
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef(null);

  const outcomeColor = OUTCOME_COLORS[item.outcome] ?? COLORS.textMuted;
  const dotColor = isNote
    ? COLORS.info
    : item.outcome
    ? outcomeColor
    : COLORS.textMuted;

  return (
    <div style={{
      ...S.timelineItem,
      borderBottom: isLast ? "none" : `1px solid ${COLORS.border}`,
      animationDelay: "0ms",
    }}>
      <div style={{ ...S.timelineDot, backgroundColor: dotColor }} />
      <div style={S.timelineContent}>

        {/* Header row */}
        <div style={S.timelineHeader}>
          <div>
            <span style={S.timelineTitle}>
              {isNote ? "Note" : `Call — ${fmtDuration(item.duration)}`}
            </span>
            {!isNote && item.outcome && (
              <span style={{
                marginLeft: SPACING.sm,
                ...{
                  fontSize: FONTS.size.xs,
                  fontWeight: FONTS.weight.semibold,
                  padding: `2px ${SPACING.sm}`,
                  borderRadius: RADIUS.full,
                  display: "inline-flex",
                  alignItems: "center",
                },
                color: outcomeColor,
                backgroundColor: `${outcomeColor}18`,
              }}>
                {item.outcome}
              </span>
            )}
          </div>
          <span style={S.timelineTime}>{timeAgo(item.createdAt)}</span>
        </div>

        {/* Note text */}
        {item.note && (
          <div style={{ color: COLORS.textSecondary, fontSize: FONTS.size.sm, lineHeight: FONTS.lineHeight.relaxed, marginBottom: SPACING.sm }}>
            {item.note}
          </div>
        )}

        {/* Call recording */}
        {!isNote && item.recordingUrl && (
          <div style={S.recordingRow}>
            <button
              style={{
                ...S.playBtn,
                ...(audioPlaying ? { borderColor: COLORS.primary, color: COLORS.primary } : {}),
              }}
              onClick={() => {
                if (audioRef.current) {
                  if (audioPlaying) { audioRef.current.pause(); setAudioPlaying(false); }
                  else              { audioRef.current.play();  setAudioPlaying(true);  }
                }
              }}
            >
              {audioPlaying ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
            </button>
            <audio
              ref={audioRef}
              src={item.recordingUrl}
              style={S.audioEl}
              controls
              onPlay={()  => setAudioPlaying(true)}
              onPause={() => setAudioPlaying(false)}
              onEnded={() => setAudioPlaying(false)}
            />
          </div>
        )}

        {/* AI Summary */}
        {!isNote && item.aiSummary && (
          <div style={S.aiSummaryBox}>
            <div style={S.aiLabel}>
              <SparkleIcon /> AI Summary
            </div>
            <div style={S.aiText}>{item.aiSummary}</div>
          </div>
        )}

        {/* Objection tag from AI */}
        {!isNote && item.objectionTag && item.objectionTag !== "None" && (
          <div style={{ marginTop: SPACING.sm }}>
            <span style={{
              fontSize: FONTS.size.xs,
              fontWeight: FONTS.weight.semibold,
              padding: `2px ${SPACING.sm}`,
              borderRadius: RADIUS.full,
              color: COLORS.warning,
              backgroundColor: `${COLORS.warning}18`,
            }}>
              Objection: {item.objectionTag}
            </span>
          </div>
        )}

      </div>
    </div>
  );
};

// ─── Helper sub-components ────────────────────────────────────────────────────

const ActionButton = ({ icon, label, color, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      style={{
        ...S.actionBtn,
        ...(hovered ? { borderColor: color + "80", color, backgroundColor: color + "0C" } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <span style={{ color: hovered ? color : COLORS.textMuted, transition: TRANSITIONS.fast }}>
        {icon}
      </span>
      {label}
    </button>
  );
};

const StatusPill = ({ label, color }) => (
  <span style={{
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    padding: `2px ${SPACING.sm}`,
    borderRadius: RADIUS.full,
    color,
    backgroundColor: `${color}18`,
    whiteSpace: "nowrap",
  }}>
    {label}
  </span>
);

// small icon button used in payment links row
const iconBtn_small = {
  background: "none",
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.base,
  color: COLORS.textSecondary,
  cursor: "pointer",
  padding: "4px 6px",
  display: "flex",
  alignItems: "center",
  transition: TRANSITIONS.fast,
  flexShrink: 0,
};

export default LeadDetailPage;
