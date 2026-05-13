// TIRAS CRM — Top Navbar
// Shows: page title, notification bell with unread count, user role badge, logout button

import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MdNotifications,
  MdLogout,
  MdPerson,
  MdSettings,
  MdKeyboardArrowDown,
} from "react-icons/md";
import { useAuth } from "../../contexts/AuthContext";
import {
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  SHADOWS,
  TRANSITIONS,
  LAYOUT,
  ROLE_CONFIG,
} from "../../theme";

// ─── Route title map ────────────────────────────────────────────────────────

const PAGE_TITLES = {
  "/platform/dashboard": "Platform Dashboard",
  "/platform/companies": "Companies",
  "/platform/company": "Company Detail",
  "/platform/billing": "Subscription & Billing",
  "/platform/analytics": "Platform Analytics",
  "/admin/dashboard": "God View Dashboard",
  "/admin/team": "Team Management",
  "/admin/leads": "All Leads",
  "/admin/pipeline": "Pipeline Board",
  "/admin/recordings": "Call Recordings",
  "/admin/tickets": "Support Tickets",
  "/admin/reports": "Reports & Analytics",
  "/admin/settings": "Company Settings",
  "/manager/dashboard": "Team Dashboard",
  "/manager/leads": "My Team Leads",
  "/manager/performance": "Agent Performance",
  "/manager/followups": "Follow-up Calendar",
  "/agent/dashboard": "My Dashboard",
  "/agent/leads": "My Leads",
  "/agent/lead": "Lead Detail",
  "/agent/call": "Click to Call",
  "/agent/followups": "My Follow-ups",
  "/agent/add-lead": "Add Lead",
  "/notifications": "Notifications",
  "/profile": "Profile Settings",
  "/tickets/create": "Raise a Ticket",
  "/tickets/view": "My Tickets",
  "/help": "Help Center",
};

const getPageTitle = (pathname) => {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Prefix match for dynamic routes like /agent/lead/abc123
  const match = Object.keys(PAGE_TITLES).find((key) => pathname.startsWith(key));
  return match ? PAGE_TITLES[match] : "TIRAS CRM";
};

// ─── Notification Bell ──────────────────────────────────────────────────────

