// TIRAS CRM — ConfirmModal Component
// Reusable confirmation dialog for destructive or important actions
//
// Usage:
//   <ConfirmModal
//     isOpen={showConfirm}
//     title="Delete Lead"
//     message="This will permanently delete Rahul Sharma and all call history. This cannot be undone."
//     confirmLabel="Delete Lead"
//     onConfirm={handleDelete}
//     onCancel={() => setShowConfirm(false)}
//     danger
//   />
//
//   <ConfirmModal
//     isOpen={showResolve}
//     title="Mark as Resolved"
//     message="Are you sure this ticket has been fully resolved?"
//     confirmLabel="Yes, Resolve"
//     onConfirm={handleResolve}
//     onCancel={() => setShowResolve(false)}
//   />

import React, { useEffect, useRef, useCallback } from "react";
import { MdWarning, MdClose, MdCheck, MdDeleteForever } from "react-icons/md";
import {
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  SHADOWS,
  STYLES,
  TRANSITIONS,
} from "../../theme";

// ─── Keyframe injection ───────────────────────────────────────────────────────

const injectModalKeyframes = () => {
  if (document.getElementById("tiras-modal-keyframes")) return;
  const style = document.createElement("style");
  style.id = "tiras-modal-keyframes";
  style.textContent = `
    @keyframes tiras-modal-backdrop-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes tiras-modal-slide-in {
      from { opacity: 0; transform: scale(0.94) translateY(-8px); }
      to   { opacity: 1; transform: scale(1)    translateY(0);    }
    }
  `;
  document.head.appendChild(style);
};

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
// Props:
//   isOpen        bool      Controls visibility
//   title         string    Modal heading
//   message       string    Body text explaining the action
//   confirmLabel  string    Confirm button label (default: "Confirm")
//   cancelLabel   string    Cancel button label  (default: "Cancel")
//   onConfirm     function  Called when user confirms
//   onCancel      function  Called when user cancels or clicks backdrop
//   danger        bool      Red confirm button for destructive actions (default: false)
//   loading       bool      Shows spinner on confirm button while processing
//   icon          component Override the default icon

