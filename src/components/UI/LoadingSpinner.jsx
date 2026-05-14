// TIRAS CRM — Loading Spinners
// FullPageSpinner : covers entire viewport — used while Firebase auth resolves
// ButtonSpinner   : tiny inline spinner inside buttons during async actions

import React from "react";
import { COLORS, FONTS, SPACING, RADIUS, LAYOUT } from "../../theme";

// ─── Keyframe injection ───────────────────────────────────────────────────────
// Injected once into <head> — safe to call multiple times (checks first)

const injectSpinnerKeyframes = () => {
  if (document.getElementById("tiras-spinner-keyframes")) return;
  const style = document.createElement("style");
  style.id = "tiras-spinner-keyframes";
  style.textContent = `
    @keyframes tiras-spin {
      0%   { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes tiras-pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }
    @keyframes tiras-fadein {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
};

// ─── FullPageSpinner ──────────────────────────────────────────────────────────
// Props:
//   message  string   Optional message under spinner (default: "Loading TIRAS…")
//   overlay  bool     If true: fixed overlay over existing content (default: false = full page)

export const FullPageSpinner = ({ message = "Loading TIRAS…", overlay = false }) => {
  injectSpinnerKeyframes();

  const containerStyle = overlay
    ? {
        position:        "fixed",
        inset:           0,
        backgroundColor: "rgba(18, 18, 18, 0.85)",
        backdropFilter:  "blur(4px)",
        zIndex:          999,
        display:         "flex",
        flexDirection:   "column",
        alignItems:      "center",
        justifyContent:  "center",
        gap:             SPACING.lg,
      }
    : {
        minHeight:       "100vh",
        backgroundColor: COLORS.background,
        display:         "flex",
        flexDirection:   "column",
        alignItems:      "center",
        justifyContent:  "center",
        gap:             SPACING.lg,
        animation:       "tiras-fadein 0.3s ease",
      };

  return (
    <div style={containerStyle} role="status" aria-label={message}>

      {/* TIRAS logo mark */}
      <div
        style={{
          width:           "52px",
          height:          "52px",
          borderRadius:    RADIUS.lg,
          backgroundColor: COLORS.primary,
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          boxShadow:       `0 0 24px ${COLORS.primary}50`,
          animation:       "tiras-pulse 2s ease-in-out infinite",
          flexShrink:      0,
        }}
      >
        <span
          style={{
            color:       COLORS.textInverse,
            fontSize:    FONTS.size["2xl"],
            fontWeight:  FONTS.weight.bold,
            letterSpacing: "0.04em",
            lineHeight:  1,
          }}
        >
          T
        </span>
      </div>

      {/* Spinner ring */}
      <div
        style={{
          width:        "36px",
          height:       "36px",
          borderRadius: "50%",
          border:       `3px solid ${COLORS.border}`,
          borderTop:    `3px solid ${COLORS.primary}`,
          animation:    "tiras-spin 0.75s linear infinite",
          flexShrink:   0,
        }}
      />

      {/* Message */}
      {message && (
        <span
          style={{
            color:      COLORS.textMuted,
            fontSize:   FONTS.size.sm,
            fontWeight: FONTS.weight.medium,
            letterSpacing: "0.02em",
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
};

// ─── SectionSpinner ───────────────────────────────────────────────────────────
// Mid-size spinner for loading states inside cards or page sections
// Props:
//   height   string   Container min-height (default: "200px")
//   message  string   Optional label

export const SectionSpinner = ({ height = "200px", message = "" }) => {
  injectSpinnerKeyframes();

  return (
    <div
      style={{
        minHeight:      height,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        gap:            SPACING.md,
      }}
      role="status"
      aria-label={message || "Loading…"}
    >
      <div
        style={{
          width:        "28px",
          height:       "28px",
          borderRadius: "50%",
          border:       `2.5px solid ${COLORS.border}`,
          borderTop:    `2.5px solid ${COLORS.primary}`,
          animation:    "tiras-spin 0.75s linear infinite",
        }}
      />
      {message && (
        <span
          style={{
            color:     COLORS.textMuted,
            fontSize:  FONTS.size.sm,
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
};

// ─── ButtonSpinner ────────────────────────────────────────────────────────────
// Tiny inline spinner — sits inside a button next to label text
// Props:
//   size    number   Diameter in px (default: 14)
//   color   string   Spinner color (default: current text — inherits from button)
//
// Usage:
//   <button disabled={saving} style={STYLES.buttonPrimary}>
//     {saving && <ButtonSpinner />}
//     {saving ? "Saving…" : "Save Lead"}
//   </button>

export const ButtonSpinner = ({ size = 14, color = "currentColor" }) => {
  injectSpinnerKeyframes();

  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display:     "inline-flex",
        alignItems:  "center",
        flexShrink:  0,
      }}
    >
      <span
        style={{
          display:      "inline-block",
          width:        `${size}px`,
          height:       `${size}px`,
          borderRadius: "50%",
          border:       `2px solid transparent`,
          borderTop:    `2px solid ${color}`,
          borderRight:  `2px solid ${color}`,
          animation:    "tiras-spin 0.65s linear infinite",
        }}
      />
    </span>
  );
};

// ─── DotsSpinner ──────────────────────────────────────────────────────────────
// Three animated dots — used in chat-style or AI processing states
// e.g. "AI is generating summary…"

export const DotsSpinner = ({ color = COLORS.primary, size = 8 }) => {
  injectSpinnerKeyframes();

  const dotStyle = (delay) => ({
    width:        `${size}px`,
    height:       `${size}px`,
    borderRadius: "50%",
    backgroundColor: color,
    animation:    `tiras-pulse 1.2s ease-in-out ${delay}s infinite`,
    display:      "inline-block",
  });

  return (
    <span
      role="status"
      aria-label="Loading"
      style={{ display: "inline-flex", alignItems: "center", gap: `${size / 2}px` }}
    >
      <span style={dotStyle(0)} />
      <span style={dotStyle(0.2)} />
      <span style={dotStyle(0.4)} />
    </span>
  );
};

export default FullPageSpinner;