const NotificationBell = ({ count = 0 }) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/notifications")}
      style={{
        position: "relative",
        background: "none",
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        padding: SPACING.sm,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: COLORS.textSecondary,
        transition: TRANSITIONS.fast,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = COLORS.primary;
        e.currentTarget.style.color = COLORS.textPrimary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = COLORS.border;
        e.currentTarget.style.color = COLORS.textSecondary;
      }}
      title="Notifications"
    >
      <MdNotifications size={18} />
      {count > 0 && (
        <span
          style={{
            position: "absolute",
            top: "-6px",
            right: "-6px",
            backgroundColor: COLORS.danger,
            color: "#fff",
            fontSize: "10px",
            fontWeight: FONTS.weight.bold,
            borderRadius: RADIUS.full,
            minWidth: "18px",
            height: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
            border: `2px solid ${COLORS.background}`,
          }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
};

// ─── User Dropdown ──────────────────────────────────────────────────────────

const UserDropdown = ({ userProfile, role, onLogout }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const roleConfig = ROLE_CONFIG[role] || {};

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const menuItem = (icon, label, onClick) => (
    <button
      key={label}
      onClick={() => { setOpen(false); onClick(); }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: SPACING.sm,
        width: "100%",
        padding: `${SPACING.sm} ${SPACING.base}`,
        background: "none",
        border: "none",
        cursor: "pointer",
        color: COLORS.textSecondary,
        fontSize: FONTS.size.base,
        textAlign: "left",
        borderRadius: RADIUS.base,
        transition: TRANSITIONS.fast,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = COLORS.surfaceHover;
        e.currentTarget.style.color = COLORS.textPrimary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = COLORS.textSecondary;
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACING.sm,
          background: "none",
          border: `1px solid ${COLORS.border}`,
          borderRadius: RADIUS.md,
          padding: `${SPACING.xs} ${SPACING.sm}`,
          cursor: "pointer",
          transition: TRANSITIONS.fast,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.primary; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.borderColor = COLORS.border; }}
      >
        {/* Avatar */}
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: RADIUS.full,
            backgroundColor: COLORS.primaryMuted,
            border: `1px solid ${COLORS.primary}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ color: COLORS.primary, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold }}>
            {userProfile?.displayName?.charAt(0)?.toUpperCase() || "?"}
          </span>
        </div>

        {/* Name + Role */}
        <div style={{ textAlign: "left", display: "none", minWidth: "100px" }} className="user-info">
          <div style={{ color: COLORS.textPrimary, fontSize: FONTS.size.sm, fontWeight: FONTS.weight.medium }}>
            {userProfile?.displayName || "User"}
          </div>
          <div
            style={{
              backgroundColor: roleConfig.bg,
              color: roleConfig.color,
              fontSize: FONTS.size.xs,
              fontWeight: FONTS.weight.semibold,
              padding: `1px ${SPACING.xs}`,
              borderRadius: RADIUS.full,
              display: "inline-block",
              marginTop: "1px",
            }}
          >
            {roleConfig.label}
          </div>
        </div>

        <MdKeyboardArrowDown
          size={16}
          color={COLORS.textMuted}
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: TRANSITIONS.fast }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "220px",
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.lg,
            boxShadow: SHADOWS.lg,
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          {/* User info header */}
          <div
            style={{
              padding: SPACING.base,
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ color: COLORS.textPrimary, fontSize: FONTS.size.base, fontWeight: FONTS.weight.semibold }}>
              {userProfile?.displayName || "User"}
            </div>
            <div style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm, marginTop: "2px" }}>
              {userProfile?.email}
            </div>
            <div
              style={{
                backgroundColor: roleConfig.bg,
                color: roleConfig.color,
                fontSize: FONTS.size.xs,
                fontWeight: FONTS.weight.semibold,
                padding: `2px ${SPACING.sm}`,
                borderRadius: RADIUS.full,
                display: "inline-block",
                marginTop: SPACING.xs,
              }}
            >
              {roleConfig.label}
            </div>
          </div>

          {/* Menu items */}
          <div style={{ padding: SPACING.xs }}>
            {menuItem(<MdPerson size={16} />, "Profile Settings", () => navigate("/profile"))}
            {menuItem(<MdSettings size={16} />, "Preferences", () => navigate("/profile"))}
            <div style={{ height: "1px", backgroundColor: COLORS.border, margin: `${SPACING.xs} 0` }} />
            {menuItem(
              <MdLogout size={16} style={{ color: COLORS.danger }} />,
              <span style={{ color: COLORS.danger }}>Log Out</span>,
              onLogout
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Navbar Component ───────────────────────────────────────────────────────

const Navbar = ({ notificationCount = 0 }) => {
  const { userProfile, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const pageTitle = getPageTitle(location.pathname);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header
      style={{
        height: LAYOUT.navbarHeight,
        backgroundColor: COLORS.surface,
        borderBottom: `1px solid ${COLORS.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `0 ${SPACING.xl}`,
        position: "sticky",
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}
    >
      {/* Left — Page title */}
      <h1
        style={{
          color: COLORS.textPrimary,
          fontSize: FONTS.size.lg,
          fontWeight: FONTS.weight.semibold,
          margin: 0,
          letterSpacing: "0.01em",
        }}
      >
        {pageTitle}
      </h1>

      {/* Right — Notification bell + User dropdown */}
      <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm }}>
        <NotificationBell count={notificationCount} />
        <UserDropdown
          userProfile={userProfile}
          role={role}
          onLogout={handleLogout}
        />
      </div>
    </header>
  );
};

export default Navbar;
