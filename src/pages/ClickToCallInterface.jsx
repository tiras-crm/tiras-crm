// ─────────────────────────────────────────────────────────────────────────────
// TIRAS CRM — ClickToCallInterface
// File: src/pages/ClickToCallInterface.jsx
//
// HOW TO USE:
//   In src/pages/index.js replace:
//     export const ClickToCallInterface = () => <Placeholder name="Click to Call Interface" />;
//   with the full contents of this file.
//
// ROUTE: /agent/call
//   — Receives lead via navigation state: navigate("/agent/call", { state: { lead } })
//   — Also works standalone: agent can search/type a number manually
//
// PLIVO BROWSER SDK:
//   Add this to your public/index.html <head> before the closing </head> tag:
//     <script src="https://cdn.plivo.com/sdk/browser/v2/plivo.min.js"></script>
//   The SDK attaches to window.Plivo automatically.
//   Credentials (plivoUsername, plivoPassword) come from the company doc in Firestore.
//   Your Firebase Cloud Function must create a Plivo endpoint for each agent on signup.
//
// FIRESTORE WRITES:
//   calls/{autoId}     — created at call start, updated on end with duration + outcome
//   leads/{leadId}     — updated: lastCallAt, lastCallOutcome, leadScore, objectionTag
//
// ANTI-OVERLAP:
//   Before dialling, checks calls collection for any in_progress call to same leadId
//   by a different agent. If found, blocks the call with an alert.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
  limit,
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

const STYLE_ID = "tiras-call-styles";
const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const tag = document.createElement("style");
  tag.id = STYLE_ID;
  tag.textContent = `
    @keyframes tiras-fade-up     { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes tiras-spin        { to{transform:rotate(360deg)} }

    /* Ripple rings around call button */
    @keyframes tiras-ring-pulse  {
      0%   { transform:scale(1);   opacity:0.6; }
      100% { transform:scale(2.2); opacity:0;   }
    }

    /* Pulsing glow on the end-call button */
    @keyframes tiras-danger-pulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(224,82,82,0); }
      50%     { box-shadow: 0 0 0 12px rgba(224,82,82,0.25); }
    }

    /* Slide-in for post-call panel */
    @keyframes tiras-slide-up    { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }

    /* Connecting dots */
    @keyframes tiras-dot         {
      0%,80%,100% { opacity:0.25; transform:scale(0.7); }
      40%         { opacity:1;    transform:scale(1);   }
    }

    /* Timer digit flip */
    @keyframes tiras-flip        { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

    /* Success tick */
    @keyframes tiras-check-draw  { from{stroke-dashoffset:40} to{stroke-dashoffset:0} }
  `;
  document.head.appendChild(tag);
};

// ─── Constants ────────────────────────────────────────────────────────────────

const OUTCOMES = [
  { value: "Interested",     color: COLORS.success,   emoji: "🔥" },
  { value: "Not Interested", color: COLORS.danger,    emoji: "❌" },
  { value: "Call Back",      color: COLORS.accent,    emoji: "🔄" },
  { value: "No Answer",      color: COLORS.textMuted, emoji: "🔕" },
  { value: "Wrong Number",   color: COLORS.textMuted, emoji: "❓" },
  { value: "Busy",           color: COLORS.warning,   emoji: "⏳" },
  { value: "Voicemail",      color: COLORS.info,      emoji: "📬" },
];

const OBJECTION_TAGS = [
  "None", "Price", "Timing", "Not Interested", "Need More Info", "Wrong Person",
];

