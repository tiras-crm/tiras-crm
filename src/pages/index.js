// TIRAS CRM — pages/index.js
// Blank placeholder exports for all 31 pages
// App.jsx imports from here — replace each placeholder with the real page component as you build

import React from "react";
import { COLORS, FONTS, SPACING, RADIUS, STYLES } from "../theme";

// ─── Shared Placeholder Component ───────────────────────────────────────────
// Each page renders this until the real component is built
// Shows page name so you know which placeholder you're on

const Placeholder = ({ name }) => (
  <div
    style={{
      minHeight: "calc(100vh - 60px)",
      backgroundColor: COLORS.background,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.base,
      padding: SPACING.xl,
    }}
  >
    <div
      style={{
        ...STYLES.card,
        textAlign: "center",
        maxWidth: "480px",
        width: "100%",
      }}
    >
      {/* TIRAS logomark */}
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: RADIUS.lg,
          backgroundColor: COLORS.primaryMuted,
          border: `1px solid ${COLORS.primary}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: `0 auto ${SPACING.base}`,
        }}
      >
        <span
          style={{
            color: COLORS.primary,
            fontSize: FONTS.size["2xl"],
            fontWeight: FONTS.weight.bold,
          }}
        >
          T
        </span>
      </div>

      <div
        style={{
          fontSize: FONTS.size.xs,
          fontWeight: FONTS.weight.semibold,
          color: COLORS.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: SPACING.xs,
        }}
      >
        Page Placeholder
      </div>

      <div
        style={{
          fontSize: FONTS.size["2xl"],
          fontWeight: FONTS.weight.bold,
          color: COLORS.textPrimary,
          marginBottom: SPACING.sm,
        }}
      >
        {name}
      </div>

      <div
        style={{
          fontSize: FONTS.size.base,
          color: COLORS.textSecondary,
          lineHeight: 1.6,
        }}
      >
        This page is part of the TIRAS build plan.
        Build it in Week {getWeek(name)} according to the 8-week schedule.
      </div>

      <div
        style={{
          marginTop: SPACING.lg,
          padding: SPACING.md,
          backgroundColor: COLORS.accentMuted,
          borderRadius: RADIUS.base,
          border: `1px solid ${COLORS.accent}26`,
        }}
      >
        <span style={{ color: COLORS.accent, fontSize: FONTS.size.sm }}>
          ✦ Foundation skeleton is live. Replace this placeholder to continue.
        </span>
      </div>
    </div>
  </div>
);

// Week hint for placeholder context
const getWeek = (name) => {
  const weekMap = {
    "Login": 1, "Forgot Password": 1,
    "My Leads List": 2, "All Leads View": 2, "Add / Edit Lead": 2, "Lead Detail": 2,
    "Pipeline Kanban": 3,
    "Click to Call": 4, "Call Recordings Library": 4,
    "Agent Dashboard": 5, "My Follow-ups": 5, "Follow-up Calendar": 5,
    "Support Tickets": 6, "Support Ticket Create": 6, "Company Settings": 6,
    "God View Dashboard": 7, "Manager Dashboard": 7, "Team Management": 7,
    "Agent Performance": 7, "Reports & Analytics": 7,
    "Platform Dashboard": 7, "Companies List": 7, "Company Detail": 7,
    "Subscription & Billing": 7, "Platform Analytics": 7,
    "Notifications": 7, "Profile Settings": 7, "Help Center": 7,
    "Landing Page": 8, "Pricing Page": 8,
  };
  for (const [key, week] of Object.entries(weekMap)) {
    if (name.includes(key)) return week;
  }
  return "?";
};

export { LoginPage } from "./LoginPage";
export { ForgotPasswordPage } from "./ForgotPasswordPage";
export { RegisterPage } from "./RegisterPage";
export { SubscribePage } from "./SubscribePage";
export { WalletPage } from "./WalletPage";
export { UsagePage } from "./UsagePage";
export { PlatformDashboard } from "./PlatformDashboard";
export { CompaniesList } from "./CompaniesList";
export { CompanyDetailView } from "./CompanyDetailView";
export { SubscriptionBillingManager } from "./SubscriptionBillingManager";
export { PlatformAnalytics } from "./PlatformAnalytics";
export { AdminDashboard } from "./AdminDashboard";
export { TeamManagement } from "./TeamManagement";
export { AllLeadsView } from "./AllLeadsView";
export { PipelineKanban } from "./PipelineKanban";
export { CallRecordingsLibrary } from "./CallRecordingsLibrary";
export { SupportTicketsOverview } from "./SupportTicketsOverview";
export { ReportsAnalytics } from "./ReportsAnalytics";
export { CompanySettings } from "./CompanySettings";
export { ManagerDashboard } from "./ManagerDashboard";
export { MyTeamLeads } from "./MyTeamLeads";
export { AgentPerformance } from "./AgentPerformance";
export { FollowUpCalendar } from "./FollowUpCalendar";
export { AgentDashboard } from "./AgentDashboard";
export { MyLeadsList } from "./MyLeadsList";
export { LeadDetailPage } from "./LeadDetailPage";
export { ClickToCallInterface } from "./ClickToCallInterface";
export { AddEditLead } from "./AddEditLead";
export { MyFollowUps } from "./MyFollowUps";
export { NotificationsCenter } from "./NotificationsCenter";
export { ProfileSettings } from "./ProfileSettings";
export { SupportTicketCreateView } from "./SupportTicketCreateView";
export { HelpCenter } from "./HelpCenter";
export { LandingPage } from "./LandingPage";
export { PricingPage } from "./PricingPage";
