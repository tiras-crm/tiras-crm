// ─────────────────────────────────────────────────────────────────────────────
// TIRAS CRM — ForgotPasswordPage
// File: src/pages/ForgotPasswordPage.jsx
//
// HOW TO USE:
//   Open src/pages/index.js, find:
//     export const ForgotPasswordPage = () => <Placeholder name="Forgot Password Page" />;
//   Replace that entire line with the contents of this file
//   (everything above the `export default` line at the bottom).
//
// DEPENDENCIES (already in your stack):
//   react-router-dom  → useNavigate, Link
//   ../contexts/AuthContext  → useAuth
//   ../theme  → COLORS, FONTS, SPACING, RADIUS, SHADOWS, TRANSITIONS
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
// Reuses the same style tag as LoginPage if already injected (same STYLE_ID)

const STYLE_ID = "tiras-login-styles";

const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const tag = document.createElement("style");
  tag.id = STYLE_ID;
  tag.textContent = `
    @keyframes tiras-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes tiras-fade-up {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes tiras-shake {
      0%, 100% { transform: translateX(0); }
      20%       { transform: translateX(-6px); }
      40%       { transform: translateX(6px); }
      60%       { transform: translateX(-4px); }
      80%       { transform: translateX(4px); }
    }
    @keyframes tiras-success-pop {
      0%   { opacity: 0; transform: scale(0.85) translateY(8px); }
      60%  { transform: scale(1.03) translateY(-2px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes tiras-check-draw {
      from { stroke-dashoffset: 36; }
      to   { stroke-dashoffset: 0; }
    }
    @keyframes tiras-circle-draw {
      from { stroke-dashoffset: 126; }
      to   { stroke-dashoffset: 0; }
    }
  `;
  document.head.appendChild(tag);
};

