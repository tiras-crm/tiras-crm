// TIRAS CRM — App.jsx
// All 31 routes defined with React Router v6
// Role-based route protection applied via ProtectedRoute

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/Layout/ProtectedRoute";
import Sidebar from "./components/Layout/Sidebar";
import Navbar from "./components/Layout/Navbar";
import { COLORS, LAYOUT, FONTS } from "./theme";

// ─── All 31 Page Imports ────────────────────────────────────────────────────

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

// ─── App Shell Layout ───────────────────────────────────────────────────────
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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Navbar notificationCount={0} />
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0",
          scrollbarWidth: "thin",
          scrollbarColor: `${COLORS.scrollbarThumb} ${COLORS.scrollbarTrack}`,
        }}
      >
        {children}
      </main>
    </div>
  </div>
);

// ─── Root Redirect ──────────────────────────────────────────────────────────
// Sends authenticated users to their role default page

const RootRedirect = () => {
  const { currentUser, loading, getDefaultRoute } = useAuth();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  return <Navigate to={getDefaultRoute()} replace />;
};

// ─── Routes ─────────────────────────────────────────────────────────────────

const AppRoutes = () => (
  <Routes>

    {/* ── Root ─────────────────────────────────────────────────────────────── */}
    <Route path="/" element={<RootRedirect />} />

    {/* ── Public Pages ─────────────────────────────────────────────────────── */}
    <Route path="/home" element={<LandingPage />} />
    <Route path="/pricing" element={<PricingPage />} />

    {/* ── Auth Pages ───────────────────────────────────────────────────────── */}
    <Route path="/login" element={<LoginPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />

    {/* ── Platform Owner Pages (5) ──────────────────────────────────────────
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
        path="/platform/company/:companyId"
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

    {/* ── Company Admin Pages (8) ───────────────────────────────────────────
        Role: company_admin (platform_owner can also access for support)
    ──────────────────────────────────────────────────────────────────────── */}
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

    {/* ── Manager Pages (4) ─────────────────────────────────────────────────
        Role: manager, company_admin, platform_owner
    ──────────────────────────────────────────────────────────────────────── */}
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
      <Route
        path="/manager/followups"
        element={<AppShell><FollowUpCalendar /></AppShell>}
      />
    </Route>

    {/* ── Agent Pages (6) ───────────────────────────────────────────────────
        Role: agent, support_agent (dashboard), manager, company_admin, platform_owner
    ──────────────────────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute allowedRoles={["agent", "support_agent", "manager", "company_admin", "platform_owner"]} />}>
      <Route
        path="/agent/dashboard"
        element={<AppShell><AgentDashboard /></AppShell>}
      />
    </Route>

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
      <Route
        path="/agent/add-lead"
        element={<AppShell><AddEditLead /></AppShell>}
      />
      <Route
        path="/agent/edit-lead/:leadId"
        element={<AppShell><AddEditLead /></AppShell>}
      />
      <Route
        path="/agent/followups"
        element={<AppShell><MyFollowUps /></AppShell>}
      />
    </Route>

    {/* ── Shared Pages (4) — All authenticated roles ────────────────────────
    ──────────────────────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute />}>
      <Route
        path="/notifications"
        element={<AppShell><NotificationsCenter /></AppShell>}
      />
      <Route
        path="/profile"
        element={<AppShell><ProfileSettings /></AppShell>}
      />
      <Route
        path="/tickets/create"
        element={<AppShell><SupportTicketCreateView /></AppShell>}
      />
      <Route
        path="/tickets/view"
        element={<AppShell><SupportTicketCreateView /></AppShell>}
      />
      <Route
        path="/help"
        element={<AppShell><HelpCenter /></AppShell>}
      />
    </Route>

    {/* ── 404 Fallback ─────────────────────────────────────────────────────── */}
    <Route path="*" element={<Navigate to="/" replace />} />

  </Routes>
);

// ─── Root App Component ─────────────────────────────────────────────────────

const App = () => {
  return (
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
};

export default App;
