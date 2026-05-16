// TIRAS CRM V2 — Subscription & Plan Utilities
// Used by: WalletPage, UsagePage, AdminDashboard, SubscribePage, ProtectedRoute
// Import from: ../utils/subscriptionUtils

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN DEFINITIONS
// Master doc Section 10 — locked values
// ═══════════════════════════════════════════════════════════════════════════════

const PLAN_CONFIG = {
  trial: {
    displayName:   "Trial",
    maxAgents:     3,
    maxManagers:   1,
    maxLeads:      500,
    storageGB:     2,
    retentionDays: 7,
    price:         0,
    color:         "#9A9A9A",
  },
  starter: {
    displayName:   "Starter",
    maxAgents:     3,
    maxManagers:   1,
    maxLeads:      2000,
    storageGB:     5,
    retentionDays: 15,
    price:         5499,
    color:         "#3B82F6",   // Blue
  },
  basic: {
    displayName:   "Basic",
    maxAgents:     10,
    maxManagers:   2,
    maxLeads:      10000,
    storageGB:     15,
    retentionDays: 30,
    price:         9999,
    color:         "#D4AF37",   // Gold — most popular
  },
  growth: {
    displayName:   "Growth",
    maxAgents:     null,        // null = unlimited
    maxManagers:   null,
    maxLeads:      null,
    storageGB:     50,
    retentionDays: 90,
    price:         15999,
    color:         "#10B981",   // Green
  },
  enterprise: {
    displayName:   "Enterprise",
    maxAgents:     null,
    maxManagers:   null,
    maxLeads:      null,
    storageGB:     null,        // Custom — agreed separately
    retentionDays: 365,
    price:         null,        // Custom pricing
    color:         "#8B5CF6",   // Purple
  },
};

// Wallet charge rate — master doc Section 9
const RATE_PER_MINUTE = 1.00;   // ₹1 per minute charged to customer

// ═══════════════════════════════════════════════════════════════════════════════
// TRIAL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── getTrialDaysRemaining ────────────────────────────────────────────────────
// Returns how many full days remain in the trial
// Returns 0 if expired, null if no trial end date
// @param trialEndDate  Date | Firestore Timestamp | null

export const getTrialDaysRemaining = (trialEndDate) => {
  if (!trialEndDate) return null;

  const endDate = trialEndDate?.toDate
    ? trialEndDate.toDate()
    : new Date(trialEndDate);

  if (isNaN(endDate.getTime())) return null;

  const diffMs   = endDate - new Date();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
};

// ─── isTrialExpiredByDate ─────────────────────────────────────────────────────
// Pure date check — does not rely on subscriptionStatus field
// More reliable than checking the Firestore status (which may be stale)

export const isTrialExpiredByDate = (trialEndDate) => {
  if (!trialEndDate) return false;

  const endDate = trialEndDate?.toDate
    ? trialEndDate.toDate()
    : new Date(trialEndDate);

  if (isNaN(endDate.getTime())) return false;

  return new Date() > endDate;
};

// ─── getTrialExpiryLabel ──────────────────────────────────────────────────────
// Human readable trial status string for UI banners
// "14 days left" | "Expires today" | "Trial expired" | "3 hours left"

