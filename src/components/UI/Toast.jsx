// TIRAS CRM — Toast Notification Component
// Auto-dismissing toasts in bottom-right corner
// Types: success | error | warning | info
// Usage:
//   const { showToast } = useToast();
//   showToast("Lead saved!", "success");
//   showToast("Call failed", "error");
//   showToast("Follow-up overdue", "warning");
//   showToast("Recording ready", "info");

import React, {
  useState,
  useCallback,
  useContext,
  createContext,
  useRef,
} from "react";
import {
  MdCheckCircle,
  MdError,
  MdWarning,
  MdInfo,
  MdClose,
} from "react-icons/md";
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, TRANSITIONS } from "../../theme";

// ─── Toast Config ─────────────────────────────────────────────────────────────

const TOAST_DURATION = 3500;   // ms before auto-dismiss
const MAX_TOASTS     = 5;      // max visible at once — oldest removed first

const TOAST_STYLES = {
  success: {
    icon:        MdCheckCircle,
    iconColor:   COLORS.success,
    borderColor: COLORS.success,
    bgColor:     `${COLORS.success}18`,
  },
  error: {
    icon:        MdError,
    iconColor:   COLORS.danger,
    borderColor: COLORS.danger,
    bgColor:     `${COLORS.danger}18`,
  },
  warning: {
    icon:        MdWarning,
    iconColor:   COLORS.accent,
    borderColor: COLORS.accent,
    bgColor:     `${COLORS.accent}18`,
  },
  info: {
    icon:        MdInfo,
    iconColor:   COLORS.info,
    borderColor: COLORS.info,
    bgColor:     `${COLORS.info}18`,
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

// ─── ToastProvider ────────────────────────────────────────────────────────────
// Wrap your app (or just the authenticated layout) with this provider
// Already included in App.jsx layout — no need to add again

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  // ── showToast ──────────────────────────────────────────────────────────────
  // @param message   string   Text to display
  // @param type      string   "success" | "error" | "warning" | "info"
  // @param duration  number   ms before auto-dismiss (default: TOAST_DURATION)

  const showToast = useCallback((message, type = "info", duration = TOAST_DURATION) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    setToasts((prev) => {
      // Remove oldest if at max capacity
      const trimmed = prev.length >= MAX_TOASTS ? prev.slice(1) : prev;
      return [...trimmed, { id, message, type, visible: true }];
    });

    // Auto-dismiss after duration
    timersRef.current[id] = setTimeout(() => {
      dismissToast(id);
    }, duration);

    return id;
  }, []);

  // ── dismissToast ───────────────────────────────────────────────────────────

  const dismissToast = useCallback((id) => {
    // Clear auto-dismiss timer
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }

    // Fade out first, then remove from DOM
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: false } : t))
    );

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300); // matches CSS transition duration
  }, []);

  // ── Convenience shortcuts ──────────────────────────────────────────────────

  const success = useCallback((msg, dur) => showToast(msg, "success", dur), [showToast]);
  const error   = useCallback((msg, dur) => showToast(msg, "error",   dur), [showToast]);
  const warning = useCallback((msg, dur) => showToast(msg, "warning", dur), [showToast]);
  const info    = useCallback((msg, dur) => showToast(msg, "info",    dur), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

// ─── useToast ─────────────────────────────────────────────────────────────────
// Hook — use anywhere inside ToastProvider
// const { showToast, success, error, warning, info } = useToast();

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider. Wrap your layout with <ToastProvider>.");
  }
  return ctx;
};

// ─── ToastContainer ───────────────────────────────────────────────────────────
// Fixed bottom-right stack — renders all active toasts

const ToastContainer = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position:      "fixed",
        bottom:        SPACING["2xl"],
        right:         SPACING["2xl"],
        zIndex:        9999,
        display:       "flex",
        flexDirection: "column",
        gap:           SPACING.sm,
        pointerEvents: "none",   // container doesn't block clicks
        maxWidth:      "360px",
        width:         "100%",
      }}
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};

// ─── ToastItem ────────────────────────────────────────────────────────────────
// Individual toast card

const ToastItem = ({ toast, onDismiss }) => {
  const config = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
  const Icon   = config.icon;

  return (
    <div
      role="alert"
      style={{
        display:         "flex",
        alignItems:      "flex-start",
        gap:             SPACING.sm,
        backgroundColor: COLORS.surface,
        border:          `1px solid ${config.borderColor}`,
        borderLeft:      `4px solid ${config.borderColor}`,
        borderRadius:    RADIUS.lg,
        padding:         `${SPACING.md} ${SPACING.base}`,
        boxShadow:       SHADOWS.lg,
        pointerEvents:   "all",
        cursor:          "default",
        backdropFilter:  "blur(8px)",
        backgroundColor: config.bgColor,

        // Slide in from right / fade out
        opacity:         toast.visible ? 1 : 0,
        transform:       toast.visible ? "translateX(0)" : "translateX(24px)",
        transition:      `opacity 0.3s ease, transform 0.3s ease`,

        // Ensure content doesn't overflow
        wordBreak:       "break-word",
        minWidth:        "240px",
      }}
    >
      {/* Icon */}
      <div style={{ flexShrink: 0, paddingTop: "1px" }}>
        <Icon size={18} color={config.iconColor} />
      </div>

      {/* Message */}
      <div
        style={{
          flex:       1,
          color:      COLORS.textPrimary,
          fontSize:   FONTS.size.base,
          lineHeight: FONTS.lineHeight.normal,
        }}
      >
        {toast.message}
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          flexShrink:      0,
          background:      "none",
          border:          "none",
          cursor:          "pointer",
          color:           COLORS.textMuted,
          padding:         "2px",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          borderRadius:    RADIUS.sm,
          transition:      TRANSITIONS.fast,
          lineHeight:      1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = COLORS.textPrimary;
          e.currentTarget.style.backgroundColor = COLORS.surfaceHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = COLORS.textMuted;
          e.currentTarget.style.backgroundColor = "transparent";
        }}
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        <MdClose size={14} />
      </button>
    </div>
  );
};

// ─── Toast (standalone) ───────────────────────────────────────────────────────
// Named export for direct rendering if needed outside of provider context
// Most usage should be via useToast() hook instead

export const Toast = ToastItem;

export default ToastProvider;
