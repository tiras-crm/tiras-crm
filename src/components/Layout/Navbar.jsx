// TIRAS CRM V2 — Top Navbar
// Obsidian Gold | Wallet balance for Admin/Manager | Hamburger on mobile | Notifications bell

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MdNotifications, MdMenu, MdLogout, MdPerson,
  MdSettings, MdKeyboardArrowDown, MdAccountBalanceWallet,
} from "react-icons/md";
import { doc, onSnapshot } from "firebase/firestore";
import { db, COLLECTIONS } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import {
  COLORS, FONTS, SPACING, RADIUS, SHADOWS,
  TRANSITIONS, LAYOUT, ROLE_CONFIG, STYLES, WALLET,
} from "../../theme";

// ─── Page title map ───────────────────────────────────────────────────────────

const PAGE_TITLES = {
  "/platform/dashboard":    "Platform Dashboard",
  "/platform/companies":    "Companies",
  "/platform/billing":      "Billing Manager",
  "/platform/analytics":    "Platform Analytics",
  "/admin/dashboard":       "God View",
  "/admin/team":            "Team Management",
  "/admin/leads":           "All Leads",
  "/admin/pipeline":        "Pipeline",
  "/admin/recordings":      "Call Recordings",
  "/admin/tickets":         "Support Tickets",
  "/admin/reports":         "Reports & Analytics",
  "/admin/settings":        "Settings",
  "/admin/wallet":          "Wallet",
  "/admin/usage":           "Usage",
  "/manager/dashboard":     "Team Dashboard",
  "/manager/leads":         "My Team Leads",
  "/manager/performance":   "Agent Performance",
  "/manager/calendar":      "Follow-up Calendar",
  "/agent/dashboard":       "My Dashboard",
  "/agent/leads":           "My Leads",
  "/agent/call":            "Click to Call",
  "/agent/followups":       "My Follow-ups",
  "/agent/lead/new":        "Add Lead",
  "/notifications":         "Notifications",
  "/profile":               "Profile Settings",
  "/tickets":               "Support Tickets",
  "/help":                  "Help Center",
};

const getPageTitle = (pathname) => {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const match = Object.keys(PAGE_TITLES).find((k) => pathname.startsWith(k + "/") || pathname.startsWith(k));
  return match ? PAGE_TITLES[match] : "TIRAS CRM";
};

// ─── WalletBadge ──────────────────────────────────────────────────────────────
// Shows wallet balance in navbar for Company Admin and Manager
// Real-time subscription to company document

