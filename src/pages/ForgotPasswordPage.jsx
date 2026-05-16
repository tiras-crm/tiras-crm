// ─────────────────────────────────────────────────────────────────────────────
// TIRAS CRM V2 — ForgotPasswordPage
// File: src/pages/ForgotPasswordPage.jsx
// Account: Anuradha | Theme: Obsidian Gold
//
// HOW TO USE:
//   In src/pages/index.js replace:
//     export const ForgotPasswordPage = () => <Placeholder name="Forgot Password Page" />;
//   with the full contents of this file.
//
// FONTS — add to public/index.html <head>:
//   <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:           "#121212",
  surface:      "#1A1A1B",
  gold:         "#D4AF37",
  goldHover:    "#E4C350",
  goldBg:       "rgba(212,175,55,0.10)",
  goldBorder:   "rgba(212,175,55,0.30)",
  goldGlow:     "rgba(212,175,55,0.18)",
  accent:       "#E63946",
  accentBg:     "rgba(230,57,70,0.10)",
  accentBorder: "rgba(230,57,70,0.35)",
  success:      "#22C55E",
  successBg:    "rgba(34,197,94,0.10)",
  successBorder:"rgba(34,197,94,0.30)",
  text:         "#F5F5F5",
  sub:          "#9A9A9A",
  muted:        "#5A5A5A",
  border:       "#2A2A2B",
  inputBg:      "#101011",
};

