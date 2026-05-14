// TIRAS CRM — App.jsx
// All 31 routes defined with React Router v6
// Role-based route protection via ProtectedRoute
//
// FIXES APPLIED (v1.1):
//  1. / → SmartRoot (LandingPage if not logged in, dashboard if logged in)
//  2. /platform/company/:companyId → /platform/companies/:companyId  (added 's')
//  3. /manager/followups → /manager/calendar
//  4. /agent/add-lead → /agent/lead/new
//  5. /agent/edit-lead/:leadId → /agent/lead/edit/:leadId
//  6. /tickets/create + /tickets/view → /tickets  (merged to single route)
//  7. /home removed (LandingPage now lives at /)

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/Layout/ProtectedRoute";
import Sidebar from "./components/Layout/Sidebar";
import Navbar from "./components/Layout/Navbar";
import { COLORS, FONTS } from "./theme";

// ─── All 31 Page Imports ─────────────────────────────────────────────────────

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
} from "./pages/index";

// ─── App Shell ───────────────────────────────────────────────────────────────
// Wraps all authenticated pages with Sidebar + Navbar

const AppShell = ({ children }) => (
  <div
    style={{
      display: "flex",
      minHeight: "100vh",
      backgroundColor: COLORS.background,
      fontFamily: FONTS.family,
    }}
  >
    <Sidebar />
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        // Sidebar is 240px wide — main content fills the rest
        minWidth: 0,
      }}
    >
      <Navbar notificationCount={0} />
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: `${COLORS.scrollbarThumb} ${COLORS.scrollbarTrack}`,
        }}
      >
        {children}
      </main>
    </div>
  </div>
);

// ─── Smart Root ───────────────────────────────────────────────────────────────
// FIX #1 & #2: / shows LandingPage to guests, redirects logged-in users to their dashboard
// This replaces the old RootRedirect + /home pattern

const SmartRoot = () => {
  const { currentUser, loading, getDefaultRoute } = useAuth();

  // Wait for Firebase auth to resolve before deciding
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: COLORS.background,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Minimal loading state — no spinner library needed */}
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: `3px solid ${COLORS.border}`,
            borderTopColor: COLORS.primary,
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Logged-in user: send to role-specific dashboard
  if (currentUser) {
    return <Navigate to={getDefaultRoute()} replace />;
  }

  // Guest user: show public landing page
  return <LandingPage />;
};

// ─── App Routes ───────────────────────────────────────────────────────────────