// Lead score from call duration (master doc spec)
const scoreFromDuration = (secs) => {
  if (secs === 0)   return "Dead";   // no answer repeated = Dead (simplified: 0s = no answer)
  if (secs < 30)    return "Cold";
  if (secs < 180)   return "Warm";
  return "Hot";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const padTwo = (n) => String(n).padStart(2, "0");

const formatTimer = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${padTwo(h)}:${padTwo(m)}:${padTwo(s)}`
    : `${padTwo(m)}:${padTwo(s)}`;
};

// ─── Call states ──────────────────────────────────────────────────────────────
const STATE = {
  IDLE:        "idle",
  CONNECTING:  "connecting",
  IN_CALL:     "in_call",
  POST_CALL:   "post_call",
  BLOCKED:     "blocked",   // anti-overlap: another agent is already calling this lead
};

// ─── Style objects ────────────────────────────────────────────────────────────

const S = {
  // Full page — centred column
  page: {
    minHeight: "100%",
    backgroundColor: COLORS.background,
    fontFamily: FONTS.family,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: `${SPACING["3xl"]} ${SPACING["2xl"]}`,
  },

  // Back row
  topRow: {
    width: "100%",
    maxWidth: "520px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING["2xl"],
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

  // Call card — main container
  card: {
    width: "100%",
    maxWidth: "480px",
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.xl,
    boxShadow: SHADOWS.lg,
    overflow: "hidden",
    animation: "tiras-fade-up 0.3s ease 40ms both",
  },

  // ── Lead info header ────────────────────────────────────────────────────────
  leadHeader: {
    padding: `${SPACING["2xl"]} ${SPACING["2xl"]} ${SPACING.xl}`,
    borderBottom: `1px solid ${COLORS.border}`,
    textAlign: "center",
  },

  avatarRing: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    backgroundColor: COLORS.primaryMuted,
    border: `2px solid ${COLORS.primary}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto",
    marginBottom: SPACING.base,
  },

  avatarLetter: {
    color: COLORS.primary,
    fontSize: FONTS.size["3xl"],
    fontWeight: FONTS.weight.bold,
    lineHeight: 1,
  },

  leadName: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size["2xl"],
    fontWeight: FONTS.weight.bold,
    letterSpacing: "-0.01em",
    marginBottom: SPACING.xs,
  },

  leadPhone: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.lg,
    fontFamily: FONTS.mono,
    letterSpacing: "0.08em",
    marginBottom: SPACING.sm,
  },

  leadMeta: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },

  scoreDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
  },

  // ── IDLE state body ─────────────────────────────────────────────────────────
  idleBody: {
    padding: `${SPACING["2xl"]} ${SPACING["2xl"]} ${SPACING["3xl"]}`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  // Manual phone input (when no lead passed)
  phoneInputWrap: {
    width: "100%",
    marginBottom: SPACING["2xl"],
  },
  phoneLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    marginBottom: SPACING.sm,
    display: "block",
    letterSpacing: "0.03em",
  },
  phoneInput: {
    backgroundColor: COLORS.inputBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.mono,
    fontSize: FONTS.size.xl,
    letterSpacing: "0.1em",
    padding: `${SPACING.md} ${SPACING.xl}`,
    outline: "none",
    width: "100%",
    textAlign: "center",
    boxSizing: "border-box",
    transition: TRANSITIONS.fast,
  },

  // Big call button ring + button
  callRingWrap: {
    position: "relative",
    width: "110px",
    height: "110px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING["2xl"],
  },

  ring: {
    position: "absolute",
    width: "110px",
    height: "110px",
    borderRadius: "50%",
    border: `2px solid ${COLORS.success}`,
    animationFillMode: "both",
  },

  callBtn: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    backgroundColor: COLORS.success,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: TRANSITIONS.base,
    boxShadow: `0 6px 24px ${COLORS.success}45`,
    position: "relative",
    zIndex: 1,
    flexShrink: 0,
  },

  callBtnLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    letterSpacing: "0.04em",
  },

  // Last call chip
  lastCallChip: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: COLORS.surfaceActive,
    borderRadius: RADIUS.full,
    padding: `${SPACING.xs} ${SPACING.md}`,
    marginTop: SPACING.base,
  },

  // ── CONNECTING state ─────────────────────────────────────────────────────────
  connectingBody: {
    padding: `${SPACING["3xl"]} ${SPACING["2xl"]}`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: SPACING.lg,
  },

  connectingLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.medium,
    display: "flex",
    alignItems: "center",
    gap: SPACING.sm,
  },

  dot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: COLORS.primary,
  },

  endEarlyBtn: {
    backgroundColor: "transparent",
    border: `1px solid ${COLORS.danger}50`,
    borderRadius: RADIUS.full,
    color: COLORS.danger,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    padding: `${SPACING.sm} ${SPACING.xl}`,
    cursor: "pointer",
    transition: TRANSITIONS.base,
  },

  // ── IN_CALL state ─────────────────────────────────────────────────────────
  inCallBody: {
    padding: `${SPACING["2xl"]} ${SPACING["2xl"]} ${SPACING["3xl"]}`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  // Live timer
  timerWrap: {
    marginBottom: SPACING["2xl"],
    textAlign: "center",
  },

  timerDigits: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size["5xl"],
    fontWeight: FONTS.weight.bold,
    fontFamily: FONTS.mono,
    letterSpacing: "0.1em",
    lineHeight: 1,
    animation: "tiras-flip 0.15s ease",
  },

  timerLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    marginTop: SPACING.xs,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },

  // Recording badge
  recordingBadge: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: `${COLORS.danger}14`,
    border: `1px solid ${COLORS.danger}30`,
    borderRadius: RADIUS.full,
    padding: `4px ${SPACING.md}`,
    marginBottom: SPACING["2xl"],
  },
  recDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: COLORS.danger,
    animation: "tiras-dot 1.4s ease infinite",
  },
  recLabel: {
    color: COLORS.danger,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },

  // Control buttons row
  controlRow: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.xl,
    marginBottom: SPACING["2xl"],
  },

  controlBtn: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    border: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.surfaceActive,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    transition: TRANSITIONS.base,
    gap: "3px",
  },

  controlBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    boxShadow: SHADOWS.primary,
  },

  controlBtnLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    letterSpacing: "0.03em",
  },

  // Big end-call button
  endCallBtn: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    backgroundColor: COLORS.danger,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: TRANSITIONS.base,
    animation: "tiras-danger-pulse 2s ease infinite",
    boxShadow: `0 6px 24px ${COLORS.danger}45`,
  },

  endCallLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    letterSpacing: "0.04em",
    marginTop: SPACING.md,
  },

  // Quick note during call
  inCallNote: {
    width: "100%",
    backgroundColor: COLORS.inputBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.sm,
    padding: `${SPACING.sm} ${SPACING.md}`,
    outline: "none",
    resize: "none",
    height: "60px",
    boxSizing: "border-box",
    transition: TRANSITIONS.fast,
    marginTop: SPACING.lg,
  },

  // ── POST_CALL state ─────────────────────────────────────────────────────────
  postCallBody: {
    padding: SPACING["2xl"],
    animation: "tiras-slide-up 0.3s ease both",
  },

  postCallHeader: {
    display: "flex",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },

  postCallTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
  },

  postCallDuration: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.mono,
    backgroundColor: COLORS.surfaceActive,
    padding: `2px ${SPACING.sm}`,
    borderRadius: RADIUS.full,
  },

  // Outcome grid
  outcomeGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },

  outcomeBtn: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    backgroundColor: "transparent",
    cursor: "pointer",
    padding: `${SPACING.sm} ${SPACING.md}`,
    display: "flex",
    alignItems: "center",
    gap: SPACING.sm,
    transition: TRANSITIONS.fast,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    textAlign: "left",
  },

  outcomeBtnActive: {
    backgroundColor: "transparent",
    fontWeight: FONTS.weight.semibold,
  },

  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: SPACING.sm,
  },

  noteTextarea: {
    width: "100%",
    backgroundColor: COLORS.inputBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    padding: `${SPACING.sm} ${SPACING.md}`,
    outline: "none",
    resize: "vertical",
    minHeight: "72px",
    boxSizing: "border-box",
    transition: TRANSITIONS.fast,
    marginBottom: SPACING.xl,
  },

  // Objection tag pills
  tagRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },

  tagPill: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.full,
    backgroundColor: "transparent",
    cursor: "pointer",
    padding: `4px ${SPACING.md}`,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.medium,
    color: COLORS.textSecondary,
    transition: TRANSITIONS.fast,
  },

  tagPillActive: {
    borderColor: COLORS.warning,
    backgroundColor: `${COLORS.warning}14`,
    color: COLORS.warning,
    fontWeight: FONTS.weight.bold,
  },

  // Divider
  divider: {
    height: "1px",
    backgroundColor: COLORS.border,
    marginBottom: SPACING.xl,
  },

  // Save row
  saveRow: {
    display: "flex",
    gap: SPACING.sm,
  },

  btnPrimary: {
    flex: 1,
    backgroundColor: COLORS.primary,
    color: "#121212",
    border: "none",
    borderRadius: RADIUS.md,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.semibold,
    padding: `${SPACING.md} ${SPACING.xl}`,
    cursor: "pointer",
    transition: TRANSITIONS.base,
    boxShadow: SHADOWS.primary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },

  btnSecondary: {
    backgroundColor: "transparent",
    color: COLORS.textSecondary,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.medium,
    padding: `${SPACING.md} ${SPACING.xl}`,
    cursor: "pointer",
    transition: TRANSITIONS.base,
  },

  // ── BLOCKED state ────────────────────────────────────────────────────────────
  blockedBody: {
    padding: `${SPACING["3xl"]} ${SPACING["2xl"]}`,
    textAlign: "center",
    animation: "tiras-fade-up 0.3s ease both",
  },

  blockedIcon: {
    fontSize: "40px",
    marginBottom: SPACING.base,
  },

  blockedTitle: {
    color: COLORS.danger,
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.bold,
    marginBottom: SPACING.sm,
  },

  blockedBody2: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.base,
    lineHeight: FONTS.lineHeight.relaxed,
    marginBottom: SPACING["2xl"],
  },

  // Saved confirmation
  savedCard: {
    width: "100%",
    maxWidth: "480px",
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.success}40`,
    borderRadius: RADIUS.xl,
    padding: `${SPACING["3xl"]} ${SPACING["2xl"]}`,
    textAlign: "center",
    animation: "tiras-fade-up 0.3s ease both",
  },

  savedTitle: {
    color: COLORS.success,
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.bold,
    marginBottom: SPACING.sm,
    marginTop: SPACING.base,
  },

  savedBody: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.base,
    marginBottom: SPACING["2xl"],
  },

  spinner: {
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: `2px solid #12121240`,
    borderTopColor: "#121212",
    animation: "tiras-spin 0.7s linear infinite",
    flexShrink: 0,
  },
};

