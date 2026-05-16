// TIRAS CRM V2 — AnnouncementBanner.jsx
// Reusable banner shown at top of Admin Dashboard
// Fetches active announcements from Firestore — isActive == true
// Dismissed state stored in sessionStorage — reappears on next login
// Colors by type: offer/feature/maintenance/urgent
// Renders null if no active announcements

import React, { useEffect, useState } from "react";
import {
  collection, query, where, orderBy,
  onSnapshot, Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";

// ─── Type config ──────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  offer: {
    bg:         "#D4AF37",
    text:       "#000000",
    badgeBg:    "rgba(0,0,0,0.15)",
    badgeText:  "#000000",
    label:      "🎁 Offer",
    border:     "#B8960F",
  },
  feature: {
    bg:         "#10B981",
    text:       "#ffffff",
    badgeBg:    "rgba(255,255,255,0.2)",
    badgeText:  "#ffffff",
    label:      "✨ New Feature",
    border:     "#059669",
  },
  maintenance: {
    bg:         "#F59E0B",
    text:       "#000000",
    badgeBg:    "rgba(0,0,0,0.15)",
    badgeText:  "#000000",
    label:      "🔧 Maintenance",
    border:     "#D97706",
  },
  urgent: {
    bg:         "#E63946",
    text:       "#ffffff",
    badgeBg:    "rgba(255,255,255,0.2)",
    badgeText:  "#ffffff",
    label:      "⚠ Urgent",
    border:     "#C1121F",
  },
};

const FONT_BODY = "'DM Sans', system-ui, sans-serif";
const FONT_HEAD = "'Playfair Display', Georgia, serif";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sessionKey = (id) => `tiras_banner_dismissed_${id}`;

const isDismissed = (id) => {
  try {
    return sessionStorage.getItem(sessionKey(id)) === "true";
  } catch {
    return false;
  }
};

const setDismissed = (id) => {
  try {
    sessionStorage.setItem(sessionKey(id), "true");
  } catch {
    // sessionStorage not available — ignore
  }
};

const fmtDate = (ts) => {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const isExpired = (ts) => {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d < new Date();
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const AnnouncementBanner = () => {
  const { companyId } = useAuth();

  const [announcements, setAnnouncements] = useState([]);
  const [dismissedIds,  setDismissedIds]  = useState({});
  const [loading,       setLoading]       = useState(true);

  // ── Fetch active announcements — real-time ────────────────────────────────
  useEffect(() => {
    const u = onSnapshot(
      query(
        collection(db, "announcements"),
        where("isActive", "==", true),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAnnouncements(docs);
        setLoading(false);
      },
      (err) => {
        console.error("AnnouncementBanner: fetch error", err);
        setLoading(false);
      }
    );
    return () => u();
  }, []);

  // ── Find the best announcement to show ───────────────────────────────────
  // Priority: urgent > maintenance > offer > feature
  // Filters: not dismissed, not expired, target matches company plan
  const PRIORITY = ["urgent", "maintenance", "offer", "feature"];

  const activeBanner = announcements
    .filter((ann) => {
      // Not dismissed this session
      if (dismissedIds[ann.id] || isDismissed(ann.id)) return false;
      // Not expired
      if (isExpired(ann.validUntil)) return false;
      // Target check — "all" matches everyone
      // If we have companyId/plan we could filter by plan — for now "all" always shows
      // (Plan-specific filtering can be added here when plan is available in context)
      return true;
    })
    .sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type))[0] || null;

  // ── Dismiss handler ───────────────────────────────────────────────────────
  const dismiss = (id) => {
    setDismissedIds((prev) => ({ ...prev, [id]: true }));
    setDismissed(id);
  };

  // ── Render nothing if loading or no active banner ─────────────────────────
  if (loading || !activeBanner) return null;

  const config      = TYPE_CONFIG[activeBanner.type] || TYPE_CONFIG.feature;
  const validUntilStr = fmtDate(activeBanner.validUntil);

  return (
    <>
      <style>{`
        @keyframes bannerSlideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        .ann-banner-close:hover {
          background-color: rgba(0,0,0,0.15) !important;
        }
      `}</style>

      <div
        role="alert"
        aria-live="polite"
        style={{
          backgroundColor: config.bg,
          borderBottom:    `1px solid ${config.border}`,
          padding:         "11px 20px",
          display:         "flex",
          alignItems:      "flex-start",
          gap:             14,
          animation:       "bannerSlideDown 0.3s ease",
          position:        "relative",
          zIndex:          50,
        }}
      >
        {/* Type badge */}
        <div style={{ flexShrink: 0, paddingTop: 1 }}>
          <span style={{
            fontFamily:      FONT_BODY,
            fontSize:        11,
            fontWeight:      700,
            padding:         "3px 10px",
            borderRadius:    20,
            backgroundColor: config.badgeBg,
            color:           config.badgeText,
            letterSpacing:   "0.06em",
            textTransform:   "uppercase",
            whiteSpace:      "nowrap",
          }}>
            {config.label}
          </span>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <div style={{
            fontFamily:  FONT_HEAD,
            fontSize:    15,
            fontWeight:  700,
            color:       config.text,
            lineHeight:  1.3,
            marginBottom: activeBanner.message ? 3 : 0,
          }}>
            {activeBanner.title}
          </div>

          {/* Message */}
          {activeBanner.message && (
            <div style={{
              fontFamily: FONT_BODY,
              fontSize:   13,
              color:      config.text,
              opacity:    0.88,
              lineHeight: 1.5,
            }}>
              {activeBanner.message}
            </div>
          )}

          {/* Meta: discount + valid until */}
          {(activeBanner.discountPercent || validUntilStr) && (
            <div style={{
              display:    "flex",
              gap:        12,
              flexWrap:   "wrap",
              marginTop:  5,
              alignItems: "center",
            }}>
              {activeBanner.discountPercent && (
                <span style={{
                  fontFamily:      FONT_BODY,
                  fontSize:        12,
                  fontWeight:      700,
                  padding:         "2px 10px",
                  borderRadius:    20,
                  backgroundColor: config.badgeBg,
                  color:           config.badgeText,
                }}>
                  {activeBanner.discountPercent}% OFF
                </span>
              )}
              {validUntilStr && (
                <span style={{
                  fontFamily: FONT_BODY,
                  fontSize:   12,
                  color:      config.text,
                  opacity:    0.75,
                }}>
                  Valid until {validUntilStr}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          className="ann-banner-close"
          onClick={() => dismiss(activeBanner.id)}
          aria-label="Dismiss announcement"
          style={{
            flexShrink:      0,
            background:      "none",
            border:          "none",
            color:           config.text,
            cursor:          "pointer",
            fontSize:        20,
            lineHeight:      1,
            padding:         "4px 6px",
            borderRadius:    6,
            opacity:         0.8,
            transition:      "background-color 0.15s, opacity 0.15s",
            minWidth:        32,
            minHeight:       32,
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.8"; }}
        >
          ×
        </button>
      </div>
    </>
  );
};

export default AnnouncementBanner;
