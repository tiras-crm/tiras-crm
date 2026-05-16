// TIRAS CRM V2 — TrialBanner
// Sticky banner shown below Navbar during trial period
// Gold → Red urgency at 3 days or less
// Dismissible per session (reappears on next login)

import React, { useState, useEffect } from "react";
import { useNavigate }                 from "react-router-dom";
import { MdClose, MdRocketLaunch }     from "react-icons/md";
import { useAuth }                     from "../../contexts/AuthContext";
import { getTrialDaysRemaining }       from "../../utils/subscriptionUtils";
import { FONTS, RADIUS, TRANSITIONS }  from "../../theme";

// ─── Inject keyframes ─────────────────────────────────────────────────────────

const injectStyles = () => {
  if (document.getElementById("tiras-trial-banner-styles")) return;
  const s = document.createElement("style");
  s.id = "tiras-trial-banner-styles";
  s.textContent = `
    @keyframes trial-slide-down {
      from { opacity: 0; transform: translateY(-100%); }
      to   { opacity: 1; transform: translateY(0);     }
    }
    @keyframes trial-slide-up {
      from { opacity: 1; transform: translateY(0);     max-height: 80px; }
      to   { opacity: 0; transform: translateY(-100%); max-height: 0;    }
    }
    @keyframes trial-pulse {
      0%, 100% { opacity: 1;   }
      50%       { opacity: 0.8; }
    }
    .trial-subscribe-btn:hover {
      background-color: rgba(0,0,0,0.2) !important;
      transform: translateY(-1px);
    }
    .trial-subscribe-btn:active {
      transform: translateY(0);
    }
    .trial-dismiss-btn:hover {
      background-color: rgba(0,0,0,0.15) !important;
    }
  `;
  document.head.appendChild(s);
};

// ─── Session storage key ──────────────────────────────────────────────────────
// Dismissed state lives in sessionStorage — resets on next login (new session)
const DISMISSED_KEY = "tiras_trial_banner_dismissed";

// ─── TrialBanner ─────────────────────────────────────────────────────────────