// ─── SVG icons ────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

const PhoneIcon = ({ size = 28, color = "#121212" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const PhoneOffIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.85"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const MicIcon = ({ muted }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={muted ? COLORS.danger : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {muted && <line x1="1" y1="1" x2="23" y2="23" stroke={COLORS.danger}/>}
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const VolumeIcon = ({ low }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    {!low && <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>}
    {!low && <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>}
    {low  && <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>}
  </svg>
);

const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
);

const SparkleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
  </svg>
);

const CheckCircle = () => (
  <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
    <circle cx="26" cy="26" r="24" fill={`${COLORS.success}18`} stroke={COLORS.success} strokeWidth="2"/>
    <polyline points="16 26 22 32 36 18" stroke={COLORS.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      strokeDasharray="40" strokeDashoffset="40" style={{ animation: "tiras-check-draw 0.4s ease 0.2s forwards" }}/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// ClickToCallInterface Component
// ─────────────────────────────────────────────────────────────────────────────

export const ClickToCallInterface = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { currentUser, companyId, userProfile } = useAuth();

  // Lead passed from MyLeadsList or LeadDetailPage via location.state
  const [lead, setLead] = useState(location.state?.lead ?? null);

  // Manual phone input (when no lead in state)
  const [manualPhone, setManualPhone] = useState("");

  // ─── Call state machine ─────────────────────────────────────────────────────
  const [callState,  setCallState]  = useState(STATE.IDLE);
  const [callSaved,  setCallSaved]  = useState(false);   // final saved confirmation

  // Timer
  const [elapsed,  setElapsed]  = useState(0);  // seconds
  const timerRef = useRef(null);

  // In-call controls
  const [isMuted,  setIsMuted]  = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [speakerOn,setSpeakerOn]= useState(false);
  const [liveNote, setLiveNote] = useState("");   // quick note during call

  // Post-call form
  const [selectedOutcome,   setSelectedOutcome]   = useState(null);
  const [postCallNote,      setPostCallNote]       = useState("");
  const [selectedTag,       setSelectedTag]        = useState("None");
  const [savingCall,        setSavingCall]         = useState(false);

  // Plivo SDK + call doc ref
  const plivoClientRef = useRef(null);    // Plivo.BrowserSdk instance
  const callDocIdRef   = useRef(null);    // Firestore doc id of in-progress call
  const callStartRef   = useRef(null);    // JS Date when call connected

  // Blocked state details
  const [blockedByAgent, setBlockedByAgent] = useState(null);

  // ─── Inject styles ─────────────────────────────────────────────────────────
  useEffect(() => { injectStyles(); }, []);

  // ─── Plivo SDK initialisation ───────────────────────────────────────────────
  // Requires window.Plivo from CDN script in public/index.html
  // Agent Plivo credentials are stored in the user's Firestore profile:
  //   users/{uid}.plivoUsername
  //   users/{uid}.plivoPassword
  // These are created by a Cloud Function on agent onboarding.

  useEffect(() => {
    const initPlivo = () => {
      if (!window.Plivo) {
        console.warn("TIRAS: Plivo SDK not loaded. Add <script src='https://cdn.plivo.com/sdk/browser/v2/plivo.min.js'> to public/index.html");
        return;
      }
      if (!userProfile?.plivoUsername || !userProfile?.plivoPassword) {
        console.warn("TIRAS: No Plivo credentials on user profile. Ensure Cloud Function created an endpoint for this agent.");
        return;
      }

      const client = new window.Plivo.BrowserSdk({
        debug:      "ERROR",
        permOnClick: false,
        enableTracking: false,
      });

      // ── Plivo event handlers ────────────────────────────────────────────────
      client.client.on("onWebrtcNotSupported",    () => console.error("WebRTC not supported"));
      client.client.on("onLoginFailed",           () => console.error("Plivo login failed"));
      client.client.on("onLogin",                 () => console.info("Plivo: logged in"));

      client.client.on("onCallConnected", () => {
        callStartRef.current = new Date();
        setCallState(STATE.IN_CALL);
        startTimer();
      });

      client.client.on("onCallTerminated", () => {
        stopTimer();
        // If the remote side hung up, move to post-call
        if (callState !== STATE.POST_CALL) {
          setCallState(STATE.POST_CALL);
          // Pre-fill note from live note
          setPostCallNote((prev) => prev || liveNote);
        }
      });

      client.client.login(userProfile.plivoUsername, userProfile.plivoPassword);
      plivoClientRef.current = client;
    };

    initPlivo();

    return () => {
      try { plivoClientRef.current?.client?.logout(); } catch { /* noop */ }
    };
  }, [userProfile]); // eslint-disable-line

  // ─── Timer helpers ──────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    clearInterval(timerRef.current);
  }, []);

  useEffect(() => () => clearInterval(timerRef.current), []);

  // ─── Anti-overlap check ─────────────────────────────────────────────────────
  const checkOverlap = async (leadId) => {
    if (!leadId) return false;
    const q = query(
      collection(db, COLLECTIONS.CALLS),
      where("leadId",    "==", leadId),
      where("companyId", "==", companyId),
      where("status",    "==", "in_progress"),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return false;

    const activeCall = snap.docs[0].data();
    if (activeCall.agentId === currentUser.uid) return false; // same agent resumed

    setBlockedByAgent(activeCall.agentDisplayName ?? "Another agent");
    setCallState(STATE.BLOCKED);
    return true;
  };

  // ─── Initiate call ──────────────────────────────────────────────────────────
  const handleCall = async () => {
    const phone = lead?.phone ?? manualPhone.replace(/\D/g, "");
    if (!phone) return;

    // Anti-overlap
    if (lead?.id) {
      const blocked = await checkOverlap(lead.id);
      if (blocked) return;
    }

    setCallState(STATE.CONNECTING);

    try {
      // Create in-progress call doc in Firestore
      const callRef = await addDoc(collection(db, COLLECTIONS.CALLS), {
        leadId:           lead?.id     ?? null,
        leadName:         lead?.name   ?? manualPhone,
        companyId,
        agentId:          currentUser.uid,
        agentDisplayName: userProfile?.displayName ?? currentUser.email,
        phone,
        status:           "in_progress",
        createdAt:        serverTimestamp(),
        type:             "call",
      });
      callDocIdRef.current = callRef.id;

      // Initiate Plivo call
      // Format: 91XXXXXXXXXX  (India +91 prefix)
      const dialNumber = phone.startsWith("91") ? phone : `91${phone}`;

      if (plivoClientRef.current) {
        plivoClientRef.current.client.call(dialNumber, {
          // Optional Plivo custom headers — pass leadId for server-side tracking
          "X-PH-LeadId":    lead?.id ?? "",
          "X-PH-CompanyId": companyId,
          "X-PH-AgentId":   currentUser.uid,
        });
        // onCallConnected event will fire → startTimer → set IN_CALL
      } else {
        // ── SDK not loaded: simulate for dev/testing ──
        console.warn("TIRAS: Plivo SDK not available — simulating call connection in 2s");
        setTimeout(() => {
          callStartRef.current = new Date();
          setCallState(STATE.IN_CALL);
          startTimer();
        }, 2000);
      }

    } catch (err) {
      console.error("TIRAS: Call initiation failed", err);
      setCallState(STATE.IDLE);
    }
  };

  // ─── End call ───────────────────────────────────────────────────────────────
  const handleEndCall = () => {
    // Hang up via Plivo
    try {
      plivoClientRef.current?.client?.hangup();
    } catch { /* noop — SDK may not be loaded in dev */ }

    stopTimer();
    setCallState(STATE.POST_CALL);
    setPostCallNote(liveNote);
    setLiveNote("");
  };

  // ─── Mute / Hold / Speaker ──────────────────────────────────────────────────
  const toggleMute = () => {
    try {
      isMuted
        ? plivoClientRef.current?.client?.unmute()
        : plivoClientRef.current?.client?.mute();
    } catch { /* noop */ }
    setIsMuted((v) => !v);
  };

  const toggleHold = () => {
    // Plivo doesn't have a direct hold in browser SDK v2; handled server-side via REST API
    // Cloud Function endpoint: PUT /v1/Account/{authId}/Call/{callUuid}/ with aleg_url
    setIsOnHold((v) => !v);
  };

  // ─── Save post-call record ───────────────────────────────────────────────────
  const handleSaveCall = async () => {
    if (!selectedOutcome) return;
    setSavingCall(true);

    try {
      const durationSecs = elapsed;
      const leadScore    = scoreFromDuration(
        selectedOutcome === "No Answer" || selectedOutcome === "Wrong Number" || selectedOutcome === "Busy"
          ? 0 : durationSecs
      );

      // Update the in-progress call doc
      if (callDocIdRef.current) {
        await updateDoc(doc(db, COLLECTIONS.CALLS, callDocIdRef.current), {
          status:       "completed",
          outcome:      selectedOutcome,
          duration:     durationSecs,
          note:         postCallNote.trim(),
          objectionTag: selectedTag,
          leadScore,
          endedAt:      serverTimestamp(),
          // recordingUrl will be populated by Cloud Function after Plivo webhook
          // The Cloud Function listens for Plivo's recordingCompleted webhook,
          // fetches the recording URL, and updates this doc automatically.
        });
      }

      // Update lead doc
      if (lead?.id) {
        const leadUpdates = {
          lastCallAt:      serverTimestamp(),
          lastCallOutcome: selectedOutcome,
          leadScore,
          objectionTag:    selectedTag !== "None" ? selectedTag : null,
          updatedAt:       serverTimestamp(),
          updatedBy:       currentUser.uid,
        };

        // Auto-close won
        if (selectedOutcome === "Interested") {
          // Don't auto-change stage — just score. Manager decides Closed Won.
        }

        await updateDoc(doc(db, COLLECTIONS.LEADS, lead.id), leadUpdates);
      }

      setCallSaved(true);
    } catch (err) {
      console.error("TIRAS: Failed to save call record", err);
    } finally {
      setSavingCall(false);
    }
  };

  // ─── Cancel post-call (discard) ─────────────────────────────────────────────
  const handleDiscard = async () => {
    // Mark call doc as abandoned
    if (callDocIdRef.current) {
      try {
        await updateDoc(doc(db, COLLECTIONS.CALLS, callDocIdRef.current), {
          status:  "abandoned",
          endedAt: serverTimestamp(),
        });
      } catch { /* noop */ }
    }
    navigate(lead?.id ? `/agent/lead/${lead.id}` : "/agent/leads");
  };

  // ─── Computed values ─────────────────────────────────────────────────────────
  const displayPhone  = lead?.phone ?? manualPhone ?? "—";
  const displayName   = lead?.name  ?? (manualPhone ? `+91 ${manualPhone}` : "Unknown");
  const avatarLetter  = (lead?.name ?? "?")[0]?.toUpperCase();
  const scoreConf     = {
    Hot:  { color: COLORS.hot,  label: "Hot"  },
    Warm: { color: COLORS.warm, label: "Warm" },
    Cold: { color: COLORS.cold, label: "Cold" },
    Dead: { color: COLORS.dead, label: "Dead" },
  }[lead?.leadScore] ?? null;

  // ─── Render: saved confirmation ───────────────────────────────────────────────
  if (callSaved) {
    return (
      <div style={S.page}>
        <div style={S.savedCard}>
          <CheckCircle />
          <div style={S.savedTitle}>Call logged</div>
          <div style={S.savedBody}>
            <strong style={{ color: COLORS.accent }}>{selectedOutcome}</strong> — {formatTimer(elapsed)} with {displayName}
            <br />
            Lead score updated to{" "}
            <strong style={{ color: scoreConf?.color ?? COLORS.textPrimary }}>
              {scoreFromDuration(selectedOutcome === "No Answer" ? 0 : elapsed)}
            </strong>
            {postCallNote && <span>, note saved</span>}
            {selectedTag !== "None" && <span>, objection tagged: <strong>{selectedTag}</strong></span>}.
          </div>
          <div style={{ display: "flex", gap: SPACING.sm, justifyContent: "center", flexWrap: "wrap" }}>
            {lead?.id && (
              <button
                style={S.btnPrimary}
                onClick={() => navigate(`/agent/lead/${lead.id}`)}
              >
                View Lead
              </button>
            )}
            <button
              style={{ ...S.btnPrimary, backgroundColor: COLORS.success, boxShadow: `0 4px 16px ${COLORS.success}35` }}
              onClick={() => {
                setCallState(STATE.IDLE);
                setElapsed(0);
                setSelectedOutcome(null);
                setPostCallNote("");
                setSelectedTag("None");
                setLiveNote("");
                callDocIdRef.current = null;
                setCallSaved(false);
              }}
            >
              Call Again
            </button>
            <button
              style={S.btnSecondary}
              onClick={() => navigate("/agent/leads")}
            >
              My Leads
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>

      {/* Top row: back button */}
      <div style={S.topRow}>
        <button
          style={S.backBtn}
          onClick={() => lead?.id ? navigate(`/agent/lead/${lead.id}`) : navigate("/agent/leads")}
          onMouseEnter={(e) => e.currentTarget.style.color = COLORS.accent}
          onMouseLeave={(e) => e.currentTarget.style.color = COLORS.textMuted}
          disabled={callState === STATE.IN_CALL}
        >
          <BackIcon />
          {lead?.id ? lead.name : "My Leads"}
        </button>
        {callState === STATE.IN_CALL && (
          <span style={{
            display: "flex",
            alignItems: "center",
            gap: SPACING.xs,
            color: COLORS.success,
            fontSize: FONTS.size.sm,
            fontWeight: FONTS.weight.semibold,
          }}>
            <span style={{ ...S.recDot, backgroundColor: COLORS.success }} /> Live
          </span>
        )}
      </div>

      {/* Main call card */}
      <div style={S.card}>

        {/* Lead header — always visible */}
        <div style={S.leadHeader}>
          <div style={S.avatarRing}>
            <span style={S.avatarLetter}>{avatarLetter ?? "?"}</span>
          </div>
          <div style={S.leadName}>{displayName}</div>
          <div style={S.leadPhone}>{displayPhone}</div>
          <div style={S.leadMeta}>
            {lead?.source && <span>{lead.source}</span>}
            {lead?.source && scoreConf && <span>·</span>}
            {scoreConf && (
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ ...S.scoreDot, backgroundColor: scoreConf.color }} />
                {scoreConf.label}
              </span>
            )}
            {lead?.company && <><span>·</span><span>{lead.company}</span></>}
          </div>
        </div>

        {/* ── IDLE ──────────────────────────────────────────────────────────── */}
        {callState === STATE.IDLE && (
          <div style={S.idleBody}>

            {/* Manual phone input when no lead in state */}
            {!lead && (
              <div style={S.phoneInputWrap}>
                <label style={S.phoneLabel}>Enter phone number</label>
                <input
                  type="tel"
                  placeholder="98XXXXXXXX"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  style={S.phoneInput}
                  maxLength={10}
                  onFocus={(e) => { e.target.style.border = `1px solid ${COLORS.inputFocus}`; e.target.style.boxShadow = `0 0 0 3px ${COLORS.primary}22`; }}
                  onBlur={(e)  => { e.target.style.border = `1px solid ${COLORS.border}`;     e.target.style.boxShadow = "none"; }}
                />
              </div>
            )}

            {/* Ripple ring + call button */}
            <div style={S.callRingWrap}>
              {/* Animated rings */}
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    ...S.ring,
                    animation: `tiras-ring-pulse 2.4s ease ${i * 0.8}s infinite`,
                  }}
                />
              ))}
              <button
                style={{
                  ...S.callBtn,
                  ...((lead?.phone || manualPhone.length === 10)
                    ? {}
                    : { opacity: 0.4, cursor: "not-allowed" }),
                }}
                onClick={handleCall}
                disabled={!lead?.phone && manualPhone.length !== 10}
              >
                <PhoneIcon size={30} color="#121212" />
              </button>
            </div>

            <span style={S.callBtnLabel}>Tap to call</span>

            {/* Last call info chip */}
            {lead?.lastCallAt && (
              <div style={S.lastCallChip}>
                <span style={{ color: OUTCOME_COLORS[lead.lastCallOutcome] ?? COLORS.textMuted, fontSize: "10px" }}>●</span>
                <span style={{ color: COLORS.textMuted, fontSize: FONTS.size.xs }}>
                  Last: <strong style={{ color: COLORS.textSecondary }}>{lead.lastCallOutcome ?? "Unknown"}</strong>
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── CONNECTING ────────────────────────────────────────────────────── */}
        {callState === STATE.CONNECTING && (
          <div style={S.connectingBody}>
            <div style={S.connectingLabel}>
              Connecting
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    ...S.dot,
                    animation: `tiras-dot 1.2s ease ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
            <div style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm }}>
              Dialling {displayPhone}…
            </div>
            <button
              style={S.endEarlyBtn}
              onClick={handleEndCall}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${COLORS.danger}14`; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── IN CALL ───────────────────────────────────────────────────────── */}
        {callState === STATE.IN_CALL && (
          <div style={S.inCallBody}>

            {/* Timer */}
            <div style={S.timerWrap}>
              <div style={S.timerDigits}>{formatTimer(elapsed)}</div>
              <div style={S.timerLabel}>Duration</div>
            </div>

            {/* Recording badge */}
            <div style={S.recordingBadge}>
              <div style={S.recDot} />
              <span style={S.recLabel}>Recording</span>
            </div>

            {/* Control buttons */}
            <div style={S.controlRow}>

              {/* Mute */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <button
                  style={{
                    ...S.controlBtn,
                    ...(isMuted ? { backgroundColor: COLORS.danger, borderColor: COLORS.danger } : {}),
                  }}
                  onClick={toggleMute}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  <MicIcon muted={isMuted} />
                </button>
                <span style={S.controlBtnLabel}>{isMuted ? "Unmuted" : "Mute"}</span>
              </div>

              {/* End call — centre, large */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <button
                  style={S.endCallBtn}
                  onClick={handleEndCall}
                  title="End call"
                >
                  <PhoneOffIcon size={28} />
                </button>
                <span style={S.endCallLabel}>End Call</span>
              </div>

              {/* Hold */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <button
                  style={{
                    ...S.controlBtn,
                    ...(isOnHold ? S.controlBtnActive : {}),
                  }}
                  onClick={toggleHold}
                  title={isOnHold ? "Resume" : "Hold"}
                >
                  <PauseIcon />
                </button>
                <span style={S.controlBtnLabel}>{isOnHold ? "Resume" : "Hold"}</span>
              </div>

            </div>

            {/* Quick note during call */}
            <textarea
              placeholder="Quick note while on call…"
              value={liveNote}
              onChange={(e) => setLiveNote(e.target.value)}
              style={S.inCallNote}
              onFocus={(e) => { e.target.style.border = `1px solid ${COLORS.inputFocus}`; }}
              onBlur={(e)  => { e.target.style.border = `1px solid ${COLORS.border}`;     }}
            />
          </div>
        )}

        {/* ── POST CALL ─────────────────────────────────────────────────────── */}
        {callState === STATE.POST_CALL && (
          <div style={S.postCallBody}>

            {/* Header */}
            <div style={S.postCallHeader}>
              <span style={S.postCallTitle}>Log this call</span>
              <span style={S.postCallDuration}>{formatTimer(elapsed)}</span>
            </div>

            {/* Outcome selector */}
            <div style={S.sectionLabel}>Call Outcome *</div>
            <div style={S.outcomeGrid}>
              {OUTCOMES.map(({ value, color, emoji }) => (
                <button
                  key={value}
                  style={{
                    ...S.outcomeBtn,
                    ...(selectedOutcome === value
                      ? {
                          ...S.outcomeBtnActive,
                          borderColor: color,
                          color,
                          backgroundColor: `${color}10`,
                        }
                      : {}),
                  }}
                  onClick={() => setSelectedOutcome(value)}
                >
                  <span style={{ fontSize: "16px" }}>{emoji}</span>
                  <span>{value}</span>
                </button>
              ))}
            </div>

            {/* Note */}
            <div style={S.sectionLabel}>Note</div>
            <textarea
              placeholder="What was discussed? Key points, objections, next steps…"
              value={postCallNote}
              onChange={(e) => setPostCallNote(e.target.value)}
              style={S.noteTextarea}
              onFocus={(e) => { e.target.style.border = `1px solid ${COLORS.inputFocus}`; e.target.style.boxShadow = `0 0 0 3px ${COLORS.primary}22`; }}
              onBlur={(e)  => { e.target.style.border = `1px solid ${COLORS.border}`;     e.target.style.boxShadow = "none"; }}
            />

            {/* Objection tag */}
            <div style={S.sectionLabel}>Objection Raised</div>
            <div style={S.tagRow}>
              {OBJECTION_TAGS.map((tag) => (
                <button
                  key={tag}
                  style={{
                    ...S.tagPill,
                    ...(selectedTag === tag ? S.tagPillActive : {}),
                  }}
                  onClick={() => setSelectedTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* AI summary hint */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: SPACING.sm,
              backgroundColor: `${COLORS.primary}0C`,
              border: `1px solid ${COLORS.primary}25`,
              borderRadius: RADIUS.md,
              padding: `${SPACING.sm} ${SPACING.md}`,
              marginBottom: SPACING.xl,
            }}>
              <SparkleIcon />
              <span style={{ color: COLORS.textSecondary, fontSize: FONTS.size.sm, lineHeight: FONTS.lineHeight.normal }}>
                AI summary will be generated automatically once the recording is processed (usually within 60 seconds of saving).
              </span>
            </div>

            <div style={S.divider} />

            {/* Save / discard */}
            <div style={S.saveRow}>
              <button
                style={{ ...S.btnSecondary, flexShrink: 0 }}
                onClick={handleDiscard}
                disabled={savingCall}
              >
                Discard
              </button>
              <button
                style={{
                  ...S.btnPrimary,
                  opacity: !selectedOutcome || savingCall ? 0.5 : 1,
                  cursor: !selectedOutcome ? "not-allowed" : "pointer",
                }}
                onClick={handleSaveCall}
                disabled={!selectedOutcome || savingCall}
              >
                {savingCall ? (
                  <><div style={S.spinner} /> Saving…</>
                ) : (
                  "Save Call Log"
                )}
              </button>
            </div>

          </div>
        )}

        {/* ── BLOCKED (anti-overlap) ─────────────────────────────────────────── */}
        {callState === STATE.BLOCKED && (
          <div style={S.blockedBody}>
            <div style={S.blockedIcon}>🔒</div>
            <div style={S.blockedTitle}>Lead Already Being Called</div>
            <div style={S.blockedBody2}>
              <strong style={{ color: COLORS.textPrimary }}>{blockedByAgent}</strong> is currently on a call with{" "}
              <strong style={{ color: COLORS.accent }}>{displayName}</strong>.
              <br /><br />
              You cannot call this lead simultaneously. Please wait for their call to end or contact your manager.
            </div>
            <div style={{ display: "flex", gap: SPACING.sm, justifyContent: "center" }}>
              <button
                style={{ ...S.btnSecondary }}
                onClick={() => setCallState(STATE.IDLE)}
              >
                Go Back
              </button>
              {lead?.id && (
                <button
                  style={{ ...S.btnPrimary }}
                  onClick={() => navigate(`/agent/lead/${lead.id}`)}
                >
                  View Lead
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Info note below card */}
      {callState === STATE.IDLE && (
        <div style={{
          marginTop: SPACING.xl,
          color: COLORS.textMuted,
          fontSize: FONTS.size.xs,
          textAlign: "center",
          maxWidth: "360px",
          lineHeight: FONTS.lineHeight.relaxed,
        }}>
          All calls are recorded automatically. Recording is stored and linked to this lead's timeline.
        </div>
      )}

    </div>
  );
};

// ─── Outcome colour map (used in idle state for last-call chip) ───────────────
const OUTCOME_COLORS = {
  "Interested":     COLORS.success,
  "Not Interested": COLORS.danger,
  "Call Back":      COLORS.accent,
  "No Answer":      COLORS.textMuted,
  "Wrong Number":   COLORS.textMuted,
  "Busy":           COLORS.warning,
  "Voicemail":      COLORS.info,
};

export default ClickToCallInterface;
