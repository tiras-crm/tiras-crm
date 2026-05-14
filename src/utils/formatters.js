// TIRAS CRM — Formatters
// All display formatting in one place — import from here, never inline format

import { COLORS } from "../theme";

// ─── formatPhone ─────────────────────────────────────────────────────────────
// Formats raw phone number into readable Indian format
// "+919876543210"  → "+91 98765 43210"
// "9876543210"     → "+91 98765 43210"
// "09876543210"    → "+91 98765 43210"
// Already formatted → returned as-is

export const formatPhone = (phone) => {
  if (!phone) return "—";

  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Handle different input lengths
  let number = digits;

  if (digits.startsWith("91") && digits.length === 12) {
    number = digits.slice(2); // remove country code
  } else if (digits.startsWith("0") && digits.length === 11) {
    number = digits.slice(1); // remove leading 0
  }

  if (number.length !== 10) {
    // Not a standard Indian number — return cleaned but not formatted
    return phone.startsWith("+") ? phone : `+${digits}`;
  }

  // Format as "+91 XXXXX XXXXX"
  return `+91 ${number.slice(0, 5)} ${number.slice(5)}`;
};

// ─── formatDuration ───────────────────────────────────────────────────────────
// Converts call duration in seconds to human-readable string
// 0        → "0s"
// 45       → "45s"
// 125      → "2m 5s"
// 3722     → "1h 2m 2s"

export const formatDuration = (seconds = 0) => {
  if (!seconds || seconds <= 0) return "0s";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

// ─── formatDurationClock ──────────────────────────────────────────────────────
// Clock-style format for live call timer display
// 0   → "00:00"
// 125 → "02:05"
// 3722→ "01:02:02"

export const formatDurationClock = (seconds = 0) => {
  if (!seconds || seconds < 0) return "00:00";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");

  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
};

// ─── formatCurrency ───────────────────────────────────────────────────────────
// Formats number as Indian Rupee string
// 1800     → "₹1,800"
// 150000   → "₹1,50,000"
// 0        → "₹0"
// null     → "₹0"

export const formatCurrency = (amount = 0) => {
  if (amount === null || amount === undefined) return "₹0";

  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);

  return `₹${formatted}`;
};

// ─── formatCurrencyFull ───────────────────────────────────────────────────────
// With paise — for invoices and payment records
// 1800.50  → "₹1,800.50"

export const formatCurrencyFull = (amount = 0) => {
  if (amount === null || amount === undefined) return "₹0.00";

  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);

  return `₹${formatted}`;
};

// ─── formatRelativeTime ───────────────────────────────────────────────────────
// Converts Firestore Timestamp or JS Date to human-readable relative string
// Just now, 2m ago, 1h ago, 3 days ago, 2 weeks ago, 3 months ago, 1 year ago
//
// Accepts: Firestore Timestamp | JS Date | Unix timestamp (number) | ISO string

export const formatRelativeTime = (input) => {
  if (!input) return "—";

  let date;

  // Firestore Timestamp
  if (input?.toDate) {
    date = input.toDate();
  } else if (input instanceof Date) {
    date = input;
  } else if (typeof input === "number") {
    date = new Date(input);
  } else if (typeof input === "string") {
    date = new Date(input);
  } else {
    return "—";
  }

  if (isNaN(date.getTime())) return "—";

  const now     = new Date();
  const diffMs  = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffH   = Math.floor(diffMin / 60);
  const diffD   = Math.floor(diffH / 24);
  const diffW   = Math.floor(diffD / 7);
  const diffMo  = Math.floor(diffD / 30);
  const diffYr  = Math.floor(diffD / 365);

  if (diffSec < 30)  return "Just now";
  if (diffSec < 60)  return `${diffSec}s ago`;
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffH   < 24)  return `${diffH}h ago`;
  if (diffD   < 7)   return `${diffD} day${diffD !== 1 ? "s" : ""} ago`;
  if (diffW   < 4)   return `${diffW} week${diffW !== 1 ? "s" : ""} ago`;
  if (diffMo  < 12)  return `${diffMo} month${diffMo !== 1 ? "s" : ""} ago`;
  return `${diffYr} year${diffYr !== 1 ? "s" : ""} ago`;
};

