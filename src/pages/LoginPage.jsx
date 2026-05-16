// ─────────────────────────────────────────────────────────────────────────────
// TIRAS CRM V2 — LoginPage
// File: src/pages/LoginPage.jsx
// Account: Anuradha | Theme: Obsidian Gold
//
// HOW TO USE:
//   In src/pages/index.js replace:
//     export const LoginPage = () => <Placeholder name="Login Page" />;
//   with the full contents of this file.
//
// DEPENDENCIES (already in stack):
//   react-router-dom  → useNavigate, Link
//   ../contexts/AuthContext → useAuth
//   Firebase Auth error codes handled inline
//
// FONTS — add to public/index.html <head>:
//   <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:           "#121212",
  surface:      "#1A1A1B",
  surfaceHover: "#1F1F20",
  gold:         "#D4AF37",
  goldHover:    "#E4C350",
  goldBg:       "rgba(212,175,55,0.10)",
  goldBorder:   "rgba(212,175,55,0.30)",
  goldGlow:     "rgba(212,175,55,0.18)",
  accent:       "#E63946",
  accentBg:     "rgba(230,57,70,0.10)",
  accentBorder: "rgba(230,57,70,0.35)",
  text:         "#F5F5F5",
  sub:          "#9A9A9A",
  muted:        "#5A5A5A",
  border:       "#2A2A2B",
  inputBg:      "#101011",
  success:      "#22C55E",
};

// ─── Keyframe injection ───────────────────────────────────────────────────────
const STYLE_ID = "tiras-v2-login";
const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const tag = document.createElement("style");
  tag.id = STYLE_ID;
  tag.textContent = `
    @keyframes v2l-fade-up {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0);    }
    }
    @keyframes v2l-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes v2l-shake {
      0%,100% { transform: translateX(0);   }
      15%     { transform: translateX(-7px); }
      30%     { transform: translateX(7px);  }
      45%     { transform: translateX(-5px); }
      60%     { transform: translateX(5px);  }
      75%     { transform: translateX(-3px); }
      90%     { transform: translateX(3px);  }
    }
    @keyframes v2l-grid-fade {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes v2l-glow-pulse {
      0%,100% { opacity: 0.55; }
      50%     { opacity: 0.85; }
    }
    @keyframes v2l-err-in {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0);    }
    }
    /* Gold shimmer on the card top bar */
    @keyframes v2l-shimmer {
      0%   { background-position: -300px 0; }
      100% { background-position:  300px 0; }
    }

    .v2l-input:focus {
      border-color: #D4AF37 !important;
      box-shadow: 0 0 0 3px rgba(212,175,55,0.16) !important;
      outline: none;
    }
    .v2l-input::placeholder { color: #5A5A5A; }
    .v2l-input:-webkit-autofill {
      -webkit-box-shadow: 0 0 0 100px #101011 inset !important;
      -webkit-text-fill-color: #F5F5F5 !important;
    }
    .v2l-btn-gold:hover:not(:disabled) {
      background-color: #E4C350 !important;
      box-shadow: 0 8px 28px rgba(212,175,55,0.45) !important;
      transform: translateY(-1px);
    }
    .v2l-btn-gold:active:not(:disabled) {
      transform: translateY(0px);
      box-shadow: 0 4px 14px rgba(212,175,55,0.30) !important;
    }
    .v2l-link:hover { color: #E4C350 !important; }
    .v2l-link-sub:hover { color: #F5F5F5 !important; }
    .v2l-eye-btn:hover { color: #D4AF37 !important; }
    .v2l-checkbox:checked {
      background-color: #D4AF37 !important;
      border-color: #D4AF37 !important;
    }
    /* Custom checkbox */
    .v2l-cb-wrap input[type="checkbox"] {
      appearance: none;
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      border: 1.5px solid #2A2A2B;
      border-radius: 4px;
      background-color: #101011;
      cursor: pointer;
      flex-shrink: 0;
      position: relative;
      transition: all 0.15s;
    }
    .v2l-cb-wrap input[type="checkbox"]:checked {
      background-color: #D4AF37;
      border-color: #D4AF37;
    }
    .v2l-cb-wrap input[type="checkbox"]:checked::after {
      content: '';
      position: absolute;
      left: 4px;
      top: 1px;
      width: 5px;
      height: 9px;
      border: 2px solid #000;
      border-top: none;
      border-left: none;
      transform: rotate(45deg);
    }
    .v2l-cb-wrap input[type="checkbox"]:focus {
      box-shadow: 0 0 0 3px rgba(212,175,55,0.20);
      border-color: #D4AF37;
    }
    .v2l-trial-banner:hover {
      border-color: rgba(212,175,55,0.40) !important;
      background-color: rgba(212,175,55,0.08) !important;
    }

    @media (max-width: 520px) {
      .v2l-card {
        border-radius: 0 !important;
        border-left: none !important;
        border-right: none !important;
        min-height: 100vh;
        padding: 32px 24px 40px !important;
      }
      .v2l-page { padding: 0 !important; align-items: flex-start !important; }
    }
  `;
  document.head.appendChild(tag);
};