const AppRoutes = () => (
  <Routes>

    {/* ── Root — Smart: LandingPage for guests, dashboard redirect for logged-in ── */}
    {/* FIX: Was <RootRedirect /> which always redirected; LandingPage was on /home */}
    <Route path="/" element={<SmartRoot />} />

    {/* ── Public Pages (2) ─────────────────────────────────────────────────── */}
    {/* /pricing is always public — no auth check */}
    <Route path="/pricing" element={<PricingPage />} />

    {/* ── Auth Pages (2) ───────────────────────────────────────────────────── */}
    <Route path="/login"           element={<LoginPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />

    {/* ── Platform Owner Pages (5) ─────────────────────────────────────────
        Role: platform_owner only
        Tony is the only platform_owner — account created manually in Firebase
    ─────────────────────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute allowedRoles={["platform_owner"]} />}>

      <Route
        path="/platform/dashboard"
        element={<AppShell><PlatformDashboard /></AppShell>}
      />
      <Route
        path="/platform/companies"
        element={<AppShell><CompaniesList /></AppShell>}
      />
      {/* FIX: Was /platform/company/:companyId — missing 's' in companies */}
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

    </Route>

    {/* ── Company Admin Pages (8) ──────────────────────────────────────────
        Role: company_admin
        platform_owner also included — lets Tony support any company
    ─────────────────────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute allowedRoles={["company_admin", "platform_owner"]} />}>

      <Route
        path="/admin/dashboard"
        element={<AppShell><AdminDashboard /></AppShell>}
      />
      <Route
        path="/admin/team"
        element={<AppShell><TeamManagement /></AppShell>}
      />
      <Route
        path="/admin/leads"
        element={<AppShell><AllLeadsView /></AppShell>}
      />
      <Route
        path="/admin/pipeline"
        element={<AppShell><PipelineKanban /></AppShell>}
      />
      <Route
        path="/admin/recordings"
        element={<AppShell><CallRecordingsLibrary /></AppShell>}
      />
      <Route
        path="/admin/tickets"
        element={<AppShell><SupportTicketsOverview /></AppShell>}
      />
      <Route
        path="/admin/reports"
        element={<AppShell><ReportsAnalytics /></AppShell>}
      />
      <Route
        path="/admin/settings"
        element={<AppShell><CompanySettings /></AppShell>}
      />

    </Route>

    {/* ── Manager Pages (4) ────────────────────────────────────────────────
        Role: manager
        company_admin and platform_owner included for oversight
    ─────────────────────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute allowedRoles={["manager", "company_admin", "platform_owner"]} />}>

      <Route
        path="/manager/dashboard"
        element={<AppShell><ManagerDashboard /></AppShell>}
      />
      <Route
        path="/manager/leads"
        element={<AppShell><MyTeamLeads /></AppShell>}
      />
      <Route
        path="/manager/performance"
        element={<AppShell><AgentPerformance /></AppShell>}
      />
      {/* FIX: Was /manager/followups — correct path is /manager/calendar */}
      <Route
        path="/manager/calendar"
        element={<AppShell><FollowUpCalendar /></AppShell>}
      />

    </Route>

    {/* ── Agent Pages (6) ──────────────────────────────────────────────────
        Dashboard also accessible by support_agent
        All other agent routes: agent + higher roles
    ─────────────────────────────────────────────────────────────────────── */}

    {/* Agent dashboard — support_agent can also see their version */}
    <Route element={<ProtectedRoute allowedRoles={["agent", "support_agent", "manager", "company_admin", "platform_owner"]} />}>
      <Route
        path="/agent/dashboard"
        element={<AppShell><AgentDashboard /></AppShell>}
      />
    </Route>

    {/* Lead management routes — agent and above (not support_agent) */}
    <Route element={<ProtectedRoute allowedRoles={["agent", "manager", "company_admin", "platform_owner"]} />}>

      <Route
        path="/agent/leads"
        element={<AppShell><MyLeadsList /></AppShell>}
      />
      <Route
        path="/agent/lead/:leadId"
        element={<AppShell><LeadDetailPage /></AppShell>}
      />
      <Route
        path="/agent/call"
        element={<AppShell><ClickToCallInterface /></AppShell>}
      />
      {/* FIX: Was /agent/add-lead — correct path is /agent/lead/new */}
      <Route
        path="/agent/lead/new"
        element={<AppShell><AddEditLead /></AppShell>}
      />
      {/* FIX: Was /agent/edit-lead/:leadId — correct path is /agent/lead/edit/:leadId */}
      <Route
        path="/agent/lead/edit/:leadId"
        element={<AppShell><AddEditLead /></AppShell>}
      />
      <Route
        path="/agent/followups"
        element={<AppShell><MyFollowUps /></AppShell>}
      />

    </Route>

    {/* ── Shared Pages (4) — All authenticated roles ────────────────────────
        ProtectedRoute with no allowedRoles = any logged-in user
    ─────────────────────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute />}>

      <Route
        path="/notifications"
        element={<AppShell><NotificationsCenter /></AppShell>}
      />
      <Route
        path="/profile"
        element={<AppShell><ProfileSettings /></AppShell>}
      />
      {/* FIX: Was split into /tickets/create + /tickets/view — merged to /tickets */}
      <Route
        path="/tickets"
        element={<AppShell><SupportTicketCreateView /></AppShell>}
      />
      <Route
        path="/help"
        element={<AppShell><HelpCenter /></AppShell>}
      />

    </Route>

    {/* ── 404 Fallback ─────────────────────────────────────────────────────
        Any unknown route goes back to root (SmartRoot handles from there)
    ─────────────────────────────────────────────────────────────────────── */}
    <Route path="*" element={<Navigate to="/" replace />} />

  </Routes>
);

// ─── Root App ────────────────────────────────────────────────────────────────

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <div
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: COLORS.background,
          minHeight: "100vh",
          fontFamily: FONTS.family,
          color: COLORS.textPrimary,
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        }}
      >
        <AppRoutes />
      </div>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
