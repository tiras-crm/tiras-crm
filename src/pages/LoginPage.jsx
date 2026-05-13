// ─────────────────────────────────────────────────────────────────────────────
// TIRAS CRM — LoginPage
// File: src/pages/LoginPage.jsx
//
// HOW TO USE:
//   1. Replace the placeholder `export const LoginPage` in src/pages/index.js
//      with this entire component, OR save as src/pages/LoginPage.jsx and
//      import it at the top of index.js:
//        import { LoginPage } from './LoginPage';
//      then remove the placeholder line.
//
// DEPENDENCIES (already in your stack):
//   react-router-dom  → useNavigate, Link
//   ../contexts/AuthContext  → useAuth
//   ../theme  → COLORS, FONTS, SPACING, RADIUS, SHADOWS, TRANSITIONS
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  SHADOWS,
  TRANSITIONS,
} from "../theme";

// ─── Keyframe injection (spinner + fade-in) ──────────────────────────────────
// One <style> tag per mount — safe, no duplicate IDs risk with useRef guard

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
    @keyframes tiras-dot-pulse {
      0%, 80%, 100% { opacity: 0.25; transform: scale(0.7); }
      40%           { opacity: 1;    transform: scale(1); }
    }
  `;
  document.head.appendChild(tag);
};

// ─── Style objects (defined once — not repeated inline) ──────────────────────

const S = {
  // Full-page wrapper
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

  // Decorative background grid
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

  // Glow blob behind card
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

  // Login card
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

  // Logo container
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

  // Heading section
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
    lineHeight: FONTS.lineHeight.normal,
  },

  // Form
  form: {
    display: "flex",
    flexDirection: "column",
    gap: SPACING.base,
  },

  // Field group
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

  // Base input style — focus ring applied via JS state
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

  inputError: {
    border: `1px solid ${COLORS.inputError}`,
    boxShadow: `0 0 0 3px ${COLORS.danger}18`,
  },

  // Password row (input + toggle)
  passwordWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },

  passwordInput: {
    paddingRight: "44px",
  },

  eyeBtn: {
    position: "absolute",
    right: SPACING.md,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "2px",
    color: COLORS.textMuted,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: TRANSITIONS.fast,
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
    fontSize: "16px",
    flexShrink: 0,
    marginTop: "1px",
  },

  errorText: {
    color: COLORS.danger,
    fontSize: FONTS.size.sm,
    lineHeight: FONTS.lineHeight.normal,
  },

  // Forgot password row
  forgotRow: {
    textAlign: "right",
  },

  forgotLink: {
    color: COLORS.accent,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    textDecoration: "none",
    transition: TRANSITIONS.fast,
  },

  // Submit button — states managed via spreading
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

  // Spinner ring
  spinner: {
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: `2px solid #12121240`,
    borderTopColor: "#121212",
    animation: "tiras-spin 0.7s linear infinite",
    flexShrink: 0,
  },

  // Divider
  divider: {
    height: "1px",
    backgroundColor: COLORS.border,
    margin: `${SPACING.lg} 0`,
  },

  // Footer note
  footerNote: {
    textAlign: "center",
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    lineHeight: FONTS.lineHeight.relaxed,
  },
};

// ─── Error message mapper ─────────────────────────────────────────────────────

const getErrorMessage = (code) => {
  switch (code) {
    case "auth/user-not-found":
    case "auth/invalid-credential":
      return "No account found with this email address.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been deactivated. Contact your admin.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Login failed. Please check your credentials and try again.";
  }
};

// ─── Eye icon SVGs ────────────────────────────────────────────────────────────

const EyeOpen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// ─── Alert icon ───────────────────────────────────────────────────────────────

const AlertIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// LoginPage Component
// ─────────────────────────────────────────────────────────────────────────────

export const LoginPage = () => {
  const { login, getDefaultRoute, currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorKey, setErrorKey] = useState(0); // Bumped to retrigger shake animation

  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [eyeHovered, setEyeHovered] = useState(false);

  // Inject CSS keyframes once
  useEffect(() => { injectStyles(); }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && currentUser) {
      navigate(getDefaultRoute(), { replace: true });
    }
  }, [currentUser, authLoading, navigate, getDefaultRoute]);

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Please enter your email address.");
      setErrorKey((k) => k + 1);
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      setErrorKey((k) => k + 1);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await login(email.trim(), password);
      // Auth state listener in AuthContext handles profile fetch + role set.
      // Navigate after role is available via the redirect useEffect above.
      // Small safety fallback in case state updates slightly behind:
      navigate(getDefaultRoute(), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err.code));
      setErrorKey((k) => k + 1);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Computed input border styles ──────────────────────────────────────────

  const emailInputStyle = {
    ...S.input,
    ...(emailFocused && !error ? S.inputFocused : {}),
    ...(error ? S.inputError : {}),
  };

  const passInputStyle = {
    ...S.input,
    ...S.passwordInput,
    ...(passFocused && !error ? S.inputFocused : {}),
    ...(error ? S.inputError : {}),
  };

  const btnStyle = {
    ...S.btn,
    ...(btnHovered && !isLoading ? S.btnHover : {}),
    ...(isLoading ? S.btnLoading : {}),
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>

      {/* Background grid texture */}
      <div style={S.bgGrid} />

      {/* Glow behind card */}
      <div style={S.glowBlob} />

      {/* Login card */}
      <div style={S.card}>

        {/* Logo + brand */}
        <div style={S.logoWrap}>
          <div style={S.logoBox}>
            <span style={S.logoLetter}>T</span>
          </div>
          <div style={S.logoName}>
            <span style={S.logoTitle}>TIRAS</span>
            <span style={S.logoTagline}>Beyond Every Limit</span>
          </div>
        </div>

        {/* Heading */}
        <div style={S.heading}>
          <div style={S.headingTitle}>Welcome back</div>
          <div style={S.headingSubtitle}>Sign in to your workspace</div>
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

          {/* Email field */}
          <div style={S.fieldGroup}>
            <label htmlFor="tiras-email" style={S.label}>
              Email address
            </label>
            <input
              id="tiras-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              disabled={isLoading}
              style={emailInputStyle}
            />
          </div>

          {/* Password field */}
          <div style={S.fieldGroup}>
            <label htmlFor="tiras-password" style={S.label}>
              Password
            </label>
            <div style={S.passwordWrap}>
              <input
                id="tiras-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
                disabled={isLoading}
                style={passInputStyle}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                onMouseEnter={() => setEyeHovered(true)}
                onMouseLeave={() => setEyeHovered(false)}
                style={{
                  ...S.eyeBtn,
                  color: eyeHovered ? COLORS.textSecondary : COLORS.textMuted,
                }}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div style={S.forgotRow}>
            <Link
              to="/forgot-password"
              style={S.forgotLink}
              onMouseEnter={(e) => (e.target.style.color = COLORS.accentHover)}
              onMouseLeave={(e) => (e.target.style.color = COLORS.accent)}
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit button */}
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
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>

        </form>

        {/* Footer note */}
        <div style={S.divider} />
        <div style={S.footerNote}>
          Access is by invitation only.{" "}
          <span style={{ color: COLORS.textSecondary }}>
            Contact your admin to get an account.
          </span>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