// ─── Firebase error → human message ──────────────────────────────────────────
const authError = (code) => {
  switch (code) {
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/invalid-email":
      return "No account found with this email address.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
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

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const EyeOpen = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOff = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const AlertIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const SpinnerIcon = () => (
  <div style={{
    width: "17px", height: "17px", borderRadius: "50%",
    border: "2px solid rgba(0,0,0,0.25)",
    borderTopColor: "#000",
    animation: "v2l-spin 0.7s linear infinite",
    flexShrink: 0,
  }} />
);

// ─────────────────────────────────────────────────────────────────────────────
// LoginPage
// ─────────────────────────────────────────────────────────────────────────────
export const LoginPage = () => {
  const { login, getDefaultRoute, currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [rememberMe,   setRememberMe]   = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState(null);
  const [shakeKey,     setShakeKey]     = useState(0);   // bump to retrigger shake

  // Pre-fill remembered email
  useEffect(() => {
    injectStyles();
    const saved = localStorage.getItem("tiras_remembered_email");
    if (saved) { setEmail(saved); setRememberMe(true); }
  }, []);

  // Redirect if already authenticated
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
      setShakeKey(k => k + 1);
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      setShakeKey(k => k + 1);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await login(email.trim(), password);

      // Remember me
      if (rememberMe) {
        localStorage.setItem("tiras_remembered_email", email.trim());
      } else {
        localStorage.removeItem("tiras_remembered_email");
      }

      navigate(getDefaultRoute(), { replace: true });
    } catch (err) {
      setError(authError(err.code));
      setShakeKey(k => k + 1);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="v2l-page"
      style={{
        minHeight: "100vh",
        backgroundColor: T.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* ── Background dot grid ────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(circle, rgba(212,175,55,0.08) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
          animation: "v2l-grid-fade 1s ease both",
          pointerEvents: "none",
        }}
      />

      {/* ── Gold glow blob ─────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          animation: "v2l-glow-pulse 4s ease infinite",
          pointerEvents: "none",
        }}
      />

      {/* ── Card ───────────────────────────────────────────────────────────── */}
      <div
        className="v2l-card"
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "460px",
          backgroundColor: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: "18px",
          padding: "40px 40px 36px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.60)",
          animation: "v2l-fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both",
          overflow: "hidden",
        }}
      >
        {/* Shimmer top bar */}
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: "3px",
            background: `linear-gradient(90deg, transparent, ${T.gold}, ${T.goldHover}, ${T.gold}, transparent)`,
            backgroundSize: "300px 100%",
            animation: "v2l-shimmer 2.5s ease infinite",
          }}
        />

        {/* ── Logo ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "32px" }}>
          {/* T mark */}
          <div style={{
            width: "48px", height: "48px",
            borderRadius: "12px",
            backgroundColor: T.goldBg,
            border: `1.5px solid ${T.goldBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 16px ${T.goldGlow}`,
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "26px",
              fontWeight: 700,
              color: T.gold,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}>T</span>
          </div>
          {/* Brand name */}
          <div>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "26px",
              fontWeight: 700,
              color: T.text,
              letterSpacing: "0.06em",
              lineHeight: 1,
            }}>TIRAS</div>
            <div style={{
              color: T.gold,
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginTop: "3px",
            }}>Beyond Every Limit</div>
          </div>
        </div>

        {/* ── Heading ──────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "24px",
            fontWeight: 700,
            color: T.text,
            letterSpacing: "-0.01em",
            marginBottom: "6px",
          }}>
            Welcome back
          </h1>
          <p style={{ color: T.sub, fontSize: "14px", lineHeight: "1.5" }}>
            Sign in to your workspace to continue
          </p>
        </div>

        {/* ── Error banner ─────────────────────────────────────────────────── */}
        {error && (
          <div
            key={shakeKey}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              backgroundColor: T.accentBg,
              border: `1px solid ${T.accentBorder}`,
              borderRadius: "10px",
              padding: "11px 14px",
              marginBottom: "20px",
              animation: "v2l-shake 0.45s ease, v2l-err-in 0.25s ease",
            }}
          >
            <span style={{ color: T.accent, flexShrink: 0, marginTop: "1px" }}>
              <AlertIcon />
            </span>
            <span style={{ color: T.accent, fontSize: "13px", lineHeight: "1.5", fontWeight: 500 }}>
              {error}
            </span>
          </div>
        )}

        {/* ── Form ─────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Email */}
          <div>
            <label style={{
              display: "block",
              color: T.sub,
              fontSize: "12px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: "7px",
            }}>
              Email address
            </label>
            <input
              id="tiras-email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@company.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); }}
              disabled={isLoading}
              className="v2l-input"
              style={{
                backgroundColor: T.inputBg,
                border: `1px solid ${error ? T.accentBorder : T.border}`,
                borderRadius: "9px",
                color: T.text,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px",
                padding: "11px 14px",
                width: "100%",
                boxSizing: "border-box",
                outline: "none",
                transition: "border 0.15s, box-shadow 0.15s",
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{
              display: "block",
              color: T.sub,
              fontSize: "12px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: "7px",
            }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="tiras-password"
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(null); }}
                disabled={isLoading}
                className="v2l-input"
                style={{
                  backgroundColor: T.inputBg,
                  border: `1px solid ${error ? T.accentBorder : T.border}`,
                  borderRadius: "9px",
                  color: T.text,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "14px",
                  padding: "11px 42px 11px 14px",
                  width: "100%",
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border 0.15s, box-shadow 0.15s",
                }}
              />
              <button
                type="button"
                className="v2l-eye-btn"
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
                aria-label={showPass ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "13px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: T.muted,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "2px",
                  transition: "color 0.15s",
                }}
              >
                {showPass ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>
          </div>

          {/* Remember me + Forgot password row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
          }}>
            <label
              className="v2l-cb-wrap"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              <span style={{ color: T.sub, fontSize: "13px", fontWeight: 500 }}>
                Remember me
              </span>
            </label>

            <Link
              to="/forgot-password"
              className="v2l-link"
              style={{
                color: T.gold,
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
                transition: "color 0.15s",
              }}
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="v2l-btn-gold"
            style={{
              backgroundColor: T.gold,
              color: "#000",
              border: "none",
              borderRadius: "10px",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "15px",
              fontWeight: 700,
              padding: "13px 20px",
              cursor: isLoading ? "not-allowed" : "pointer",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "9px",
              transition: "all 0.18s ease",
              boxShadow: `0 4px 18px rgba(212,175,55,0.28)`,
              marginTop: "4px",
              opacity: isLoading ? 0.75 : 1,
              minHeight: "48px",
              letterSpacing: "0.01em",
            }}
          >
            {isLoading ? (
              <><SpinnerIcon /> Signing in…</>
            ) : (
              "Sign In"
            )}
          </button>

        </form>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          margin: "24px 0",
        }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: T.border }} />
          <span style={{ color: T.muted, fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            or
          </span>
          <div style={{ flex: 1, height: "1px", backgroundColor: T.border }} />
        </div>

        {/* ── Free trial banner ─────────────────────────────────────────────── */}
        <Link
          to="/register"
          style={{ textDecoration: "none", display: "block" }}
        >
          <div
            className="v2l-trial-banner"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              backgroundColor: T.goldBg,
              border: `1px solid ${T.goldBorder}`,
              borderRadius: "10px",
              padding: "13px 20px",
              transition: "all 0.18s ease",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "16px" }}>✦</span>
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "14px",
              fontWeight: 600,
              color: T.gold,
              letterSpacing: "0.01em",
            }}>
              Don't have an account?{" "}
              <span style={{ fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "3px" }}>
                Start free trial
              </span>
            </span>
          </div>
        </Link>

        {/* ── Footer note ───────────────────────────────────────────────────── */}
        <p style={{
          textAlign: "center",
          color: T.muted,
          fontSize: "12px",
          marginTop: "20px",
          lineHeight: "1.5",
        }}>
          Access is by invitation only.{" "}
          <span style={{ color: T.sub }}>Contact your admin to get an account.</span>
        </p>

      </div>
    </div>
  );
};

export default LoginPage;
