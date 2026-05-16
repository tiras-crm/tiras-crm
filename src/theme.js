// TIRAS CRM V2 — Theme Configuration
// Design System: Obsidian Gold
// Fonts: Playfair Display (headings) + DM Sans (body) — loaded in public/index.html
// ALL decisions locked — do not modify without Tony's approval

export const COLORS = {
  // ── Core backgrounds ────────────────────────────────────────────────────────
  background:    "#121212",       // Main app background — all pages
  surface:       "#1A1A1B",       // Cards, sidebar, modals, navbar
  surfaceHover:  "#222223",       // Hovered cards and rows
  surfaceActive: "#2A2A2B",       // Active / selected items
  border:        "#2A2A2B",       // All card borders and dividers

  // ── Gold — Primary brand color ───────────────────────────────────────────────
  primary:       "#D4AF37",       // Buttons, highlights, active nav, headings
  primaryHover:  "#E2C04A",       // Primary hover — brighter gold
  primaryDark:   "#B8962E",       // Primary pressed — darker gold
  primaryMuted:  "rgba(212,175,55,0.12)",  // Gold backgrounds, badges, chips
  primaryText:   "#000000",       // Text ON gold buttons — always black

  // ── Red — Accent / Alert color ───────────────────────────────────────────────
  accent:        "#E63946",       // Alerts, hot leads, urgent, errors
  accentHover:   "#F04550",       // Accent hover
  accentMuted:   "rgba(230,57,70,0.12)",   // Red backgrounds

  // ── Status colors ───────────────────────────────────────────────────────────
  success:       "#10B981",       // Closed won, active, positive
  successMuted:  "rgba(16,185,129,0.12)",
  warning:       "#F59E0B",       // Warm leads, follow-up stage, caution
  warningMuted:  "rgba(245,158,11,0.12)",
  danger:        "#E63946",       // Errors, destructive actions — same as accent
  dangerMuted:   "rgba(230,57,70,0.12)",
  info:          "#3B82F6",       // Info, contacted stage
  infoMuted:     "rgba(59,130,246,0.12)",
  purple:        "#8B5CF6",       // Negotiation stage, special badges
  purpleMuted:   "rgba(139,92,246,0.12)",

  // ── Text ────────────────────────────────────────────────────────────────────
  textPrimary:   "#F5F5F5",       // Main readable text
  textSecondary: "#9A9A9A",       // Labels, metadata, subtitles
  textMuted:     "#555555",       // Placeholders, disabled states
  textInverse:   "#000000",       // Text on gold / light backgrounds

  // ── Lead temperature ─────────────────────────────────────────────────────────
  hot:           "#E63946",       // 🔥 Hot
  warm:          "#F59E0B",       // ☀️ Warm
  cold:          "#3B82F6",       // ❄️ Cold
  dead:          "#6B7280",       // 💀 Dead

  // ── Scrollbar ───────────────────────────────────────────────────────────────
  scrollbarThumb: "#2A2A2B",
  scrollbarTrack: "#1A1A1B",
};

// ── Pipeline stage colors (locked in master doc) ─────────────────────────────
export const STAGE_COLORS = {
  "New":         { color: "#6B7280", bg: "rgba(107,114,128,0.12)" },
  "Contacted":   { color: "#3B82F6", bg: "rgba(59,130,246,0.12)"  },
  "Interested":  { color: "#F59E0B", bg: "rgba(245,158,11,0.12)"  },
  "Follow-up":   { color: "#F97316", bg: "rgba(249,115,22,0.12)"  },
  "Negotiation": { color: "#8B5CF6", bg: "rgba(139,92,246,0.12)"  },
  "Closed Won":  { color: "#10B981", bg: "rgba(16,185,129,0.12)"  },
  "Closed Lost": { color: "#EF4444", bg: "rgba(239,68,68,0.12)"   },
};

// ── Temperature config ────────────────────────────────────────────────────────
export const TEMP_CONFIG = {
  Hot:  { color: "#E63946", bg: "rgba(230,57,70,0.12)",   icon: "🔥" },
  Warm: { color: "#F59E0B", bg: "rgba(245,158,11,0.12)",  icon: "☀️" },
  Cold: { color: "#3B82F6", bg: "rgba(59,130,246,0.12)",  icon: "❄️" },
  Dead: { color: "#6B7280", bg: "rgba(107,114,128,0.12)", icon: "💀" },
};