// ─── formatDate ───────────────────────────────────────────────────────────────
// Formats Firestore Timestamp or Date to readable date string
// Default: "13 May 2026"
// withTime: "13 May 2026, 3:42 PM"
// short:    "13 May"

export const formatDate = (input, options = {}) => {
  if (!input) return "—";

  let date;

  if (input?.toDate) {
    date = input.toDate();
  } else if (input instanceof Date) {
    date = input;
  } else if (typeof input === "number") {
    date = new Date(input);
  } else if (typeof input === "string") {
    date = new Date(input);
  } else {
    return "—";
  }

  if (isNaN(date.getTime())) return "—";

  const { withTime = false, short = false } = options;

  if (short) {
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  if (withTime) {
    return date.toLocaleDateString("en-IN", {
      day:    "numeric",
      month:  "long",
      year:   "numeric",
      hour:   "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return date.toLocaleDateString("en-IN", {
    day:   "numeric",
    month: "long",
    year:  "numeric",
  });
};

// ─── formatDateTime ───────────────────────────────────────────────────────────
// Shorthand — always includes time
// "13 May 2026, 3:42 PM"

export const formatDateTime = (input) => formatDate(input, { withTime: true });

// ─── getLeadTemperatureColor ──────────────────────────────────────────────────
// Returns Carbon Copper theme hex color for lead temperature
// Used on lead cards, badges, and list rows
// Values from master doc Section 8: Hot / Warm / Cold / Dead

export const getLeadTemperatureColor = (temperature) => {
  switch ((temperature || "").toLowerCase()) {
    case "hot":  return COLORS.hot;    // #E05252 — red
    case "warm": return COLORS.warm;   // #F2A65A — accent/sandstone
    case "cold": return COLORS.cold;   // #5A9BF2 — blue
    case "dead": return COLORS.dead;   // #666666 — muted grey
    default:     return COLORS.textMuted;
  }
};

// ─── getLeadTemperatureBg ─────────────────────────────────────────────────────
// Returns muted background color for temperature badge

export const getLeadTemperatureBg = (temperature) => {
  switch ((temperature || "").toLowerCase()) {
    case "hot":  return `${COLORS.hot}26`;
    case "warm": return `${COLORS.warm}26`;
    case "cold": return `${COLORS.cold}26`;
    case "dead": return `${COLORS.dead}26`;
    default:     return COLORS.surfaceActive;
  }
};

// ─── getStageColor ────────────────────────────────────────────────────────────
// Returns hex color for each pipeline stage
// Default stages from master doc Section 8:
// New → Contacted → Interested → Follow-up → Negotiation → Closed Won → Closed Lost

export const getStageColor = (stage) => {
  switch ((stage || "").toLowerCase().replace(/\s+/g, " ").trim()) {
    case "new":         return "#5A9BF2";   // Blue — fresh lead
    case "contacted":   return "#A78BFA";   // Purple — first contact made
    case "interested":  return COLORS.accent;    // Sandstone — showing interest
    case "follow-up":
    case "followup":    return "#F59E0B";   // Amber — needs follow-up
    case "negotiation": return COLORS.primary;   // Copper — in talks
    case "closed won":  return COLORS.success;   // Green — won
    case "closed lost": return COLORS.danger;    // Red — lost
    default:            return COLORS.textSecondary; // Unknown stage
  }
};

// ─── getStageBackground ───────────────────────────────────────────────────────
// Muted background tint for stage badges and Kanban column headers

export const getStageBackground = (stage) => {
  const color = getStageColor(stage);
  return `${color}20`; // 12% opacity
};

// ─── getOutcomeColor ──────────────────────────────────────────────────────────
// Returns color for call outcome tags shown in call history
// Outcomes from master doc Section 8

export const getOutcomeColor = (outcome) => {
  switch ((outcome || "").toLowerCase().replace(/\s+/g, " ").trim()) {
    case "interested":    return COLORS.success;
    case "not interested":return COLORS.danger;
    case "call back":     return COLORS.accent;
    case "no answer":     return COLORS.textMuted;
    case "wrong number":  return COLORS.danger;
    case "busy":          return "#F59E0B";
    case "voicemail":     return COLORS.info;
    default:              return COLORS.textSecondary;
  }
};

// ─── getObjectionTagColor ─────────────────────────────────────────────────────
// Color for AI objection tags on call summaries
// Tags from master doc Section 8 AI Features

export const getObjectionTagColor = (tag) => {
  switch ((tag || "").toLowerCase()) {
    case "price":          return COLORS.danger;
    case "timing":         return "#F59E0B";
    case "not interested": return COLORS.textMuted;
    case "need more info": return COLORS.info;
    case "wrong person":   return COLORS.textSecondary;
    case "no objection":   return COLORS.success;
    default:               return COLORS.textSecondary;
  }
};

// ─── getTicketStatusColor ─────────────────────────────────────────────────────
// Ticket stages from master doc Section 8:
// Open → Assigned → In Progress → Resolved → Closed

export const getTicketStatusColor = (status) => {
  switch ((status || "").toLowerCase().replace(/\s+/g, " ").trim()) {
    case "open":        return COLORS.danger;
    case "assigned":    return COLORS.accent;
    case "in progress": return COLORS.info;
    case "resolved":    return COLORS.success;
    case "closed":      return COLORS.textMuted;
    default:            return COLORS.textSecondary;
  }
};

// ─── getRoleBadgeStyle ────────────────────────────────────────────────────────
// Inline style object for role badge — matches ROLE_CONFIG in theme.js
// Kept here for use in table rows without importing full theme

export const getRoleBadgeStyle = (role) => {
  const map = {
    platform_owner: { color: "#F2A65A", bg: "#F2A65A26" },
    company_admin:  { color: "#B65E3C", bg: "#B65E3C26" },
    manager:        { color: "#5A9BF2", bg: "#5A9BF226" },
    agent:          { color: "#4CAF82", bg: "#4CAF8226" },
    support_agent:  { color: "#AAAAAA", bg: "#AAAAAA26" },
  };
  return map[role] || { color: "#AAAAAA", bg: "#AAAAAA26" };
};

// ─── truncate ─────────────────────────────────────────────────────────────────
// Truncates long strings for table cells and lead cards
// truncate("This is a long note", 30) → "This is a long note that is t…"

export const truncate = (str = "", maxLength = 50) => {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 1)}…`;
};

// ─── formatLeadSource ─────────────────────────────────────────────────────────
// Normalises lead source display strings
// Lead sources from master doc Section 8

export const formatLeadSource = (source) => {
  const map = {
    indiamart:   "IndiaMART",
    website:     "Website",
    cold_call:   "Cold Call",
    coldcall:    "Cold Call",
    referral:    "Referral",
    walk_in:     "Walk-in",
    walkin:      "Walk-in",
    social_media:"Social Media",
    socialmedia: "Social Media",
    whatsapp:    "WhatsApp",
    trade_show:  "Trade Show",
    tradeshow:   "Trade Show",
  };

  const key = (source || "").toLowerCase().replace(/\s+/g, "_");
  return map[key] || source || "Unknown";
};

// ─── pluralise ────────────────────────────────────────────────────────────────
// "1 lead" / "3 leads" — avoids repetitive ternary in JSX
// pluralise(1, "lead")     → "1 lead"
// pluralise(3, "lead")     → "3 leads"
// pluralise(3, "company", "companies") → "3 companies"

export const pluralise = (count, singular, plural) => {
  const word = count === 1 ? singular : (plural || `${singular}s`);
  return `${count} ${word}`;
};