// ─── Keyframe injection ───────────────────────────────────────────────────────
// Reuses the same STYLE_ID as LoginPage if both are mounted (safe guard)
const STYLE_ID = "tiras-v2-forgot";
const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const tag = document.createElement("style");
  tag.id = STYLE_ID;
  tag.textContent = `
    @keyframes v2f-fade-up {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0);    }
    }
    @keyframes v2f-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes v2f-shake {
      0%,100% { transform: translateX(0);   }
      15%     { transform: translateX(-7px); }
      30%     { transform: translateX(7px);  }
      45%     { transform: translateX(-5px); }
      60%     { transform: translateX(5px);  }
      75%     { transform: translateX(-3px); }
      90%     { transform: translateX(3px);  }
    }
    @keyframes v2f-err-in {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0);    }
    }
    @keyframes v2f-success-pop {
      0%   { opacity: 0; transform: scale(0.88) translateY(10px); }
      60%  { transform: scale(1.03) translateY(-2px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes v2f-circle-draw {
      from { stroke-dashoffset: 126; }
      to   { stroke-dashoffset: 0;   }
    }
    @keyframes v2f-check-draw {
      from { stroke-dashoffset: 40; }
      to   { stroke-dashoffset: 0;  }
    }
    @keyframes v2f-grid-fade {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes v2f-glow-pulse {
      0%,100% { opacity: 0.55; }
      50%     { opacity: 0.85; }
    }
    @keyframes v2f-shimmer {
      0%   { background-position: -300px 0; }
      100% { background-position:  300px 0; }
    }
    @keyframes v2f-countdown {
      from { stroke-dashoffset: 0;  }
      to   { stroke-dashoffset: 63; }
    }

    .v2f-input:focus {
      border-color: #D4AF37 !important;
      box-shadow: 0 0 0 3px rgba(212,175,55,0.16) !important;
      outline: none;
    }
    .v2f-input::placeholder { color: #5A5A5A; }
    .v2f-input:-webkit-autofill {
      -webkit-box-shadow: 0 0 0 100px #101011 inset !important;
      -webkit-text-fill-color: #F5F5F5 !important;
    }
    .v2f-btn-gold:hover:not(:disabled) {
      background-color: #E4C350 !important;
      box-shadow: 0 8px 28px rgba(212,175,55,0.45) !important;
      transform: translateY(-1px);
    }
    .v2f-btn-gold:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 4px 14px rgba(212,175,55,0.30) !important;
    }
    .v2f-link:hover { color: #E4C350 !important; }
    .v2f-btn-secondary:hover:not(:disabled) {
      border-color: rgba(212,175,55,0.45) !important;
      color: #D4AF37 !important;
    }
    .v2f-resend-btn:hover:not(:disabled) {
      color: #E4C350 !important;
    }

    @media (max-width: 520px) {
      .v2f-card {
        border-radius: 0 !important;
        border-left: none !important;
        border-right: none !important;
        min-height: 100vh;
        padding: 32px 24px 40px !important;
      }
      .v2f-page { padding: 0 !important; align-items: flex-start !important; }
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
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const BackArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
);

const MailIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const SpinnerIcon = () => (
  <div style={{
    width: "17px", height: "17px", borderRadius: "50%",
    border: "2px solid rgba(0,0,0,0.25)",
    borderTopColor: "#000",
    animation: "v2f-spin 0.7s linear infinite",
    flexShrink: 0,
  }} />
);

// Animated success check circle
const CheckCircle = () => (
  <svg width="72" height="72" viewBox="0 0 44 44" fill="none">
    {/* Ring */}
    <circle
      cx="22" cy="22" r="20"
      stroke={T.success}
      strokeWidth="2"
      strokeDasharray="126"
      strokeDashoffset="126"
      style={{ animation: "v2f-circle-draw 0.55s ease 0.1s forwards" }}
    />
    {/* Fill */}
    <circle cx="22" cy="22" r="20" fill={T.successBg} />
    {/* Check */}
    <polyline
      points="13,22 19,28 31,16"
      stroke={T.success}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="40"
      strokeDashoffset="40"
      style={{ animation: "v2f-check-draw 0.35s ease 0.5s forwards" }}
    />
  </svg>
);

// Circular countdown ring (60-second timer visual)
const CountdownRing = ({ remaining, total = 60 }) => {
  const pct     = remaining / total;
  const radius  = 10;
  const circ    = 2 * Math.PI * radius; // ~62.8
  const offset  = circ * (1 - pct);
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" style={{ flexShrink: 0 }}>
      {/* Track */}
      <circle cx="14" cy="14" r={radius} fill="none" stroke={T.border} strokeWidth="2.5" />
      {/* Progress */}
      <circle
        cx="14" cy="14" r={radius}
        fill="none"
        stroke={T.gold}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 14 14)"
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
      {/* Number */}
      <text
        x="14" y="18"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fontFamily="'DM Sans', sans-serif"
        fill={T.gold}
      >
        {remaining}
      </text>
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ForgotPasswordPage
// ─────────────────────────────────────────────────────────────────────────────
export const ForgotPasswordPage = () => {
  const { resetPassword } = useAuth();

  const [email,      setEmail]      = useState("");
  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState(null);
  const [shakeKey,   setShakeKey]   = useState(0);
  const [succeeded,  setSucceeded]  = useState(false);
  const [cooldown,   setCooldown]   = useState(0);   // seconds remaining before resend allowed
  const [resending,  setResending]  = useState(false);

  const timerRef  = useRef(null);

  useEffect(() => {
    injectStyles();
  }, []);

  // Tick the cooldown every second
  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [cooldown]);

  // ─── Send reset email (shared by initial + resend) ───────────────────────
  const sendReset = async (targetEmail) => {
    try {
      await resetPassword(targetEmail.trim());
      setSucceeded(true);
      setCooldown(60);
      setError(null);
    } catch (err) {
      setError(authError(err.code));
      setShakeKey(k => k + 1);
    }
  };

  // ─── Initial submit ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Please enter your email address.");
      setShakeKey(k => k + 1);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address.");
      setShakeKey(k => k + 1);
      return;
    }

    setIsLoading(true);
    await sendReset(email);
    setIsLoading(false);
  };

  // ─── Resend ──────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    await sendReset(email);
    setResending(false);
  };

  // ─── Shared background + card shell ─────────────────────────────────────
  const PageShell = ({ children }) => (
    <div
      className="v2f-page"
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
      {/* Dot grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `radial-gradient(circle, rgba(212,175,55,0.08) 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
        animation: "v2f-grid-fade 1s ease both",
        pointerEvents: "none",
      }} />
      {/* Glow blob */}
      <div style={{
        position: "absolute", width: "600px", height: "600px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(212,175,55,0.07) 0%, transparent 70%)",
        top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        animation: "v2f-glow-pulse 4s ease infinite",
        pointerEvents: "none",
      }} />
      {/* Card */}
      <div
        className="v2f-card"
        style={{
          position: "relative", zIndex: 1,
          width: "100%", maxWidth: "460px",
          backgroundColor: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: "18px",
          padding: "40px 40px 36px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.60)",
          overflow: "hidden",
        }}
      >
        {/* Shimmer top bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "3px",
          background: `linear-gradient(90deg, transparent, ${T.gold}, ${T.goldHover}, ${T.gold}, transparent)`,
          backgroundSize: "300px 100%",
          animation: "v2f-shimmer 2.5s ease infinite",
        }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "32px" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "12px",
            backgroundColor: T.goldBg, border: `1.5px solid ${T.goldBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 16px ${T.goldGlow}`, flexShrink: 0,
          }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "26px", fontWeight: 700, color: T.gold, lineHeight: 1, letterSpacing: "-0.02em" }}>T</span>
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "26px", fontWeight: 700, color: T.text, letterSpacing: "0.06em", lineHeight: 1 }}>TIRAS</div>
            <div style={{ color: T.gold, fontSize: "10px", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: "3px" }}>Beyond Every Limit</div>
          </div>
        </div>

        {children}
      </div>
    </div>
  );

  // ─── SUCCESS STATE ────────────────────────────────────────────────────────
  if (succeeded) {
    return (
      <PageShell>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          textAlign: "center",
          animation: "v2f-success-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
        }}>
          {/* Animated check */}
          <div style={{ marginBottom: "20px" }}>
            <CheckCircle />
          </div>

          {/* Title */}
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "22px", fontWeight: 700,
            color: T.text, letterSpacing: "-0.01em",
            marginBottom: "10px",
          }}>
            Check your inbox
          </h2>

          {/* Body */}
          <p style={{ color: T.sub, fontSize: "14px", lineHeight: "1.7", marginBottom: "6px" }}>
            A password reset link was sent to
          </p>
          <p style={{ color: T.gold, fontSize: "15px", fontWeight: 700, marginBottom: "20px", wordBreak: "break-all" }}>
            {email}
          </p>

          {/* Info box */}
          <div style={{
            width: "100%",
            display: "flex", alignItems: "center", gap: "10px",
            backgroundColor: T.successBg,
            border: `1px solid ${T.successBorder}`,
            borderRadius: "10px",
            padding: "11px 14px",
            marginBottom: "28px",
            textAlign: "left",
          }}>
            <span style={{ color: T.success, flexShrink: 0 }}><MailIcon /></span>
            <span style={{ color: T.success, fontSize: "13px", fontWeight: 500, lineHeight: "1.5" }}>
              The link expires in 1 hour. Check your spam folder if you don't see it within a minute.
            </span>
          </div>

          {/* Back to login button */}
          <Link to="/login" style={{ textDecoration: "none", width: "100%", marginBottom: "16px" }}>
            <button
              className="v2f-btn-gold"
              style={{
                backgroundColor: T.gold, color: "#000", border: "none",
                borderRadius: "10px", fontFamily: "'DM Sans', sans-serif",
                fontSize: "15px", fontWeight: 700, padding: "13px 20px",
                cursor: "pointer", width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                transition: "all 0.18s ease",
                boxShadow: `0 4px 18px rgba(212,175,55,0.28)`,
                minHeight: "48px",
              }}
            >
              <BackArrow /> Back to Sign In
            </button>
          </Link>

          {/* Resend row */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ color: T.muted, fontSize: "13px" }}>Didn't receive it?</span>

            {cooldown > 0 ? (
              /* Countdown ring + text */
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <CountdownRing remaining={cooldown} total={60} />
                <span style={{ color: T.sub, fontSize: "13px", fontWeight: 500 }}>
                  Resend in {cooldown}s
                </span>
              </div>
            ) : (
              <button
                className="v2f-resend-btn"
                onClick={handleResend}
                disabled={resending}
                style={{
                  background: "none", border: "none",
                  color: resending ? T.muted : T.gold,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px", fontWeight: 700,
                  cursor: resending ? "not-allowed" : "pointer",
                  padding: 0,
                  display: "flex", alignItems: "center", gap: "6px",
                  transition: "color 0.15s",
                }}
              >
                {resending ? (
                  <><div style={{ width: "13px", height: "13px", borderRadius: "50%", border: `2px solid ${T.muted}`, borderTopColor: T.gold, animation: "v2f-spin .7s linear infinite" }} /> Sending…</>
                ) : (
                  "Resend email"
                )}
              </button>
            )}
          </div>

        </div>
      </PageShell>
    );
  }

  // ─── FORM STATE ───────────────────────────────────────────────────────────
  return (
    <PageShell>
      <div style={{ animation: "v2f-fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both" }}>

        {/* Heading */}
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "24px", fontWeight: 700,
            color: T.text, letterSpacing: "-0.01em",
            marginBottom: "8px",
          }}>
            Reset your password
          </h1>
          <p style={{ color: T.sub, fontSize: "14px", lineHeight: "1.6" }}>
            Enter your work email and we'll send you a secure reset link instantly.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div
            key={shakeKey}
            style={{
              display: "flex", alignItems: "flex-start", gap: "10px",
              backgroundColor: T.accentBg,
              border: `1px solid ${T.accentBorder}`,
              borderRadius: "10px", padding: "11px 14px",
              marginBottom: "20px",
              animation: "v2f-shake 0.45s ease, v2f-err-in 0.25s ease",
            }}
          >
            <span style={{ color: T.accent, flexShrink: 0, marginTop: "1px" }}><AlertIcon /></span>
            <span style={{ color: T.accent, fontSize: "13px", lineHeight: "1.5", fontWeight: 500 }}>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Email field */}
          <div>
            <label style={{
              display: "block",
              color: T.sub,
              fontSize: "12px", fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.07em",
              marginBottom: "7px",
            }}>
              Email address
            </label>
            <input
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@company.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); }}
              disabled={isLoading}
              className="v2f-input"
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
            <p style={{ color: T.muted, fontSize: "12px", marginTop: "6px", lineHeight: "1.5" }}>
              Use the same email address you registered with.
            </p>
          </div>

          {/* Send button */}
          <button
            type="submit"
            disabled={isLoading}
            className="v2f-btn-gold"
            style={{
              backgroundColor: T.gold, color: "#000", border: "none",
              borderRadius: "10px", fontFamily: "'DM Sans', sans-serif",
              fontSize: "15px", fontWeight: 700, padding: "13px 20px",
              cursor: isLoading ? "not-allowed" : "pointer",
              width: "100%",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "9px",
              transition: "all 0.18s ease",
              boxShadow: `0 4px 18px rgba(212,175,55,0.28)`,
              opacity: isLoading ? 0.75 : 1,
              minHeight: "48px",
            }}
          >
            {isLoading ? (
              <><SpinnerIcon /> Sending link…</>
            ) : (
              "Send Reset Link"
            )}
          </button>

        </form>

        {/* Divider */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          margin: "24px 0",
        }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: T.border }} />
          <span style={{ color: T.muted, fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            or
          </span>
          <div style={{ flex: 1, height: "1px", backgroundColor: T.border }} />
        </div>

        {/* Back to login */}
        <Link to="/login" style={{ textDecoration: "none", display: "block" }}>
          <button
            className="v2f-btn-secondary"
            style={{
              backgroundColor: "transparent",
              color: T.sub,
              border: `1px solid ${T.border}`,
              borderRadius: "10px",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "14px", fontWeight: 600,
              padding: "12px 20px",
              cursor: "pointer", width: "100%",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              transition: "all 0.18s ease",
              minHeight: "44px",
            }}
          >
            <BackArrow /> Back to Sign In
          </button>
        </Link>

        {/* Footer */}
        <p style={{
          textAlign: "center",
          color: T.muted, fontSize: "12px",
          marginTop: "20px", lineHeight: "1.5",
        }}>
          TIRAS CRM · Access by invitation only
        </p>

      </div>
    </PageShell>
  );
};

export default ForgotPasswordPage;