// ── Typography ────────────────────────────────────────────────────────────────
export const FONTS = {
  heading: "'Playfair Display', Georgia, serif",   // All headings — loaded from Google Fonts
  body:    "'DM Sans', system-ui, sans-serif",      // All body text — loaded from Google Fonts
  mono:    "'JetBrains Mono', 'Courier New', monospace", // Amounts, IDs

  size: {
    xs:   "11px",
    sm:   "12px",
    base: "14px",
    md:   "15px",
    lg:   "16px",
    xl:   "18px",
    "2xl":"20px",
    "3xl":"24px",
    "4xl":"28px",
    "5xl":"32px",
  },

  weight: {
    regular:  400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },
};

// ── Typography element presets (master doc Section 2) ─────────────────────────
export const TEXT_STYLES = {
  pageTitle:     { fontFamily: FONTS.heading, fontSize: "18px",    fontWeight: 700 },
  sectionHeader: { fontFamily: FONTS.heading, fontSize: "16px",    fontWeight: 700 },
  cardTitle:     { fontFamily: FONTS.body,    fontSize: "14px",    fontWeight: 600 },
  body:          { fontFamily: FONTS.body,    fontSize: "14px",    fontWeight: 400 },
  label:         { fontFamily: FONTS.body,    fontSize: "12px",    fontWeight: 500 },
  badge:         { fontFamily: FONTS.body,    fontSize: "11px",    fontWeight: 600 },
  statNumber:    { fontFamily: FONTS.heading, fontSize: "28px",    fontWeight: 700 },
  mono:          { fontFamily: FONTS.mono,    fontSize: "13px",    fontWeight: 600 },
};

// ── Spacing ───────────────────────────────────────────────────────────────────
export const SPACING = {
  xs:   "4px",
  sm:   "8px",
  md:   "12px",
  base: "16px",
  lg:   "20px",
  xl:   "24px",
  "2xl":"32px",
  "3xl":"40px",
  "4xl":"48px",
  "5xl":"64px",
};

// ── Border radius ─────────────────────────────────────────────────────────────
export const RADIUS = {
  sm:   "4px",
  base: "6px",
  md:   "8px",
  lg:   "12px",
  xl:   "16px",
  full: "9999px",
};

// ── Shadows ───────────────────────────────────────────────────────────────────
export const SHADOWS = {
  sm:      "0 1px 3px rgba(0,0,0,0.5)",
  base:    "0 2px 8px rgba(0,0,0,0.6)",
  md:      "0 4px 16px rgba(0,0,0,0.7)",
  lg:      "0 8px 32px rgba(0,0,0,0.8)",
  gold:    "0 4px 20px rgba(212,175,55,0.25)",   // Gold glow — primary CTAs
  goldSm:  "0 2px 8px rgba(212,175,55,0.15)",
};

// ── Transitions ───────────────────────────────────────────────────────────────
export const TRANSITIONS = {
  fast:   "all 0.1s ease",
  base:   "all 0.2s ease",
  slow:   "all 0.3s ease",
};

// ── Layout dimensions ─────────────────────────────────────────────────────────
export const LAYOUT = {
  sidebarWidth:  "220px",   // Desktop fixed sidebar
  navbarHeight:  "56px",    // Top navbar height
  mobileBreak:   "640px",   // Mobile breakpoint
  tabletBreak:   "1024px",  // Tablet breakpoint
};

