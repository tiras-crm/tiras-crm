// TIRAS CRM V2 — Sidebar Navigation
// Obsidian Gold theme | Hamburger on mobile (max-width: 768px)
// Role-based nav items | Collapsible on desktop

import React, { useState, useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  MdDashboard, MdPeople, MdPhone, MdAssignment, MdBarChart,
  MdSettings, MdPerson, MdNotifications, MdHelp, MdSupportAgent,
  MdCalendarMonth, MdViewKanban, MdRecordVoiceOver, MdGroup,
  MdAnalytics, MdCorporateFare, MdAttachMoney, MdMenu, MdClose,
  MdLogout, MdAccountBalanceWallet, MdDataUsage, MdLeaderboard,
} from "react-icons/md";
import { useAuth } from "../../contexts/AuthContext";
import { COLORS, FONTS, SPACING, RADIUS, TRANSITIONS, LAYOUT, ROLE_CONFIG, STYLES } from "../../theme";

// ─── Inject CSS for sidebar ───────────────────────────────────────────────────

const injectSidebarStyles = () => {
  if (document.getElementById("tiras-sidebar-styles")) return;
  const style = document.createElement("style");
  style.id = "tiras-sidebar-styles";
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');

    @keyframes tiras-slide-in {
      from { transform: translateX(-100%); opacity: 0; }
      to   { transform: translateX(0);     opacity: 1; }
    }
    @keyframes tiras-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .tiras-nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      margin: 2px 8px;
      border-radius: 8px;
      border-left: 3px solid transparent;
      cursor: pointer;
      transition: all 0.15s ease;
      text-decoration: none;
      color: ${COLORS.textSecondary};
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 500;
      min-height: 44px;
    }
    .tiras-nav-item:hover {
      background-color: ${COLORS.surfaceHover};
      color: ${COLORS.textPrimary};
    }
    .tiras-nav-item.active {
      background-color: rgba(212,175,55,0.12);
      border-left-color: ${COLORS.primary};
      color: ${COLORS.primary};
      font-weight: 600;
    }
    .tiras-nav-item.active svg { color: ${COLORS.primary} !important; }

    .tiras-section-label {
      font-family: 'DM Sans', sans-serif;
      font-size: 10px;
      font-weight: 600;
      color: ${COLORS.textMuted};
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 16px 20px 4px;
    }

    .tiras-sidebar-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 199;
      animation: tiras-fade-in 0.2s ease;
    }

    /* Mobile: sidebar hidden by default */
    @media (max-width: 768px) {
      .tiras-sidebar {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        height: 100vh !important;
        z-index: 200 !important;
        transform: translateX(-100%);
        transition: transform 0.25s ease !important;
        box-shadow: 4px 0 24px rgba(0,0,0,0.8) !important;
      }
      .tiras-sidebar.open {
        transform: translateX(0) !important;
        animation: tiras-slide-in 0.25s ease;
      }
    }
    /* Desktop: sidebar always visible */
    @media (min-width: 769px) {
      .tiras-sidebar {
        position: sticky !important;
        top: 0 !important;
        transform: none !important;
      }
      .tiras-sidebar-overlay { display: none !important; }
    }
  `;
  document.head.appendChild(style);
};

// ─── Role-based nav config ────────────────────────────────────────────────────

const getNavSections = (role) => {
  const shared = [
    { to: "/notifications", icon: MdNotifications, label: "Notifications" },
    { to: "/profile",       icon: MdPerson,        label: "Profile"       },
    { to: "/help",          icon: MdHelp,           label: "Help Center"   },
  ];

  switch (role) {
    case "platform_owner":
      return [
        { label: "Platform", items: [
          { to: "/platform/dashboard",  icon: MdDashboard,        label: "Dashboard"      },
          { to: "/platform/companies",  icon: MdCorporateFare,    label: "Companies"      },
          { to: "/platform/billing",    icon: MdAttachMoney,      label: "Billing"        },
          { to: "/platform/analytics",  icon: MdAnalytics,        label: "Analytics"      },
        ]},
        { label: "Account", items: shared },
      ];

    case "company_admin":
      return [
        { label: "Overview", items: [
          { to: "/admin/dashboard",   icon: MdDashboard,           label: "God View"          },
          { to: "/admin/team",        icon: MdGroup,               label: "Team"              },
          { to: "/admin/wallet",      icon: MdAccountBalanceWallet, label: "Wallet"           },
          { to: "/admin/usage",       icon: MdDataUsage,           label: "Usage"             },
        ]},
        { label: "Leads & Sales", items: [
          { to: "/admin/leads",       icon: MdPeople,              label: "All Leads"         },
          { to: "/admin/pipeline",    icon: MdViewKanban,          label: "Pipeline"          },
        ]},
        { label: "Operations", items: [
          { to: "/admin/recordings",  icon: MdRecordVoiceOver,     label: "Recordings"        },
          { to: "/admin/tickets",     icon: MdAssignment,          label: "Tickets"           },
          { to: "/admin/reports",     icon: MdBarChart,            label: "Reports"           },
          { to: "/admin/settings",    icon: MdSettings,            label: "Settings"          },
        ]},
        { label: "Account", items: shared },
      ];

    case "manager":
      return [
        { label: "My Team", items: [
          { to: "/manager/dashboard",   icon: MdDashboard,   label: "Dashboard"    },
          { to: "/manager/leads",       icon: MdPeople,      label: "Team Leads"   },
          { to: "/manager/performance", icon: MdLeaderboard, label: "Performance"  },
          { to: "/manager/calendar",    icon: MdCalendarMonth, label: "Calendar"   },
        ]},
        { label: "Account", items: shared },
      ];

    case "agent":
      return [
        { label: "My Work", items: [
          { to: "/agent/dashboard",  icon: MdDashboard,  label: "Dashboard"    },
          { to: "/agent/leads",      icon: MdPeople,     label: "My Leads"     },
          { to: "/agent/call",       icon: MdPhone,      label: "Click to Call"},
          { to: "/agent/followups",  icon: MdCalendarMonth, label: "Follow-ups"},
        ]},
        { label: "Account", items: [
          { to: "/notifications",    icon: MdNotifications, label: "Notifications" },
          { to: "/profile",          icon: MdPerson,        label: "Profile"       },
          { to: "/tickets",          icon: MdSupportAgent,  label: "Raise Ticket"  },
          { to: "/help",             icon: MdHelp,          label: "Help"          },
        ]},
      ];

    case "support_agent":
      return [
        { label: "Support", items: [
          { to: "/agent/dashboard",  icon: MdDashboard,   label: "Dashboard" },
          { to: "/tickets",          icon: MdAssignment,  label: "My Tickets"},
        ]},
        { label: "Account", items: shared },
      ];

    default:
      return [];
  }
};

// ─── Sidebar Component ────────────────────────────────────────────────────────

export const Sidebar = ({ mobileOpen, onMobileClose }) => {
  injectSidebarStyles();

  const { role, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const sections = getNavSections(role);
  const roleConf = ROLE_CONFIG[role] || {};

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="tiras-sidebar-overlay"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`tiras-sidebar${mobileOpen ? " open" : ""}`}
        style={{
          width:           LAYOUT.sidebarWidth,
          minHeight:       "100vh",
          backgroundColor: COLORS.surface,
          borderRight:     `1px solid ${COLORS.border}`,
          display:         "flex",
          flexDirection:   "column",
          flexShrink:      0,
          overflowY:       "auto",
          overflowX:       "hidden",
          scrollbarWidth:  "thin",
          scrollbarColor:  `${COLORS.scrollbarThumb} ${COLORS.scrollbarTrack}`,
        }}
      >
        {/* ── Logo row ─────────────────────────────────────────────────────── */}
        <div style={{
          display:       "flex",
          alignItems:    "center",
          justifyContent:"space-between",
          padding:       `0 ${SPACING.base}`,
          height:        LAYOUT.navbarHeight,
          borderBottom:  `1px solid ${COLORS.border}`,
          flexShrink:    0,
        }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm }}>
            <div style={{
              width:           "30px",
              height:          "30px",
              borderRadius:    RADIUS.md,
              backgroundColor: COLORS.primary,
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              flexShrink:      0,
              boxShadow:       `0 0 12px rgba(212,175,55,0.3)`,
            }}>
              <span style={{ color: COLORS.primaryText, fontSize: FONTS.size.md, fontWeight: 700, fontFamily: FONTS.heading }}>T</span>
            </div>
            <span style={{ fontFamily: FONTS.heading, fontSize: FONTS.size.lg, fontWeight: 700, color: COLORS.primary, letterSpacing: "0.05em" }}>
              TIRAS
            </span>
          </div>

          {/* Close on mobile */}
          <button
            onClick={onMobileClose}
            style={{
              display:         "none",
              background:      "none",
              border:          "none",
              cursor:          "pointer",
              color:           COLORS.textMuted,
              padding:         SPACING.xs,
              borderRadius:    RADIUS.base,
            }}
            className="tiras-mobile-close"
            aria-label="Close menu"
          >
            <MdClose size={20} />
          </button>
        </div>

        {/* ── Role badge ───────────────────────────────────────────────────── */}
        <div style={{ padding: `${SPACING.md} ${SPACING.base} ${SPACING.xs}` }}>
          <span style={{
            ...STYLES.badge,
            backgroundColor: roleConf.bg,
            color:           roleConf.color,
          }}>
            {roleConf.label || "User"}
          </span>
        </div>

        {/* ── Nav sections ─────────────────────────────────────────────────── */}
        <nav style={{ flex: 1, paddingBottom: SPACING.base }}>
          {sections.map((section) => (
            <div key={section.label}>
              <div className="tiras-section-label">{section.label}</div>
              {section.items.map((item) => {
                const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`tiras-nav-item${isActive ? " active" : ""}`}
                    onClick={onMobileClose}
                  >
                    <item.icon size={18} style={{ flexShrink: 0 }} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── User footer ──────────────────────────────────────────────────── */}
        {userProfile && (
          <div style={{
            padding:       SPACING.base,
            borderTop:     `1px solid ${COLORS.border}`,
            display:       "flex",
            alignItems:    "center",
            gap:           SPACING.sm,
          }}>
            {/* Avatar */}
            <div style={{
              width:           "34px",
              height:          "34px",
              borderRadius:    RADIUS.full,
              backgroundColor: COLORS.primaryMuted,
              border:          `1px solid ${COLORS.primary}`,
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              flexShrink:      0,
            }}>
              <span style={{ color: COLORS.primary, fontSize: FONTS.size.base, fontWeight: 700 }}>
                {userProfile.displayName?.charAt(0)?.toUpperCase() || "?"}
              </span>
            </div>

            {/* Name */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{
                color:         COLORS.textPrimary,
                fontSize:      FONTS.size.sm,
                fontWeight:    FONTS.weight.semibold,
                whiteSpace:    "nowrap",
                overflow:      "hidden",
                textOverflow:  "ellipsis",
                fontFamily:    FONTS.body,
              }}>
                {userProfile.displayName || "User"}
              </div>
              <div style={{ color: COLORS.textMuted, fontSize: FONTS.size.xs, fontFamily: FONTS.body }}>
                {userProfile.email}
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textMuted, padding: SPACING.xs, borderRadius: RADIUS.base, transition: TRANSITIONS.fast, display: "flex" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.accent; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.textMuted; }}
              title="Log out"
            >
              <MdLogout size={18} />
            </button>
          </div>
        )}
      </aside>

      {/* Inject style to show close button on mobile */}
      <style>{`
        @media (max-width: 768px) {
          .tiras-mobile-close { display: flex !important; }
        }
      `}</style>
    </>
  );
};

export default Sidebar;
