// TIRAS CRM — Protected Route
// Wraps private routes — redirects to /login if user is not authenticated
// Also supports role-based access restriction — shows 403 if wrong role

import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS, STYLES } from "../../theme";

// ─── Full-screen loading spinner ────────────────────────────────────────────

const LoadingScreen = () => (
  <div
    style={{
      minHeight: "100vh",
      backgroundColor: COLORS.background,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: SPACING.lg,
    }}
  >
    {/* TIRAS logo mark */}
    <div
      style={{
        width: "48px",
        height: "48px",
        borderRadius: RADIUS.lg,
        backgroundColor: COLORS.primary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          color: COLORS.textInverse,
          fontSize: FONTS.size["2xl"],
          fontWeight: FONTS.weight.bold,
          letterSpacing: "0.05em",
        }}
      >
        T
      </span>
    </div>

    {/* Spinner ring */}
    <div
      style={{
        width: "32px",
        height: "32px",
        border: `3px solid ${COLORS.border}`,
        borderTop: `3px solid ${COLORS.primary}`,
        borderRadius: "50%",
        animation: "tiras-spin 0.8s linear infinite",
      }}
    />

    <style>{`
      @keyframes tiras-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>

    <span style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm }}>
      Loading TIRAS...
    </span>
  </div>
);

// ─── 403 Forbidden screen ───────────────────────────────────────────────────

const ForbiddenScreen = ({ allowedRoles }) => (
  <div
    style={{
      minHeight: "100vh",
      backgroundColor: COLORS.background,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: SPACING.xl,
    }}
  >
    <div
      style={{
        ...STYLES.card,
        textAlign: "center",
        maxWidth: "420px",
        width: "100%",
      }}
    >
      <div
        style={{
          fontSize: FONTS.size["5xl"],
          fontWeight: FONTS.weight.bold,
          color: COLORS.danger,
          marginBottom: SPACING.sm,
        }}
      >
        403
      </div>
      <div
        style={{
          fontSize: FONTS.size.xl,
          fontWeight: FONTS.weight.semibold,
          color: COLORS.textPrimary,
          marginBottom: SPACING.sm,
        }}
      >
        Access Denied
      </div>
      <div
        style={{
          fontSize: FONTS.size.base,
          color: COLORS.textSecondary,
          marginBottom: SPACING.xl,
          lineHeight: 1.6,
        }}
      >
        You don't have permission to view this page.
        {allowedRoles && (
          <span> This area is restricted to: <strong style={{ color: COLORS.accent }}>{allowedRoles.join(", ")}</strong>.</span>
        )}
      </div>
      <button
        onClick={() => window.history.back()}
        style={{
          ...STYLES.buttonPrimary,
          display: "inline-block",
        }}
      >
        Go Back
      </button>
    </div>
  </div>
);

// ─── ProtectedRoute ─────────────────────────────────────────────────────────
//
// Usage in App.jsx:
//
//   <Route element={<ProtectedRoute />}>
//     <Route path="/agent/dashboard" element={<AgentDashboard />} />
//   </Route>
//
//   <Route element={<ProtectedRoute allowedRoles={["company_admin", "platform_owner"]} />}>
//     <Route path="/admin/dashboard" element={<AdminDashboard />} />
//   </Route>
//
// Props:
//   allowedRoles — optional array of role strings
//                  if omitted, any authenticated user can access
//                  if provided, only those roles can access

const ProtectedRoute = ({ allowedRoles }) => {
  const { currentUser, role, loading } = useAuth();
  const location = useLocation();

  // Show spinner while Firebase resolves auth state
  if (loading) {
    return <LoadingScreen />;
  }

  // Not logged in — send to login page, preserve intended destination
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role restriction check
  if (allowedRoles && allowedRoles.length > 0) {
    if (!role || !allowedRoles.includes(role)) {
      return <ForbiddenScreen allowedRoles={allowedRoles} />;
    }
  }

  // Auth passed — render child routes via Outlet
  return <Outlet />;
};

export default ProtectedRoute;