export const getTrialExpiryLabel = (trialEndDate) => {
  if (!trialEndDate) return "";

  const endDate = trialEndDate?.toDate
    ? trialEndDate.toDate()
    : new Date(trialEndDate);

  if (isNaN(endDate.getTime())) return "";

  const now    = new Date();
  const diffMs = endDate - now;

  if (diffMs <= 0)          return "Trial expired";
  if (diffMs < 3600000)     return `${Math.ceil(diffMs / 60000)} minutes left`;
  if (diffMs < 86400000)    return `${Math.ceil(diffMs / 3600000)} hours left`;

  const days = Math.ceil(diffMs / 86400000);
  if (days === 1)            return "Expires today";
  return `${days} days left`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION STATUS FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── getSubscriptionStatusLabel ───────────────────────────────────────────────
// Converts Firestore subscriptionStatus string to human-readable label
// @param status  "trial" | "active" | "expired" | "suspended" | "cancelled"

export const getSubscriptionStatusLabel = (status) => {
  const map = {
    trial:     "Free Trial",
    active:    "Active",
    expired:   "Subscription Expired",
    suspended: "Account Suspended",
    cancelled: "Cancelled",
    past_due:  "Payment Overdue",
  };
  return map[status] || "Unknown";
};

// ─── getSubscriptionStatusColor ───────────────────────────────────────────────
// Returns a hex color for the subscription status badge

export const getSubscriptionStatusColor = (status) => {
  const map = {
    trial:     "#D4AF37",   // Gold — on trial
    active:    "#10B981",   // Green — all good
    expired:   "#E63946",   // Red — needs action
    suspended: "#E63946",   // Red — blocked
    cancelled: "#9A9A9A",   // Grey — done
    past_due:  "#F59E0B",   // Amber — warning
  };
  return map[status] || "#9A9A9A";
};

// ─── getSubscriptionStatusBg ──────────────────────────────────────────────────
// Muted background for status badge

export const getSubscriptionStatusBg = (status) => {
  const color = getSubscriptionStatusColor(status);
  return `${color}18`;
};

// ─── isSubscriptionActive ─────────────────────────────────────────────────────
// True if company can use the app
// Checks both status field AND trial expiry date

export const isSubscriptionActive = (subscriptionStatus, trialEndDate) => {
  if (subscriptionStatus === "active") return true;

  if (subscriptionStatus === "trial") {
    return !isTrialExpiredByDate(trialEndDate);
  }

  return false;
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── getPlanLimits ────────────────────────────────────────────────────────────
// Returns the full limit object for a given plan key
// @param plan  "trial" | "starter" | "basic" | "growth" | "enterprise"
// @returns { maxAgents, maxManagers, maxLeads, storageGB, retentionDays, price }

export const getPlanLimits = (plan) => {
  const config = PLAN_CONFIG[(plan || "starter").toLowerCase()];
  if (!config) return PLAN_CONFIG.starter;
  return {
    maxAgents:     config.maxAgents,
    maxManagers:   config.maxManagers,
    maxLeads:      config.maxLeads,
    storageGB:     config.storageGB,
    retentionDays: config.retentionDays,
    price:         config.price,
  };
};

// ─── getPlanDisplayName ───────────────────────────────────────────────────────
// "starter" → "Starter"

export const getPlanDisplayName = (plan) => {
  return PLAN_CONFIG[(plan || "").toLowerCase()]?.displayName || "Unknown";
};

// ─── getPlanColor ─────────────────────────────────────────────────────────────
// Returns the brand hex color for a plan — used in badges and plan cards

export const getPlanColor = (plan) => {
  return PLAN_CONFIG[(plan || "").toLowerCase()]?.color || "#9A9A9A";
};

// ─── getPlanPrice ─────────────────────────────────────────────────────────────
// Returns annual price in INR — null for enterprise (custom)

export const getPlanPrice = (plan) => {
  return PLAN_CONFIG[(plan || "").toLowerCase()]?.price ?? null;
};

// ─── getAllPlans ───────────────────────────────────────────────────────────────
// Returns array of all plan configs — used by SubscribePage to render plan cards

export const getAllPlans = () => {
  return Object.entries(PLAN_CONFIG)
    .filter(([key]) => key !== "trial")   // Don't show trial as a purchasable plan
    .map(([key, config]) => ({ key, ...config }));
};

// ═══════════════════════════════════════════════════════════════════════════════
// LIMIT CHECK FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── isAtAgentLimit ───────────────────────────────────────────────────────────
// Returns true if company has reached max agents for their plan
// Used by TeamManagement to disable "Add Agent" button

export const isAtAgentLimit = (currentCount, plan) => {
  const limits = getPlanLimits(plan);
  if (limits.maxAgents === null) return false;           // Unlimited
  return currentCount >= limits.maxAgents;
};

// ─── isAtManagerLimit ────────────────────────────────────────────────────────

export const isAtManagerLimit = (currentCount, plan) => {
  const limits = getPlanLimits(plan);
  if (limits.maxManagers === null) return false;
  return currentCount >= limits.maxManagers;
};

// ─── isAtLeadLimit ────────────────────────────────────────────────────────────
// Returns true if company has reached max active leads for their plan
// Used by AllLeadsView and AddEditLead to show upgrade prompt

export const isAtLeadLimit = (currentCount, plan) => {
  const limits = getPlanLimits(plan);
  if (limits.maxLeads === null) return false;            // Unlimited
  return currentCount >= limits.maxLeads;
};

// ─── isAtStorageLimit ─────────────────────────────────────────────────────────
// Returns true if storage used >= plan limit (in GB)
// storageUsedGB from companies/{id}/storage.usedGB

export const isAtStorageLimit = (usedGB, plan) => {
  const limits = getPlanLimits(plan);
  if (limits.storageGB === null) return false;
  return usedGB >= limits.storageGB;
};

// ─── getStorageUsagePercent ───────────────────────────────────────────────────

export const getStorageUsagePercent = (usedGB, plan) => {
  const limits = getPlanLimits(plan);
  if (!limits.storageGB || limits.storageGB === null) return 0;
  return Math.min((usedGB / limits.storageGB) * 100, 100);
};

// ─── getLimitWarning ──────────────────────────────────────────────────────────
// Returns a warning string when approaching or at a limit — used in admin UI
// Returns null if no warning needed

export const getLimitWarning = (currentCount, limit, entityName) => {
  if (limit === null) return null;

  const pct = (currentCount / limit) * 100;

  if (currentCount >= limit) {
    return `${entityName} limit reached (${currentCount}/${limit}). Upgrade your plan to add more.`;
  }
  if (pct >= 80) {
    return `Approaching ${entityName.toLowerCase()} limit — ${currentCount} of ${limit} used.`;
  }
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Wallet thresholds — master doc Section 9
const WALLET_CRITICAL  = 5;     // Calls blocked below this
const WALLET_LOW       = 200;   // Warning shown below this
const WALLET_HEALTHY   = 500;   // Above this = green

// ─── getWalletStatusColor ─────────────────────────────────────────────────────
// Returns hex color based on wallet balance
// above 500  → #10B981 (green — healthy)
// 200–500    → #F59E0B (amber — running low)
// below 200  → #E63946 (red — low / blocked)

export const getWalletStatusColor = (balance) => {
  if (balance === null || balance === undefined) return "#9A9A9A";
  if (balance >= WALLET_HEALTHY)  return "#10B981";   // Green
  if (balance >= WALLET_LOW)      return "#F59E0B";   // Amber
  return "#E63946";                                    // Red
};

// ─── getWalletStatusBg ────────────────────────────────────────────────────────

export const getWalletStatusBg = (balance) => {
  const color = getWalletStatusColor(balance);
  return `${color}18`;
};

// ─── getWalletStatusLabel ─────────────────────────────────────────────────────

export const getWalletStatusLabel = (balance) => {
  if (balance === null || balance === undefined) return "Unknown";
  if (balance < WALLET_CRITICAL)  return "Calling Blocked";
  if (balance < WALLET_LOW)       return "Low Balance";
  if (balance < WALLET_HEALTHY)   return "Moderate";
  return "Healthy";
};

// ─── formatWalletBalance ──────────────────────────────────────────────────────
// Formats raw balance number to Indian rupee display string
// 1234.5 → "₹1,234.50"
// 0      → "₹0.00"
// null   → "₹0.00"

export const formatWalletBalance = (balance) => {
  const num = balance === null || balance === undefined ? 0 : Number(balance);
  if (isNaN(num)) return "₹0.00";

  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  return `₹${formatted}`;
};

// ─── getMinutesFromBalance ────────────────────────────────────────────────────
// How many minutes of calling can the company make with current balance?
// ₹1 per minute — master doc Section 9

export const getMinutesFromBalance = (balance) => {
  if (!balance || balance <= 0) return 0;
  return Math.floor(balance / RATE_PER_MINUTE);
};

// ─── getCallCostEstimate ──────────────────────────────────────────────────────
// How much would X minutes of calling cost?

export const getCallCostEstimate = (minutes) => {
  return (minutes || 0) * RATE_PER_MINUTE;
};

// ─── isCallingBlocked ────────────────────────────────────────────────────────
// True when balance is too low to make calls

export const isCallingBlocked = (balance) => {
  if (balance === null || balance === undefined) return true;
  return balance < WALLET_CRITICAL;
};

// ─── isWalletLow ──────────────────────────────────────────────────────────────
// True when agent should see a low balance warning

export const isWalletLow = (balance) => {
  if (balance === null || balance === undefined) return true;
  return balance < WALLET_LOW;
};

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING CYCLE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── getDaysUntilRenewal ──────────────────────────────────────────────────────
// Days until subscription renews — shown in Company Settings

export const getDaysUntilRenewal = (subscriptionEndDate) => {
  if (!subscriptionEndDate) return null;

  const endDate = subscriptionEndDate?.toDate
    ? subscriptionEndDate.toDate()
    : new Date(subscriptionEndDate);

  if (isNaN(endDate.getTime())) return null;

  const diff = endDate - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// ─── formatSubscriptionDate ───────────────────────────────────────────────────
// "15 January 2027" — used in billing UI

export const formatSubscriptionDate = (date) => {
  if (!date) return "—";

  const d = date?.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return "—";

  return d.toLocaleDateString("en-IN", {
    day:   "numeric",
    month: "long",
    year:  "numeric",
  });
};

// ─── getPlanUpgradeSuggestion ─────────────────────────────────────────────────
// Returns the next plan up from current — for upgrade CTA
// "starter" → "basic" | "basic" → "growth" | "growth" → "enterprise"

export const getPlanUpgradeSuggestion = (currentPlan) => {
  const order = ["trial", "starter", "basic", "growth", "enterprise"];
  const idx   = order.indexOf((currentPlan || "").toLowerCase());
  if (idx === -1 || idx >= order.length - 1) return null;
  return order[idx + 1];
};