export const TrialBanner = () => {
  injectStyles();

  const navigate = useNavigate();
  const {
    isPlatformOwner,
    subscriptionStatus,
    trialEndDate,
    isSubscriptionActive,
    isTrialExpired,
  } = useAuth();

  const [dismissed, setDismissed] = useState(false);
  const [closing,   setClosing]   = useState(false);

  // Read dismissed state from sessionStorage on mount
  useEffect(() => {
    const wasDismissed = sessionStorage.getItem(DISMISSED_KEY) === "true";
    setDismissed(wasDismissed);
  }, []);

  // ── Visibility rules ───────────────────────────────────────────────────────
  // 1. Never show for platform_owner
  // 2. Never show when subscription is fully active (paid)
  // 3. Never show when trial is already expired (SubscribePage handles that)
  // 4. Only show for subscriptionStatus === "trial"
  // 5. Never show if dismissed this session

  const shouldShow = (() => {
    if (isPlatformOwner)                     return false;
    if (dismissed)                           return false;
    if (subscriptionStatus !== "trial")      return false;
    if (isTrialExpired)                      return false;
    if (isSubscriptionActive === false)      return false;
    return true;
  })();

  if (!shouldShow) return null;

  // ── Days remaining ─────────────────────────────────────────────────────────

  const daysLeft  = getTrialDaysRemaining(trialEndDate) ?? 0;
  const isUrgent  = daysLeft <= 3;

  // ── Dismiss handler ────────────────────────────────────────────────────────

  const handleDismiss = () => {
    setClosing(true);
    setTimeout(() => {
      sessionStorage.setItem(DISMISSED_KEY, "true");
      setDismissed(true);
      setClosing(false);
    }, 280);
  };

  // ── Message copy ───────────────────────────────────────────────────────────

  const getMessage = () => {
    if (daysLeft === 0) return "Your trial ends today.";
    if (daysLeft === 1) return "1 day left in your free trial.";
    return `Free Trial — ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining.`;
  };

  const getSubMessage = () => {
    if (isUrgent) return "Subscribe now to keep your data and unlock calling.";
    return "Subscribe now to unlock calling and keep your data after trial.";
  };

  // ── Colors ─────────────────────────────────────────────────────────────────

  const bgColor      = isUrgent ? "#E63946" : "#D4AF37";
  const textColor    = "#000000";                          // Always black on gold/red
  const btnBg        = "rgba(0,0,0,0.12)";
  const btnBorder    = "rgba(0,0,0,0.2)";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Trial banner: ${getMessage()} ${getSubMessage()}`}
      style={{
        backgroundColor: bgColor,
        color:           textColor,
        width:           "100%",
        position:        "sticky",
        top:             0,
        zIndex:          90,                               // Below Navbar (z-index 100)
        animation:       closing
          ? "trial-slide-up 0.28s ease forwards"
          : "trial-slide-down 0.3s ease",
        overflow:        "hidden",
      }}
    >
      {/* Urgency pulse overlay — subtle shimmer when 3 days or less */}
      {isUrgent && (
        <div style={{
          position:        "absolute",
          inset:           0,
          background:      "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
          animation:       "trial-pulse 2s ease-in-out infinite",
          pointerEvents:   "none",
        }} />
      )}

      <div style={{
        maxWidth:        "1400px",
        margin:          "0 auto",
        padding:         "10px 16px",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "space-between",
        gap:             "12px",
        flexWrap:        "wrap",
        position:        "relative",
      }}>

        {/* ── Left: icon + message ─────────────────────────────────────── */}
        <div style={{
          display:    "flex",
          alignItems: "center",
          gap:        "10px",
          flex:       1,
          minWidth:   0,
          flexWrap:   "wrap",
        }}>
          {/* Rocket icon */}
          <MdRocketLaunch
            size={18}
            color={textColor}
            style={{ flexShrink: 0, animation: isUrgent ? "trial-pulse 1.5s ease-in-out infinite" : "none" }}
          />

          {/* Main text block */}
          <div style={{
            display:    "flex",
            alignItems: "center",
            flexWrap:   "wrap",
            gap:        "6px",
            minWidth:   0,
          }}>
            <span style={{
              fontFamily:    FONTS.body,
              fontSize:      "13px",
              fontWeight:    700,
              color:         textColor,
              whiteSpace:    "nowrap",
            }}>
              {getMessage()}
            </span>

            <span style={{
              fontFamily:    FONTS.body,
              fontSize:      "13px",
              fontWeight:    400,
              color:         textColor,
              opacity:       0.85,
            }}>
              {getSubMessage()}
            </span>
          </div>
        </div>

        {/* ── Right: subscribe button + dismiss ────────────────────────── */}
        <div style={{
          display:    "flex",
          alignItems: "center",
          gap:        "8px",
          flexShrink: 0,
        }}>
          {/* Subscribe CTA */}
          <button
            className="trial-subscribe-btn"
            onClick={() => navigate("/subscribe")}
            style={{
              backgroundColor: btnBg,
              color:           textColor,
              border:          `1px solid ${btnBorder}`,
              borderRadius:    RADIUS.md,
              fontFamily:      FONTS.body,
              fontSize:        "12px",
              fontWeight:      700,
              padding:         "6px 14px",
              cursor:          "pointer",
              transition:      TRANSITIONS.base,
              whiteSpace:      "nowrap",
              minHeight:       "32px",
              display:         "flex",
              alignItems:      "center",
              gap:             "5px",
            }}
          >
            Subscribe Now
          </button>

          {/* Dismiss X */}
          <button
            className="trial-dismiss-btn"
            onClick={handleDismiss}
            aria-label="Dismiss trial banner"
            title="Dismiss — reappears on next login"
            style={{
              background:    "none",
              border:        "none",
              cursor:        "pointer",
              color:         textColor,
              opacity:       0.7,
              padding:       "4px",
              borderRadius:  RADIUS.base,
              display:       "flex",
              alignItems:    "center",
              justifyContent:"center",
              transition:    TRANSITIONS.fast,
              minHeight:     "32px",
              minWidth:      "32px",
            }}
          >
            <MdClose size={16} />
          </button>
        </div>
      </div>

      {/* Urgency progress bar — thin strip showing days consumed ──────────── */}
      {(() => {
        const totalDays = 14;
        const usedPct   = Math.min(((totalDays - daysLeft) / totalDays) * 100, 100);
        return (
          <div style={{
            height:          "3px",
            backgroundColor: "rgba(0,0,0,0.15)",
            width:           "100%",
          }}>
            <div style={{
              height:          "100%",
              width:           `${usedPct}%`,
              backgroundColor: isUrgent ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.25)",
              transition:      "width 0.6s ease",
              borderRadius:    "0 2px 2px 0",
            }} />
          </div>
        );
      })()}
    </div>
  );
};

export default TrialBanner;