const WalletBadge = ({ companyId }) => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;

    const unsub = onSnapshot(
      doc(db, COLLECTIONS.COMPANIES, companyId),
      (snap) => {
        if (snap.exists()) {
          setBalance(snap.data()?.wallet?.balance ?? 0);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [companyId]);

  if (loading || balance === null) return null;

  const isLow = balance <= WALLET.lowBalanceAlert;

  return (
    <button
      onClick={() => navigate("/admin/wallet")}
      title="Wallet balance — click to recharge"
      style={{
        display:         "flex",
        alignItems:      "center",
        gap:             SPACING.xs,
        backgroundColor: isLow ? COLORS.accentMuted : COLORS.primaryMuted,
        border:          `1px solid ${isLow ? COLORS.accent : COLORS.primary}`,
        borderRadius:    RADIUS.full,
        padding:         `4px ${SPACING.md}`,
        cursor:          "pointer",
        transition:      TRANSITIONS.fast,
        minHeight:       "36px",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
    >
      <MdAccountBalanceWallet size={14} color={isLow ? COLORS.accent : COLORS.primary} />
      <span style={{
        fontFamily:   FONTS.mono,
        fontSize:     FONTS.size.sm,
        fontWeight:   FONTS.weight.semibold,
        color:        isLow ? COLORS.accent : COLORS.primary,
      }}>
        ₹{balance.toFixed(0)}
      </span>
      {isLow && (
        <span style={{
          fontSize:     "9px",
          fontWeight:   700,
          color:        COLORS.accent,
          fontFamily:   FONTS.body,
          textTransform:"uppercase",
          letterSpacing:"0.05em",
        }}>
          LOW
        </span>
      )}
    </button>
  );
};

// ─── NotificationBell ─────────────────────────────────────────────────────────

const NotificationBell = ({ count = 0 }) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/notifications")}
      style={{
        position:        "relative",
        background:      "none",
        border:          `1px solid ${COLORS.border}`,
        borderRadius:    RADIUS.md,
        padding:         SPACING.sm,
        cursor:          "pointer",
        color:           COLORS.textSecondary,
        transition:      TRANSITIONS.fast,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        minWidth:        "44px",
        minHeight:       "44px",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.primary; e.currentTarget.style.color = COLORS.primary; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border;  e.currentTarget.style.color = COLORS.textSecondary; }}
      title="Notifications"
      aria-label={`Notifications${count > 0 ? ` — ${count} unread` : ""}`}
    >
      <MdNotifications size={20} />
      {count > 0 && (
        <span style={{
          position:        "absolute",
          top:             "-6px",
          right:           "-6px",
          backgroundColor: COLORS.accent,
          color:           "#fff",
          fontSize:        "10px",
          fontWeight:      700,
          borderRadius:    RADIUS.full,
          minWidth:        "18px",
          height:          "18px",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          padding:         "0 4px",
          border:          `2px solid ${COLORS.surface}`,
          fontFamily:      FONTS.body,
        }}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
};

// ─── UserDropdown ─────────────────────────────────────────────────────────────

const UserDropdown = ({ userProfile, role }) => {
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);
  const navigate          = useNavigate();
  const { logout }        = useAuth();
  const roleConf          = ROLE_CONFIG[role] || {};

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const menuItem = (icon, label, onClick, danger = false) => (
    <button
      key={label}
      onClick={() => { setOpen(false); onClick(); }}
      style={{
        display:         "flex",
        alignItems:      "center",
        gap:             SPACING.sm,
        width:           "100%",
        padding:         `${SPACING.sm} ${SPACING.base}`,
        background:      "none",
        border:          "none",
        cursor:          "pointer",
        color:           danger ? COLORS.accent : COLORS.textSecondary,
        fontSize:        FONTS.size.base,
        fontFamily:      FONTS.body,
        textAlign:       "left",
        borderRadius:    RADIUS.base,
        transition:      TRANSITIONS.fast,
        minHeight:       "44px",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.surfaceHover; e.currentTarget.style.color = danger ? COLORS.accent : COLORS.textPrimary; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = danger ? COLORS.accent : COLORS.textSecondary; }}
    >
      {icon}
      {label}
    </button>
  );

  const handleLogout = async () => { await logout(); navigate("/login"); };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display:         "flex",
          alignItems:      "center",
          gap:             SPACING.sm,
          background:      "none",
          border:          `1px solid ${COLORS.border}`,
          borderRadius:    RADIUS.md,
          padding:         `${SPACING.xs} ${SPACING.sm}`,
          cursor:          "pointer",
          transition:      TRANSITIONS.fast,
          minHeight:       "44px",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.primary; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.borderColor = COLORS.border; }}
      >
        {/* Avatar */}
        <div style={{
          width:           "30px",
          height:          "30px",
          borderRadius:    RADIUS.full,
          backgroundColor: COLORS.primaryMuted,
          border:          `1px solid ${COLORS.primary}`,
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "center",
          flexShrink:      0,
        }}>
          <span style={{ color: COLORS.primary, fontSize: FONTS.size.sm, fontWeight: 700, fontFamily: FONTS.body }}>
            {userProfile?.displayName?.charAt(0)?.toUpperCase() || "?"}
          </span>
        </div>

        {/* Name — hidden on small screens */}
        <span style={{
          color:        COLORS.textPrimary,
          fontSize:     FONTS.size.sm,
          fontWeight:   FONTS.weight.medium,
          fontFamily:   FONTS.body,
          display:      "none",
        }} className="navbar-username">
          {userProfile?.displayName?.split(" ")[0] || "User"}
        </span>

        <MdKeyboardArrowDown
          size={16}
          color={COLORS.textMuted}
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: TRANSITIONS.fast }}
        />
      </button>

      {open && (
        <div style={{
          position:        "absolute",
          top:             "calc(100% + 8px)",
          right:           0,
          width:           "220px",
          backgroundColor: COLORS.surface,
          border:          `1px solid ${COLORS.border}`,
          borderRadius:    RADIUS.lg,
          boxShadow:       SHADOWS.lg,
          zIndex:          1000,
          overflow:        "hidden",
        }}>
          {/* User info */}
          <div style={{ padding: SPACING.base, borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ color: COLORS.textPrimary, fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold, fontFamily: FONTS.body }}>
              {userProfile?.displayName || "User"}
            </div>
            <div style={{ color: COLORS.textMuted, fontSize: FONTS.size.xs, marginTop: "2px", fontFamily: FONTS.body }}>{userProfile?.email}</div>
            <span style={{
              ...STYLES.badge,
              backgroundColor: roleConf.bg,
              color:           roleConf.color,
              marginTop:       SPACING.xs,
            }}>
              {roleConf.label}
            </span>
          </div>

          <div style={{ padding: SPACING.xs }}>
            {menuItem(<MdPerson size={16} />, "Profile Settings", () => navigate("/profile"))}
            {menuItem(<MdSettings size={16} />, "Settings", () => navigate("/admin/settings"))}
            <div style={{ height: "1px", backgroundColor: COLORS.border, margin: `${SPACING.xs} 0` }} />
            {menuItem(<MdLogout size={16} />, "Log Out", handleLogout, true)}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Navbar ───────────────────────────────────────────────────────────────────

export const Navbar = ({ notificationCount = 0, onHamburgerClick }) => {
  const { userProfile, role, companyId, isCompanyAdmin, isManager } = useAuth();
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);
  const showWallet = isCompanyAdmin || isManager;

  return (
    <>
      <style>{`
        @media (min-width: 769px) {
          .navbar-username { display: block !important; }
          .tiras-hamburger { display: none !important; }
        }
      `}</style>

      <header style={{
        height:          LAYOUT.navbarHeight,
        backgroundColor: COLORS.surface,
        borderBottom:    `1px solid ${COLORS.border}`,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "space-between",
        padding:         `0 ${SPACING.xl}`,
        position:        "sticky",
        top:             0,
        zIndex:          100,
        flexShrink:      0,
        gap:             SPACING.sm,
      }}>
        {/* Left — hamburger + title */}
        <div style={{ display: "flex", alignItems: "center", gap: SPACING.md, flex: 1, minWidth: 0 }}>
          {/* Hamburger — mobile only */}
          <button
            onClick={onHamburgerClick}
            className="tiras-hamburger"
            style={{
              background:   "none",
              border:       "none",
              cursor:       "pointer",
              color:        COLORS.textSecondary,
              display:      "flex",
              padding:      SPACING.xs,
              borderRadius: RADIUS.base,
              minWidth:     "44px",
              minHeight:    "44px",
              alignItems:   "center",
              justifyContent: "center",
            }}
            aria-label="Open menu"
          >
            <MdMenu size={22} />
          </button>

          <h1 style={{
            fontFamily:    FONTS.heading,
            fontSize:      "18px",
            fontWeight:    700,
            color:         COLORS.textPrimary,
            margin:        0,
            whiteSpace:    "nowrap",
            overflow:      "hidden",
            textOverflow:  "ellipsis",
          }}>
            {pageTitle}
          </h1>
        </div>

        {/* Right — wallet + bell + user */}
        <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm, flexShrink: 0 }}>
          {showWallet && companyId && (
            <WalletBadge companyId={companyId} />
          )}
          <NotificationBell count={notificationCount} />
          <UserDropdown userProfile={userProfile} role={role} />
        </div>
      </header>
    </>
  );
};

export default Navbar;
