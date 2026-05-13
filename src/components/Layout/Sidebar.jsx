// TIRAS CRM — Sidebar Navigation
// Shows correct menu items based on logged-in user's role
// Supports collapsible state for mobile screens

import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  MdDashboard,
  MdBusiness,
  MdPeople,
  MdLeaderboard,
  MdPhone,
  MdAssignment,
  MdBarChart,
  MdSettings,
  MdPerson,
  MdNotifications,
  MdHelp,
  MdSupportAgent,
  MdPayment,
  MdCalendarMonth,
  MdViewKanban,
  MdRecordVoiceOver,
  MdGroup,
  MdAnalytics,
  MdCorporateFare,
  MdAttachMoney,
  MdChevronLeft,
  MdChevronRight,
} from "react-icons/md";
import { useAuth } from "../../contexts/AuthContext";
import { COLORS, FONTS, SPACING, RADIUS, TRANSITIONS, LAYOUT, ROLE_CONFIG } from "../../theme";

// ─── Nav Item Definition ────────────────────────────────────────────────────

const NavItem = ({ to, icon: Icon, label, collapsed }) => {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <NavLink
      to={to}
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: SPACING.md,
          padding: collapsed ? `${SPACING.md} 0` : `${SPACING.sm} ${SPACING.md}`,
          margin: `2px ${SPACING.sm}`,
          borderRadius: RADIUS.md,
          borderLeft: isActive ? `3px solid ${COLORS.sidebarActiveBorder}` : "3px solid transparent",
          backgroundColor: isActive ? COLORS.sidebarActive : "transparent",
          cursor: "pointer",
          transition: TRANSITIONS.fast,
          justifyContent: collapsed ? "center" : "flex-start",
          position: "relative",
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = COLORS.surfaceHover;
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <Icon
          size={18}
          color={isActive ? COLORS.primary : COLORS.textSecondary}
          style={{ flexShrink: 0 }}
        />
        {!collapsed && (
          <span
            style={{
              fontSize: FONTS.size.base,
              fontWeight: isActive ? FONTS.weight.semibold : FONTS.weight.regular,
              color: isActive ? COLORS.textPrimary : COLORS.textSecondary,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </span>
        )}
      </div>
    </NavLink>
  );
};

// ─── Section Label ──────────────────────────────────────────────────────────

const SectionLabel = ({ label, collapsed }) => {
  if (collapsed) {
    return <div style={{ height: "1px", backgroundColor: COLORS.border, margin: `${SPACING.md} ${SPACING.sm}` }} />;
  }
  return (
    <div
      style={{
        fontSize: FONTS.size.xs,
        fontWeight: FONTS.weight.semibold,
        color: COLORS.textMuted,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        padding: `${SPACING.lg} ${SPACING.xl} ${SPACING.xs}`,
      }}
    >
      {label}
    </div>
  );
};

// ─── Role-based Nav Config ──────────────────────────────────────────────────

const getNavSections = (role) => {
  switch (role) {

    case "platform_owner":
      return [
        {
          label: "Platform",
          items: [
            { to: "/platform/dashboard", icon: MdDashboard, label: "Platform Dashboard" },
            { to: "/platform/companies", icon: MdCorporateFare, label: "Companies" },
            { to: "/platform/billing", icon: MdAttachMoney, label: "Subscription & Billing" },
            { to: "/platform/analytics", icon: MdAnalytics, label: "Platform Analytics" },
          ],
        },
        {
          label: "Account",
          items: [
            { to: "/notifications", icon: MdNotifications, label: "Notifications" },
            { to: "/profile", icon: MdPerson, label: "Profile Settings" },
            { to: "/help", icon: MdHelp, label: "Help Center" },
          ],
        },
      ];

    case "company_admin":
      return [
        {
          label: "Overview",
          items: [
            { to: "/admin/dashboard", icon: MdDashboard, label: "God View Dashboard" },
            { to: "/admin/team", icon: MdGroup, label: "Team Management" },
          ],
        },
        {
          label: "Leads & Sales",
          items: [
            { to: "/admin/leads", icon: MdPeople, label: "All Leads" },
            { to: "/admin/pipeline", icon: MdViewKanban, label: "Pipeline Board" },
          ],
        },
        {
          label: "Calls & Support",
          items: [
            { to: "/admin/recordings", icon: MdRecordVoiceOver, label: "Call Recordings" },
            { to: "/admin/tickets", icon: MdAssignment, label: "Support Tickets" },
          ],
        },
        {
          label: "Intelligence",
          items: [
            { to: "/admin/reports", icon: MdBarChart, label: "Reports & Analytics" },
          ],
        },
        {
          label: "Account",
          items: [
            { to: "/admin/settings", icon: MdSettings, label: "Company Settings" },
            { to: "/notifications", icon: MdNotifications, label: "Notifications" },
            { to: "/profile", icon: MdPerson, label: "Profile Settings" },
            { to: "/tickets/create", icon: MdSupportAgent, label: "Raise a Ticket" },
            { to: "/help", icon: MdHelp, label: "Help Center" },
          ],
        },
      ];

    case "manager":
      return [
        {
          label: "My Team",
          items: [
            { to: "/manager/dashboard", icon: MdDashboard, label: "Team Dashboard" },
            { to: "/manager/leads", icon: MdPeople, label: "My Team Leads" },
            { to: "/manager/performance", icon: MdLeaderboard, label: "Agent Performance" },
            { to: "/manager/followups", icon: MdCalendarMonth, label: "Follow-up Calendar" },
          ],
        },
        {
          label: "Account",
          items: [
            { to: "/notifications", icon: MdNotifications, label: "Notifications" },
            { to: "/profile", icon: MdPerson, label: "Profile Settings" },
            { to: "/tickets/create", icon: MdSupportAgent, label: "Raise a Ticket" },
            { to: "/help", icon: MdHelp, label: "Help Center" },
          ],
        },
      ];

    case "agent":
      return [
        {
          label: "My Work",
          items: [
            { to: "/agent/dashboard", icon: MdDashboard, label: "My Dashboard" },
            { to: "/agent/leads", icon: MdPeople, label: "My Leads" },
            { to: "/agent/call", icon: MdPhone, label: "Click to Call" },
            { to: "/agent/followups", icon: MdCalendarMonth, label: "My Follow-ups" },
          ],
        },
        {
          label: "Account",
          items: [
            { to: "/notifications", icon: MdNotifications, label: "Notifications" },
            { to: "/profile", icon: MdPerson, label: "Profile Settings" },
            { to: "/tickets/create", icon: MdSupportAgent, label: "Raise a Ticket" },
            { to: "/help", icon: MdHelp, label: "Help Center" },
          ],
        },
      ];

    case "support_agent":
      return [
        {
          label: "Support",
          items: [
            { to: "/agent/dashboard", icon: MdDashboard, label: "My Dashboard" },
            { to: "/tickets/view", icon: MdAssignment, label: "My Tickets" },
          ],
        },
        {
          label: "Account",
          items: [
            { to: "/notifications", icon: MdNotifications, label: "Notifications" },
            { to: "/profile", icon: MdPerson, label: "Profile Settings" },
            { to: "/help", icon: MdHelp, label: "Help Center" },
          ],
        },
      ];

    default:
      return [];
  }
};

// ─── Sidebar Component ──────────────────────────────────────────────────────

const Sidebar = () => {
  const { role, userProfile } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const sections = getNavSections(role);
  const roleConfig = ROLE_CONFIG[role] || {};

  return (
    <aside
      style={{
        width: collapsed ? LAYOUT.sidebarCollapsedWidth : LAYOUT.sidebarWidth,
        minHeight: "100vh",
        backgroundColor: COLORS.sidebarBg,
        borderRight: `1px solid ${COLORS.border}`,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.25s ease",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        overflowY: "auto",
        overflowX: "hidden",
        scrollbarWidth: "thin",
        scrollbarColor: `${COLORS.scrollbarThumb} ${COLORS.scrollbarTrack}`,
      }}
    >

      {/* Logo + Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          padding: `${SPACING.lg} ${SPACING.base}`,
          borderBottom: `1px solid ${COLORS.border}`,
          height: LAYOUT.navbarHeight,
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: RADIUS.base,
                backgroundColor: COLORS.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  color: COLORS.textInverse,
                  fontSize: FONTS.size.sm,
                  fontWeight: FONTS.weight.bold,
                  letterSpacing: "0.05em",
                }}
              >
                T
              </span>
            </div>
            <span
              style={{
                color: COLORS.textPrimary,
                fontSize: FONTS.size.lg,
                fontWeight: FONTS.weight.bold,
                letterSpacing: "0.04em",
              }}
            >
              TIRAS
            </span>
          </div>
        )}

        {collapsed && (
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: RADIUS.base,
              backgroundColor: COLORS.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                color: COLORS.textInverse,
                fontSize: FONTS.size.sm,
                fontWeight: FONTS.weight.bold,
              }}
            >
              T
            </span>
          </div>
        )}

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: COLORS.textMuted,
              display: "flex",
              padding: SPACING.xs,
              borderRadius: RADIUS.sm,
            }}
            title="Collapse sidebar"
          >
            <MdChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: COLORS.textMuted,
            display: "flex",
            justifyContent: "center",
            padding: SPACING.sm,
            marginTop: SPACING.xs,
          }}
          title="Expand sidebar"
        >
          <MdChevronRight size={18} />
        </button>
      )}

      {/* Role badge */}
      {!collapsed && role && (
        <div style={{ padding: `${SPACING.md} ${SPACING.base} ${SPACING.xs}` }}>
          <span
            style={{
              backgroundColor: roleConfig.bg,
              color: roleConfig.color,
              fontSize: FONTS.size.xs,
              fontWeight: FONTS.weight.semibold,
              padding: `2px ${SPACING.sm}`,
              borderRadius: RADIUS.full,
            }}
          >
            {roleConfig.label}
          </span>
        </div>
      )}

      {/* Nav sections */}
      <nav style={{ flex: 1, paddingBottom: SPACING.xl }}>
        {sections.map((section) => (
          <div key={section.label}>
            <SectionLabel label={section.label} collapsed={collapsed} />
            {section.items.map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* User name footer */}
      {!collapsed && userProfile && (
        <div
          style={{
            padding: SPACING.base,
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            gap: SPACING.sm,
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
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
              {userProfile.displayName?.charAt(0)?.toUpperCase() || "?"}
            </span>
          </div>
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                color: COLORS.textPrimary,
                fontSize: FONTS.size.sm,
                fontWeight: FONTS.weight.medium,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {userProfile.displayName || userProfile.email}
            </div>
            <div style={{ color: COLORS.textMuted, fontSize: FONTS.size.xs }}>
              {userProfile.email}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