// ─── Style objects ────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100vh",
    backgroundColor: COLORS.background,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.base,
    position: "relative",
    overflow: "hidden",
    fontFamily: FONTS.family,
  },

  bgGrid: {
    position: "absolute",
    inset: 0,
    backgroundImage: `
      linear-gradient(${COLORS.border} 1px, transparent 1px),
      linear-gradient(90deg, ${COLORS.border} 1px, transparent 1px)
    `,
    backgroundSize: "48px 48px",
    opacity: 0.35,
    pointerEvents: "none",
  },

  glowBlob: {
    position: "absolute",
    width: "560px",
    height: "560px",
    borderRadius: "50%",
    background: `radial-gradient(circle, ${COLORS.primary}18 0%, transparent 70%)`,
    pointerEvents: "none",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  },

  card: {
    position: "relative",
    zIndex: 1,
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.xl,
    padding: `${SPACING["3xl"]} ${SPACING["2xl"]}`,
    width: "100%",
    maxWidth: "420px",
    boxShadow: SHADOWS.lg,
    animation: "tiras-fade-up 0.45s ease both",
  },

  logoWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING["2xl"],
  },

  logoBox: {
    width: "52px",
    height: "52px",
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primaryMuted,
    border: `1.5px solid ${COLORS.primary}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: SHADOWS.primary,
  },

  logoLetter: {
    color: COLORS.primary,
    fontSize: FONTS.size["3xl"],
    fontWeight: FONTS.weight.bold,
    lineHeight: 1,
    letterSpacing: "-0.02em",
  },

  logoName: {
    marginLeft: SPACING.md,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },

  logoTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size["2xl"],
    fontWeight: FONTS.weight.bold,
    letterSpacing: "0.08em",
    lineHeight: 1,
  },

  logoTagline: {
    color: COLORS.accent,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.medium,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },

  heading: {
    textAlign: "center",
    marginBottom: SPACING["2xl"],
  },

  headingTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size["3xl"],
    fontWeight: FONTS.weight.bold,
    marginBottom: SPACING.xs,
    letterSpacing: "-0.01em",
  },

  headingSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.base,
    lineHeight: FONTS.lineHeight.relaxed,
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.base,
  },

  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.xs,
  },

  label: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    letterSpacing: "0.02em",
  },

  input: {
    backgroundColor: COLORS.inputBg,
    border: `1px solid ${COLORS.inputBorder}`,
    borderRadius: RADIUS.md,
    color: COLORS.textPrimary,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    padding: `${SPACING.sm} ${SPACING.md}`,
    outline: "none",
    width: "100%",
    transition: TRANSITIONS.fast,
    boxSizing: "border-box",
  },

  inputFocused: {
    border: `1px solid ${COLORS.inputFocus}`,
    boxShadow: `0 0 0 3px ${COLORS.primary}22`,
  },

  inputErrorState: {
    border: `1px solid ${COLORS.inputError}`,
    boxShadow: `0 0 0 3px ${COLORS.danger}18`,
  },

  // Error banner
  errorBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: `${COLORS.danger}14`,
    border: `1px solid ${COLORS.danger}40`,
    borderRadius: RADIUS.md,
    padding: `${SPACING.sm} ${SPACING.md}`,
    animation: "tiras-shake 0.4s ease",
  },

  errorIcon: {
    color: COLORS.danger,
    flexShrink: 0,
    marginTop: "1px",
  },

  errorText: {
    color: COLORS.danger,
    fontSize: FONTS.size.sm,
    lineHeight: FONTS.lineHeight.normal,
  },

  // Submit button
  btn: {
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
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    letterSpacing: "0.01em",
    marginTop: SPACING.xs,
  },

  btnLoading: {
    opacity: 0.8,
    cursor: "not-allowed",
  },

  btnHover: {
    backgroundColor: COLORS.primaryHover,
    boxShadow: `0 6px 20px ${COLORS.primary}45`,
    transform: "translateY(-1px)",
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

  // Back to login row
  backRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    marginTop: SPACING.lg,
  },

  backLink: {
    color: COLORS.accent,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    textDecoration: "none",
    transition: TRANSITIONS.fast,
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
  },

  divider: {
    height: "1px",
    backgroundColor: COLORS.border,
    margin: `${SPACING.lg} 0`,
  },

  footerNote: {
    textAlign: "center",
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
  },

  // ── Success state ──────────────────────────────────────────────────────────

  successCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    animation: "tiras-success-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
  },

  successIconWrap: {
    width: "72px",
    height: "72px",
    marginBottom: SPACING.xl,
  },

  successTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.size["2xl"],
    fontWeight: FONTS.weight.bold,
    marginBottom: SPACING.sm,
    letterSpacing: "-0.01em",
  },

  successBodyWrap: {
    marginBottom: SPACING["2xl"],
  },

  successBody: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.base,
    lineHeight: FONTS.lineHeight.relaxed,
  },

  successEmail: {
    color: COLORS.accent,
    fontWeight: FONTS.weight.semibold,
  },

  successHint: {
    marginTop: SPACING.sm,
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    lineHeight: FONTS.lineHeight.relaxed,
  },

  successBox: {
    backgroundColor: `${COLORS.success}10`,
    border: `1px solid ${COLORS.success}30`,
    borderRadius: RADIUS.md,
    padding: `${SPACING.sm} ${SPACING.md}`,
    marginBottom: SPACING["2xl"],
    display: "flex",
    alignItems: "center",
    gap: SPACING.sm,
  },

  successBoxText: {
    color: COLORS.success,
    fontSize: FONTS.size.sm,
    lineHeight: FONTS.lineHeight.normal,
  },

  backToLoginBtn: {
    backgroundColor: "transparent",
    color: COLORS.textPrimary,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.medium,
    padding: `${SPACING.md} ${SPACING.xl}`,
    cursor: "pointer",
    transition: TRANSITIONS.base,
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    letterSpacing: "0.01em",
    textDecoration: "none",
  },

  resendRow: {
    marginTop: SPACING.md,
    textAlign: "center",
  },

  resendText: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
  },

  resendBtn: {
    background: "none",
    border: "none",
    color: COLORS.accent,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    cursor: "pointer",
    padding: "0",
    fontFamily: FONTS.family,
    transition: TRANSITIONS.fast,
  },
};

// ─── Error mapper ─────────────────────────────────────────────────────────────

const getErrorMessage = (code) => {
  switch (code) {
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/invalid-email":
      return "No account found with this email address. Check the spelling and try again.";
    case "auth/too-many-requests":
      return "Too many requests. Please wait a few minutes before trying again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Could not send reset email. Please try again in a moment.";
  }
};

// ─── SVG icons ────────────────────────────────────────────────────────────────

const AlertIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="72" height="72" viewBox="0 0 44 44" fill="none">
    {/* Outer ring */}
    <circle
      cx="22" cy="22" r="20"
      stroke={COLORS.success}
      strokeWidth="2"
      strokeDasharray="126"
      strokeDashoffset="0"
      style={{
        animation: "tiras-circle-draw 0.5s ease 0.1s both",
        strokeDashoffset: 126,
        animationFillMode: "forwards",
      }}
    />
    {/* Fill */}
    <circle cx="22" cy="22" r="20" fill={`${COLORS.success}14`} />
    {/* Check mark */}
    <polyline
      points="13,22 19,28 31,16"
      stroke={COLORS.success}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="36"
      strokeDashoffset="36"
      style={{
        animation: "tiras-check-draw 0.35s ease 0.4s forwards",
      }}
    />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const MailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// ForgotPasswordPage Component
// ─────────────────────────────────────────────────────────────────────────────

export const ForgotPasswordPage = () => {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorKey, setErrorKey] = useState(0);
  const [succeeded, setSucceeded] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0); // seconds remaining

  const [emailFocused, setEmailFocused] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [backHovered, setBackHovered] = useState(false);
  const [resendHovered, setResendHovered] = useState(false);

  // Inject keyframes once
  useEffect(() => { injectStyles(); }, []);

  // Countdown ticker for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ─── Submit (shared by initial send + resend) ────────────────────────────

  const sendReset = async (targetEmail) => {
    setIsLoading(true);
    setError(null);

    try {
      await resetPassword(targetEmail.trim());
      setSucceeded(true);
      setResendCooldown(60); // 60-second cooldown before resend allowed
    } catch (err) {
      setError(getErrorMessage(err.code));
      setErrorKey((k) => k + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Please enter your email address.");
      setErrorKey((k) => k + 1);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address.");
      setErrorKey((k) => k + 1);
      return;
    }

    await sendReset(email);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isLoading) return;
    await sendReset(email);
  };

  // ─── Computed styles ────────────────────────────────────────────────────────

  const emailInputStyle = {
    ...S.input,
    ...(emailFocused && !error ? S.inputFocused : {}),
    ...(error ? S.inputErrorState : {}),
  };

  const btnStyle = {
    ...S.btn,
    ...(btnHovered && !isLoading ? S.btnHover : {}),
    ...(isLoading ? S.btnLoading : {}),
  };

  const backToLoginBtnStyle = {
    ...S.backToLoginBtn,
    ...(backHovered
      ? { borderColor: COLORS.primary, color: COLORS.primary }
      : {}),
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>

      {/* Background texture */}
      <div style={S.bgGrid} />
      <div style={S.glowBlob} />

      {/* Card */}
      <div style={S.card}>

        {/* Logo */}
        <div style={S.logoWrap}>
          <div style={S.logoBox}>
            <span style={S.logoLetter}>T</span>
          </div>
          <div style={S.logoName}>
            <span style={S.logoTitle}>TIRAS</span>
            <span style={S.logoTagline}>Beyond Every Limit</span>
          </div>
        </div>

        {/* ── SUCCESS STATE ───────────────────────────────────────────────── */}
        {succeeded ? (
          <div style={S.successCard}>

            {/* Animated check circle */}
            <div style={S.successIconWrap}>
              <CheckCircleIcon />
            </div>

            <div style={S.successTitle}>Check your inbox</div>

            <div style={S.successBodyWrap}>
              <div style={S.successBody}>
                A password reset link has been sent to{" "}
                <span style={S.successEmail}>{email}</span>.
              </div>
              <div style={S.successHint}>
                The link expires in 1 hour. Check your spam folder if you
                don't see it within a minute.
              </div>
            </div>

            {/* Info note */}
            <div style={{ ...S.successBox, width: "100%" }}>
              <MailIcon color={COLORS.success} />
              <span style={S.successBoxText}>
                Once reset, return here and sign in with your new password.
              </span>
            </div>

            {/* Back to login */}
            <Link
              to="/login"
              style={backToLoginBtnStyle}
              onMouseEnter={() => setBackHovered(true)}
              onMouseLeave={() => setBackHovered(false)}
            >
              <ArrowLeftIcon />
              Back to Sign In
            </Link>

            {/* Resend */}
            <div style={S.resendRow}>
              <span style={S.resendText}>Didn't receive it?{" "}</span>
              {resendCooldown > 0 ? (
                <span style={{ ...S.resendText, color: COLORS.textMuted }}>
                  Resend in {resendCooldown}s
                </span>
              ) : (
                <button
                  type="button"
                  style={{
                    ...S.resendBtn,
                    color: isLoading
                      ? COLORS.textMuted
                      : resendHovered
                      ? COLORS.accentHover
                      : COLORS.accent,
                  }}
                  onMouseEnter={() => setResendHovered(true)}
                  onMouseLeave={() => setResendHovered(false)}
                  onClick={handleResend}
                  disabled={isLoading}
                >
                  {isLoading ? "Sending…" : "Resend email"}
                </button>
              )}
            </div>

          </div>
        ) : (

        // ── FORM STATE ───────────────────────────────────────────────────────

          <>
            {/* Heading */}
            <div style={S.heading}>
              <div style={S.headingTitle}>Reset your password</div>
              <div style={S.headingSubtitle}>
                Enter your work email and we'll send you a reset link instantly.
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div key={errorKey} style={{ ...S.errorBox, marginBottom: SPACING.base }}>
                <span style={S.errorIcon}><AlertIcon /></span>
                <span style={S.errorText}>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate style={S.form}>

              <div style={S.fieldGroup}>
                <label htmlFor="tiras-reset-email" style={S.label}>
                  Email address
                </label>
                <input
                  id="tiras-reset-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  disabled={isLoading}
                  style={emailInputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={btnStyle}
                onMouseEnter={() => setBtnHovered(true)}
                onMouseLeave={() => setBtnHovered(false)}
              >
                {isLoading ? (
                  <>
                    <div style={S.spinner} />
                    Sending link…
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>

            </form>

            {/* Back to login */}
            <div style={S.backRow}>
              <Link
                to="/login"
                style={{
                  ...S.backLink,
                  color: backHovered ? COLORS.accentHover : COLORS.accent,
                }}
                onMouseEnter={() => setBackHovered(true)}
                onMouseLeave={() => setBackHovered(false)}
              >
                <ArrowLeftIcon />
                Back to Sign In
              </Link>
            </div>

            <div style={S.divider} />
            <div style={S.footerNote}>
              TIRAS CRM · Access by invitation only
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default ForgotPasswordPage;
