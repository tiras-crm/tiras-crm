// TIRAS CRM V2 — App.jsx
// All 35 routes (31 original + 4 new V2)
// SmartRoot: LandingPage for guests, role-based redirect for logged-in users
// ProtectedRoute: checks auth + subscription status + role
// AppShell: Sidebar + Navbar with mobile hamburger state

import React, { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Sidebar } from "./components/Layout/Sidebar";
import { Navbar }  from "./components/Layout/Navbar";
import { COLORS, FONTS, LAYOUT } from "./theme";

// ─── All page imports ─────────────────────────────────────────────────────────
import {
  // Auth (2)
  LoginPage,
  ForgotPasswordPage,

  // Platform Owner (5)
  PlatformDashboard,
  CompaniesList,
  CompanyDetailView,
  SubscriptionBillingManager,
  PlatformAnalytics,

  // Company Admin (8)
  AdminDashboard,
  TeamManagement,
  AllLeadsView,
  PipelineKanban,
  CallRecordingsLibrary,
  SupportTicketsOverview,
  ReportsAnalytics,
  CompanySettings,

  // Manager (4)
  ManagerDashboard,
  MyTeamLeads,
  AgentPerformance,
  FollowUpCalendar,

  // Agent (6)
  AgentDashboard,
  MyLeadsList,
  LeadDetailPage,
  ClickToCallInterface,
  AddEditLead,
  MyFollowUps,

  // Shared (4)
  NotificationsCenter,
  ProfileSettings,
  SupportTicketCreateView,
  HelpCenter,

  // Public (2)
  LandingPage,
  PricingPage,

  // V2 New (4)
  RegisterPage,
  SubscribePage,
  WalletPage,
  UsagePage,
} from "./pages/index";

// ─── useNotifications (unread count for Navbar bell) ─────────────────────────
import useNotifications from "./hooks/useNotifications";

// ═══════════════════════════════════════════════════════════════════════════════
// FULL-PAGE LOADING SPINNER
// ═══════════════════════════════════════════════════════════════════════════════