// ── Component style presets ───────────────────────────────────────────────────
export const STYLES = {
  // Cards
  card: {
    backgroundColor: COLORS.surface,
    border:          `1px solid ${COLORS.border}`,
    borderRadius:    RADIUS.lg,
    padding:         SPACING.xl,
    boxShadow:       SHADOWS.sm,
  },

  cardHover: {
    borderTop: `2px solid ${COLORS.primary}`,   // Gold top accent on hover
  },

  // Buttons
  buttonPrimary: {
    backgroundColor: COLORS.primary,
    color:           COLORS.primaryText,         // Black text on gold
    border:          "none",
    borderRadius:    RADIUS.md,
    fontFamily:      FONTS.body,
    fontSize:        FONTS.size.base,
    fontWeight:      FONTS.weight.bold,
    padding:         `${SPACING.sm} ${SPACING.base}`,
    cursor:          "pointer",
    transition:      TRANSITIONS.base,
    boxShadow:       SHADOWS.goldSm,
    minHeight:       "44px",                     // Mobile tap target
    display:         "inline-flex",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             SPACING.xs,
  },

  buttonSecondary: {
    backgroundColor: "transparent",
    color:           COLORS.textPrimary,
    border:          `1px solid ${COLORS.border}`,
    borderRadius:    RADIUS.md,
    fontFamily:      FONTS.body,
    fontSize:        FONTS.size.base,
    fontWeight:      FONTS.weight.medium,
    padding:         `${SPACING.sm} ${SPACING.base}`,
    cursor:          "pointer",
    transition:      TRANSITIONS.base,
    minHeight:       "44px",
    display:         "inline-flex",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             SPACING.xs,
  },

  buttonDanger: {
    backgroundColor: COLORS.accent,
    color:           "#FFFFFF",
    border:          "none",
    borderRadius:    RADIUS.md,
    fontFamily:      FONTS.body,
    fontSize:        FONTS.size.base,
    fontWeight:      FONTS.weight.bold,
    padding:         `${SPACING.sm} ${SPACING.base}`,
    cursor:          "pointer",
    transition:      TRANSITIONS.base,
    minHeight:       "44px",
    display:         "inline-flex",
    alignItems:      "center",
    justifyContent:  "center",
    gap:             SPACING.xs,
  },

  // Inputs
  input: {
    backgroundColor: COLORS.background,
    border:          `1px solid ${COLORS.border}`,
    borderRadius:    RADIUS.md,
    color:           COLORS.textPrimary,
    fontFamily:      FONTS.body,
    fontSize:        FONTS.size.base,
    padding:         "10px 14px",
    outline:         "none",
    width:           "100%",
    boxSizing:       "border-box",
    minHeight:       "44px",
    transition:      TRANSITIONS.fast,
  },

  // Badges
  badge: {
    fontFamily:    FONTS.body,
    fontSize:      "11px",
    fontWeight:    FONTS.weight.semibold,
    padding:       "3px 10px",
    borderRadius:  RADIUS.full,
    display:       "inline-flex",
    alignItems:    "center",
    gap:           "4px",
  },

  // Table header
  tableHeader: {
    backgroundColor: "rgba(255,255,255,0.02)",
    color:           COLORS.textSecondary,
    fontSize:        "10px",
    fontWeight:      FONTS.weight.semibold,
    textTransform:   "uppercase",
    letterSpacing:   "0.08em",
    padding:         `${SPACING.sm} ${SPACING.base}`,
    fontFamily:      FONTS.body,
  },
};

// ── Role display config ───────────────────────────────────────────────────────
export const ROLE_CONFIG = {
  platform_owner:  { label: "Platform Owner",  color: COLORS.primary,  bg: COLORS.primaryMuted },
  company_admin:   { label: "Company Admin",   color: COLORS.primary,  bg: COLORS.primaryMuted },
  manager:         { label: "Manager",         color: COLORS.info,     bg: COLORS.infoMuted    },
  agent:           { label: "Agent",           color: COLORS.success,  bg: COLORS.successMuted },
  support_agent:   { label: "Support Agent",   color: COLORS.textSecondary, bg: COLORS.surfaceActive },
};

// ── Wallet balance thresholds ─────────────────────────────────────────────────
export const WALLET = {
  minCallBalance:  5,     // Call blocked if balance < ₹5
  lowBalanceAlert: 200,   // Notification sent when balance <= ₹200
  minTopUp:        1000,  // Minimum recharge amount
  ratePerMinute:   1.00,  // ₹1 per minute charged to customer
  costPerMinute:   0.60,  // ₹0.60 Plivo cost
  profitPerMinute: 0.40,  // ₹0.40 Tony's profit
};

// ── Pricing plans ─────────────────────────────────────────────────────────────
export const PLANS = {
  starter: {
    name:       "Starter",
    price:      5499,
    agents:     3,
    managers:   1,
    storageGB:  5,
    retentionDays: 15,
    color:      COLORS.info,
  },
  basic: {
    name:       "Basic",
    price:      9999,
    agents:     10,
    managers:   2,
    storageGB:  15,
    retentionDays: 30,
    color:      COLORS.primary,
  },
  growth: {
    name:       "Growth",
    price:      15999,
    agents:     null,         // Unlimited
    managers:   null,
    storageGB:  50,
    retentionDays: 90,
    color:      COLORS.success,
  },
  enterprise: {
    name:       "Enterprise",
    price:      null,         // Custom
    agents:     null,
    managers:   null,
    storageGB:  null,
    retentionDays: 365,
    color:      COLORS.purple,
  },
};