export const ConfirmModal = ({
  isOpen       = false,
  title        = "Are you sure?",
  message      = "This action cannot be undone.",
  confirmLabel = "Confirm",
  cancelLabel  = "Cancel",
  onConfirm,
  onCancel,
  danger       = false,
  loading      = false,
  icon: CustomIcon = null,
}) => {
  injectModalKeyframes();

  const confirmBtnRef = useRef(null);

  // ── Focus confirm button when modal opens ──────────────────────────────────

  useEffect(() => {
    if (isOpen && confirmBtnRef.current) {
      // Small delay so animation doesn't jank
      setTimeout(() => confirmBtnRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ── Lock body scroll when open ─────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // ── Keyboard: Escape = cancel, Enter = confirm ─────────────────────────────

  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;
      if (e.key === "Escape" && onCancel) {
        e.stopPropagation();
        onCancel();
      }
      if (e.key === "Enter" && onConfirm && !loading) {
        e.stopPropagation();
        onConfirm();
      }
    },
    [isOpen, onCancel, onConfirm, loading]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  // ── Icon to show ───────────────────────────────────────────────────────────

  const IconComponent = CustomIcon
    ? CustomIcon
    : danger
    ? MdDeleteForever
    : MdWarning;

  const iconColor = danger ? COLORS.danger : COLORS.accent;
  const iconBg    = danger ? COLORS.dangerMuted : COLORS.warningMuted;

  // ── Confirm button style ───────────────────────────────────────────────────

  const confirmButtonBase = {
    display:        "inline-flex",
    alignItems:     "center",
    justifyContent: "center",
    gap:            SPACING.xs,
    border:         "none",
    borderRadius:   RADIUS.base,
    fontFamily:     FONTS.family,
    fontSize:       FONTS.size.base,
    fontWeight:     FONTS.weight.semibold,
    padding:        `${SPACING.sm} ${SPACING.xl}`,
    cursor:         loading ? "not-allowed" : "pointer",
    transition:     TRANSITIONS.base,
    opacity:        loading ? 0.7 : 1,
    minWidth:       "100px",
  };

  const confirmButtonStyle = danger
    ? {
        ...confirmButtonBase,
        backgroundColor: COLORS.danger,
        color:           "#ffffff",
        boxShadow:       `0 4px 14px ${COLORS.danger}40`,
      }
    : {
        ...confirmButtonBase,
        backgroundColor: COLORS.primary,
        color:           COLORS.textInverse,
        boxShadow:       `0 4px 14px ${COLORS.primary}40`,
      };

  const confirmHoverColor = danger ? "#C84040" : COLORS.primaryHover;

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div
        onClick={!loading ? onCancel : undefined}
        style={{
          position:        "fixed",
          inset:           0,
          backgroundColor: "rgba(0, 0, 0, 0.65)",
          backdropFilter:  "blur(3px)",
          zIndex:          1100,
          animation:       "tiras-modal-backdrop-in 0.2s ease",
          cursor:          loading ? "default" : "pointer",
        }}
        aria-hidden="true"
      />

      {/* ── Modal panel ──────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        style={{
          position:        "fixed",
          top:             "50%",
          left:            "50%",
          transform:       "translate(-50%, -50%)",
          zIndex:          1200,
          width:           "100%",
          maxWidth:        "420px",
          padding:         SPACING.base,
          boxSizing:       "border-box",
        }}
      >
        <div
          style={{
            backgroundColor: COLORS.surface,
            border:          `1px solid ${COLORS.border}`,
            borderRadius:    RADIUS.xl,
            boxShadow:       SHADOWS.lg,
            overflow:        "hidden",
            animation:       "tiras-modal-slide-in 0.2s ease",
          }}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div
            style={{
              display:         "flex",
              alignItems:      "flex-start",
              justifyContent:  "space-between",
              padding:         `${SPACING.xl} ${SPACING.xl} 0`,
              gap:             SPACING.base,
            }}
          >
            {/* Icon + Title row */}
            <div style={{ display: "flex", alignItems: "center", gap: SPACING.md, flex: 1 }}>
              {/* Icon badge */}
              <div
                style={{
                  width:           "44px",
                  height:          "44px",
                  borderRadius:    RADIUS.lg,
                  backgroundColor: iconBg,
                  border:          `1px solid ${iconColor}30`,
                  display:         "flex",
                  alignItems:      "center",
                  justifyContent:  "center",
                  flexShrink:      0,
                }}
              >
                <IconComponent size={22} color={iconColor} />
              </div>

              {/* Title */}
              <h2
                id="confirm-modal-title"
                style={{
                  margin:     0,
                  color:      COLORS.textPrimary,
                  fontSize:   FONTS.size.lg,
                  fontWeight: FONTS.weight.semibold,
                  lineHeight: FONTS.lineHeight.tight,
                }}
              >
                {title}
              </h2>
            </div>

            {/* Close X */}
            <button
              onClick={!loading ? onCancel : undefined}
              disabled={loading}
              style={{
                background:   "none",
                border:       "none",
                cursor:       loading ? "not-allowed" : "pointer",
                color:        COLORS.textMuted,
                display:      "flex",
                alignItems:   "center",
                padding:      SPACING.xs,
                borderRadius: RADIUS.base,
                flexShrink:   0,
                transition:   TRANSITIONS.fast,
                opacity:      loading ? 0.4 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.color = COLORS.textPrimary;
                  e.currentTarget.style.backgroundColor = COLORS.surfaceHover;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = COLORS.textMuted;
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              aria-label="Close"
            >
              <MdClose size={18} />
            </button>
          </div>

          {/* ── Message ────────────────────────────────────────────────── */}
          <div
            style={{
              padding: `${SPACING.md} ${SPACING.xl} ${SPACING.xl}`,
            }}
          >
            <p
              id="confirm-modal-message"
              style={{
                margin:     0,
                color:      COLORS.textSecondary,
                fontSize:   FONTS.size.base,
                lineHeight: FONTS.lineHeight.relaxed,
              }}
            >
              {message}
            </p>
          </div>

          {/* ── Divider ────────────────────────────────────────────────── */}
          <div style={{ height: "1px", backgroundColor: COLORS.border }} />

          {/* ── Action buttons ──────────────────────────────────────────── */}
          <div
            style={{
              display:        "flex",
              justifyContent: "flex-end",
              gap:            SPACING.sm,
              padding:        SPACING.lg,
            }}
          >
            {/* Cancel */}
            <button
              onClick={!loading ? onCancel : undefined}
              disabled={loading}
              style={{
                ...STYLES.buttonSecondary,
                opacity: loading ? 0.5 : 1,
                cursor:  loading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = COLORS.surfaceHover;
                  e.currentTarget.style.borderColor     = COLORS.primary;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.borderColor     = COLORS.border;
              }}
            >
              {cancelLabel}
            </button>

            {/* Confirm */}
            <button
              ref={confirmBtnRef}
              onClick={!loading ? onConfirm : undefined}
              disabled={loading}
              style={confirmButtonStyle}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = confirmHoverColor;
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = danger
                  ? COLORS.danger
                  : COLORS.primary;
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {loading ? (
                <>
                  {/* Inline spinner */}
                  <span
                    style={{
                      width:        "13px",
                      height:       "13px",
                      borderRadius: "50%",
                      border:       "2px solid transparent",
                      borderTop:    "2px solid currentColor",
                      borderRight:  "2px solid currentColor",
                      display:      "inline-block",
                      animation:    "tiras-spin 0.65s linear infinite",
                    }}
                  />
                  Processing…
                </>
              ) : (
                <>
                  {danger
                    ? <MdDeleteForever size={15} />
                    : <MdCheck size={15} />
                  }
                  {confirmLabel}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmModal;