const FullPageSpinner = () => {
  useEffect(() => {
    if (!document.getElementById("tiras-app-spin")) {
      const s = document.createElement("style");
      s.id = "tiras-app-spin";
      s.textContent = `
        @keyframes app-spin   { to { transform: rotate(360deg); } }
        @keyframes app-pulse  { 0%,100%{opacity:1;} 50%{opacity:0.5;} }
      `;
      document.head.appendChild(s);
    }
  }, []);

  return (
    <div style={{
      minHeight:       "100vh",
      backgroundColor: COLORS.background,
      display:         "flex",
      flexDirection:   "column",
      alignItems:      "center",
      justifyContent:  "center",
      gap:             "20px",
      fontFamily:      FONTS.body,
    }}>
      <div style={{
        width:           "52px",
        height:          "52px",
        borderRadius:    "12px",
        backgroundColor: COLORS.primary,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        animation:       "app-pulse 2s ease-in-out infinite",
        boxShadow:       `0 0 24px rgba(212,175,55,0.3)`,
      }}>
        <span style={{ fontFamily: FONTS.heading, fontSize: "22px", fontWeight: 700, color: COLORS.primaryText }}>T</span>
      </div>
      <div style={{
        width:        "32px",
        height:       "32px",
        borderRadius: "50%",
        border:       `3px solid ${COLORS.border}`,
        borderTop:    `3px solid ${COLORS.primary}`,
        animation:    "app-spin 0.75s linear infinite",
      }} />
      <span style={{ fontSize: "12px", color: COLORS.textMuted }}>Loading TIRAS…</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 403 FORBIDDEN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

const ForbiddenScreen = () => {
  const navigate = useNavigate();
  const { getDefaultRoute } = useAuth();

  return (
    <div style={{
      minHeight:       "calc(100vh - 56px)",
      backgroundColor: COLORS.background,
      display:         "flex",
      flexDirection:   "column",
      alignItems:      "center",
      justifyContent:  "center",
      gap:             "16px",
      padding:         "24px",
      fontFamily:      FONTS.body,
    }}>
      <div style={{ fontFamily: FONTS.heading, fontSize: "64px", fontWeight: 700, color: COLORS.accent, lineHeight: 1 }}>403</div>
      <div style={{ fontFamily: FONTS.heading, fontSize: "20px", fontWeight: 700, color: COLORS.textPrimary }}>Access Denied</div>
      <div style={{ fontSize: "14px", color: COLORS.textSecondary, textAlign: "center", maxWidth: "360px", lineHeight: 1.6 }}>
        You don't have permission to view this page.
      </div>
      <button
        onClick={() => navigate(getDefaultRoute())}
        style={{
          backgroundColor: COLORS.primary,
          color:           COLORS.primaryText,
          border:          "none",
          borderRadius:    "8px",
          fontFamily:      FONTS.body,
          fontSize:        "14px",
          fontWeight:      700,
          padding:         "10px 24px",
          cursor:          "pointer",
          marginTop:       "8px",
        }}
      >
        Go to Dashboard
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// APP SHELL — Sidebar + Navbar + main content
// Manages mobile hamburger state
// ═══════════════════════════════════════════════════════════════════════════════

const AppShell = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadCount }             = useNotifications();

  // Close sidebar on route change (mobile)
  const location = useLocation();
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <div style={{
      display:        "flex",
      minHeight:      "100vh",
      backgroundColor: COLORS.background,
      fontFamily:      FONTS.body,
    }}>
      {/* Sidebar — sticky desktop, overlay mobile */}
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main content column */}
      <div style={{
        flex:           1,
        display:        "flex",
        flexDirection:  "column",
        minWidth:       0,          // Prevents flex overflow
        overflowX:      "hidden",   // No horizontal scroll — master doc rule
      }}>
        <Navbar
          notificationCount={unreadCount}
          onHamburgerClick={() => setMobileOpen(true)}
        />
        <main style={{
          flex:           1,
          overflowY:      "auto",
          overflowX:      "hidden",
          scrollbarWidth: "thin",
          scrollbarColor: `${COLORS.scrollbarThumb || "#2A2A2B"} ${COLORS.scrollbarTrack || "#1A1A1B"}`,
        }}>
          {children}
        </main>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED ROUTE
// Checks 3 things in order:
//   1. Auth — is user logged in?
//   2. Subscription — is subscription active? (trial not expired, not suspended)
//   3. Role — does this user have the required role?
//
// Platform Owner bypasses subscription checks
// /subscribe is always accessible to authenticated users regardless of status
// ═══════════════════════════════════════════════════════════════════════════════

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const {
    currentUser,
    role,
    authLoading,
    companyLoading,
    isSubscriptionActive,
    isPlatformOwner,
  } = useAuth();
  const location = useLocation();

  // Still resolving Firebase auth state
  if (authLoading || companyLoading) return <FullPageSpinner />;

  // 1. Not logged in → login
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Subscription check — platform owner is exempt
  // /subscribe itself must not redirect (would create infinite loop)
  if (
    !isPlatformOwner &&
    !isSubscriptionActive &&
    location.pathname !== "/subscribe"
  ) {
    return <Navigate to="/subscribe" replace />;
  }

  // 3. Role check — if allowedRoles provided, user must have one of them
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return (
      <AppShell>
        <ForbiddenScreen />
      </AppShell>
    );
  }

  // All checks passed — render child routes
  return <Outlet />;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SMART ROOT
// / → LandingPage for unauthenticated visitors
// / → Role-based dashboard redirect for logged-in users
// ═══════════════════════════════════════════════════════════════════════════════

const SmartRoot = () => {
  const { currentUser, authLoading, getDefaultRoute } = useAuth();

  if (authLoading) return <FullPageSpinner />;
  if (!currentUser) return <LandingPage />;
  return <Navigate to={getDefaultRoute()} replace />;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

const AppRoutes = () => (
  <Routes>

    {/* ── Smart root ────────────────────────────────────────────────────────── */}
    <Route path="/" element={<SmartRoot />} />

    {/* ── Public pages — no auth needed ────────────────────────────────────── */}
    <Route path="/home"           element={<LandingPage />} />
    <Route path="/pricing"        element={<PricingPage />} />
    <Route path="/register"       element={<RegisterPage />} />

    {/* Auth pages */}
    <Route path="/login"          element={<LoginPage />} />
    <Route path="/forgot-password"element={<ForgotPasswordPage />} />

    {/* Subscribe — accessible to authenticated users regardless of subscription */}
    {/* No ProtectedRoute wrapper — ProtectedRoute itself redirects here */}
    <Route path="/subscribe"      element={<SubscribePage />} />

    {/* ── Platform Owner — all companies, no subscription filter ────────────
        Role: platform_owner only
    ──────────────────────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute allowedRoles={["platform_owner"]} />}>
      <Route
        path="/platform/dashboard"
        element={<AppShell><PlatformDashboard /></AppShell>}
      />
      <Route
        path="/platform/companies"
        element={<AppShell><CompaniesList /></AppShell>}
      />
      <Route
        path="/platform/companies/:companyId"
        element={<AppShell><CompanyDetailView /></AppShell>}
      />
      <Route
        path="/platform/billing"
        element={<AppShell><SubscriptionBillingManager /></AppShell>}
      />
      <Route
        path="/platform/analytics"
        element={<AppShell><PlatformAnalytics /></AppShell>}
      />
      <Route 
        path="/platform/announcements" 
        element={<ProtectedRoute roles={["platform_owner"]}><AnnouncementsManager /></ProtectedRoute>} />
    </Route>

    {/* ── Company Admin — own company only ──────────────────────────────────
        Role: company_admin (platform_owner also allowed for support access)
    ──────────────────────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute allowedRoles={["company_admin", "platform_owner"]} />}>
      <Route path="/admin/dashboard"  element={<AppShell><AdminDashboard /></AppShell>} />
      <Route path="/admin/team"       element={<AppShell><TeamManagement /></AppShell>} />
      <Route path="/admin/leads"      element={<AppShell><AllLeadsView /></AppShell>} />
      <Route path="/admin/pipeline"   element={<AppShell><PipelineKanban /></AppShell>} />
      <Route path="/admin/recordings" element={<AppShell><CallRecordingsLibrary /></AppShell>} />
      <Route path="/admin/tickets"    element={<AppShell><SupportTicketsOverview /></AppShell>} />
      <Route path="/admin/reports"    element={<AppShell><ReportsAnalytics /></AppShell>} />
      <Route path="/admin/settings"   element={<AppShell><CompanySettings /></AppShell>} />

      {/* V2 new pages — admin only */}
      <Route path="/admin/wallet"     element={<AppShell><WalletPage /></AppShell>} />
    </Route>

    {/* Usage — admin + manager can both see it */}
    <Route element={<ProtectedRoute allowedRoles={["company_admin", "manager", "platform_owner"]} />}>
      <Route path="/admin/usage" element={<AppShell><UsagePage /></AppShell>} />
    </Route>

    {/* ── Manager ───────────────────────────────────────────────────────────
        Role: manager, company_admin, platform_owner
    ──────────────────────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute allowedRoles={["manager", "company_admin", "platform_owner"]} />}>
      <Route path="/manager/dashboard"   element={<AppShell><ManagerDashboard /></AppShell>} />
      <Route path="/manager/leads"       element={<AppShell><MyTeamLeads /></AppShell>} />
      <Route path="/manager/performance" element={<AppShell><AgentPerformance /></AppShell>} />
      <Route path="/manager/calendar"    element={<AppShell><FollowUpCalendar /></AppShell>} />
    </Route>

    {/* ── Agent ─────────────────────────────────────────────────────────────
        Role: agent, manager, company_admin, platform_owner
        (managers and admins can also view agent pages for support)
    ──────────────────────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute allowedRoles={["agent", "support_agent", "manager", "company_admin", "platform_owner"]} />}>
      <Route path="/agent/dashboard"  element={<AppShell><AgentDashboard /></AppShell>} />
    </Route>

    <Route element={<ProtectedRoute allowedRoles={["agent", "manager", "company_admin", "platform_owner"]} />}>
      <Route path="/agent/leads"            element={<AppShell><MyLeadsList /></AppShell>} />
      <Route path="/agent/lead/new"         element={<AppShell><AddEditLead /></AppShell>} />
      <Route path="/agent/lead/edit/:leadId"element={<AppShell><AddEditLead /></AppShell>} />
      <Route path="/agent/lead/:leadId"     element={<AppShell><LeadDetailPage /></AppShell>} />
      <Route path="/agent/call"             element={<AppShell><ClickToCallInterface /></AppShell>} />
      <Route path="/agent/followups"        element={<AppShell><MyFollowUps /></AppShell>} />
    </Route>

    {/* ── Shared pages — all authenticated roles ────────────────────────────
    ──────────────────────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute />}>
      <Route path="/notifications" element={<AppShell><NotificationsCenter /></AppShell>} />
      <Route path="/profile"       element={<AppShell><ProfileSettings /></AppShell>} />
      <Route path="/tickets"       element={<AppShell><SupportTicketCreateView /></AppShell>} />
      <Route path="/help"          element={<AppShell><HelpCenter /></AppShell>} />
    </Route>

    {/* ── 404 fallback ──────────────────────────────────────────────────────── */}
    <Route path="*" element={<Navigate to="/" replace />} />

  </Routes>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <div style={{
        margin:          0,
        padding:         0,
        backgroundColor: COLORS.background,
        minHeight:       "100vh",
        fontFamily:      FONTS.body,
        color:           COLORS.textPrimary,
        WebkitFontSmoothing:  "antialiased",
        MozOsxFontSmoothing:  "grayscale",
        overflowX:       "hidden",   // No horizontal scroll anywhere — master doc rule
      }}>
        <AppRoutes />
      </div>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
