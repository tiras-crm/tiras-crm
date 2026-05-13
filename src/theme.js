// TIRAS CRM — Theme Configuration
// Carbon Copper color system — locked, do not modify without updating master document

export const COLORS = {
  // Core backgrounds
  background: "#121212",
  surface: "#1E1E1E",
  surfaceHover: "#2A2A2A",
  surfaceActive: "#333333",
  border: "#2E2E2E",

  // Brand colors
  primary: "#B65E3C",
  primaryHover: "#CE6E49",
  primaryDark: "#8F4A2E",
  primaryMuted: "#B65E3C26",

  accent: "#F2A65A",
  accentHover: "#F5B870",
  accentMuted: "#F2A65A26",

  // Text
  textPrimary: "#F5F5F5",
  textSecondary: "#AAAAAA",
  textMuted: "#666666",
  textInverse: "#121212",

  // Status colors
  success: "#4CAF82",
  successMuted: "#4CAF8226",
  warning: "#F2A65A",
  warningMuted: "#F2A65A26",
  danger: "#E05252",
  dangerMuted: "#E0525226",
  info: "#5A9BF2",
  infoMuted: "#5A9BF226",

  // Lead temperature colors
  hot: "#E05252",
  warm: "#F2A65A",
  cold: "#5A9BF2",
  dead: "#666666",

  // Sidebar
  sidebarBg: "#0E0E0E",
  sidebarActive: "#B65E3C1A",
  sidebarActiveBorder: "#B65E3C",

  // Inputs
  inputBg: "#1E1E1E",
  inputBorder: "#2E2E2E",
  inputFocus: "#B65E3C",
  inputError: "#E05252",

  // Scrollbar
  scrollbarThumb: "#333333",
  scrollbarTrack: "#1A1A1A",
};

export const FONTS = {
  family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",

  size: {
    xs: "11px",
    sm: "12px",
    base: "14px",
    md: "15px",
    lg: "16px",
    xl: "18px",
    "2xl": "20px",
    "3xl": "24px",
    "4xl": "28px",
    "5xl": "32px",
  },

  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const SPACING = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  base: "16px",
  lg: "20px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "40px",
  "4xl": "48px",
  "5xl": "64px",
};

export const RADIUS = {
  sm: "4px",
  base: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
};

export const SHADOWS = {
  sm: "0 1px 3px rgba(0, 0, 0, 0.4)",
  base: "0 2px 8px rgba(0, 0, 0, 0.5)",
  md: "0 4px 16px rgba(0, 0, 0, 0.6)",
  lg: "0 8px 32px rgba(0, 0, 0, 0.7)",
  primary: "0 4px 16px rgba(182, 94, 60, 0.3)",
  accent: "0 4px 16px rgba(242, 166, 90, 0.25)",
};

export const TRANSITIONS = {
  fast: "all 0.1s ease",
  base: "all 0.2s ease",
  slow: "all 0.3s ease",
};

export const BREAKPOINTS = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
};

export const LAYOUT = {
  sidebarWidth: "240px",
  sidebarCollapsedWidth: "64px",
  navbarHeight: "60px",
  maxContentWidth: "1400px",
};

export const STYLES = {
  card: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    boxShadow: SHADOWS.sm,
  },

  input: {
    backgroundColor: COLORS.inputBg,
    border: `1px solid ${COLORS.inputBorder}`,
    borderRadius: RADIUS.base,
    color: COLORS.textPrimary,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    padding: `${SPACING.sm} ${SPACING.md}`,
    outline: "none",
    width: "100%",
    transition: TRANSITIONS.fast,
  },

  buttonPrimary: {
    backgroundColor: COLORS.primary,
    color: COLORS.textInverse,
    border: "none",
    borderRadius: RADIUS.base,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.semibold,
    padding: `${SPACING.sm} ${SPACING.xl}`,
    cursor: "pointer",
    transition: TRANSITIONS.base,
    boxShadow: SHADOWS.primary,
  },

  buttonSecondary: {
    backgroundColor: "transparent",
    color: COLORS.textPrimary,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.base,
    fontFamily: FONTS.family,
    fontSize: FONTS.size.base,
    fontWeight: FONTS.weight.medium,
    padding: `${SPACING.sm} ${SPACING.xl}`,
    cursor: "pointer",
    transition: TRANSITIONS.base,
  },

  badge: {
    borderRadius: RADIUS.full,
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    padding: `2px ${SPACING.sm}`,
    display: "inline-flex",
    alignItems: "center",
    gap: SPACING.xs,
  },

  tableHeader: {
    backgroundColor: COLORS.surfaceActive,
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: `${SPACING.sm} ${SPACING.base}`,
  },

  scrollbar: {
    scrollbarWidth: "thin",
    scrollbarColor: `${COLORS.scrollbarThumb} ${COLORS.scrollbarTrack}`,
  },
};

export const ROLE_CONFIG = {
  platform_owner: {
    label: "Platform Owner",
    color: COLORS.accent,
    bg: COLORS.accentMuted,
  },
  company_admin: {
    label: "Company Admin",
    color: COLORS.primary,
    bg: COLORS.primaryMuted,
  },
  manager: {
    label: "Manager",
    color: COLORS.info,
    bg: COLORS.infoMuted,
  },
  agent: {
    label: "Agent",
    color: COLORS.success,
    bg: COLORS.successMuted,
  },
  support_agent: {
    label: "Support Agent",
    color: COLORS.textSecondary,
    bg: COLORS.surfaceActive,
  },
};
